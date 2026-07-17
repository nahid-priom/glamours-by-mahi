-- Unified engines: inventory, financial transactions, journals

--------------------------------------------------------------------------------
-- Strengthened inventory engine (same signature; internal only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._adjust_inventory(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty_delta numeric,
  p_unit_cost numeric,
  p_movement_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_allowed text[] := ARRAY[
    'opening', 'purchase', 'purchase_return', 'sale', 'sale_return',
    'adjustment', 'transfer_out', 'transfer_in', 'damage', 'quarantine', 'correction'
  ];
BEGIN
  IF p_org_id IS NULL OR p_variant_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'organization, variant and location are required';
  END IF;
  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RAISE EXCEPTION 'quantity delta must be non-zero';
  END IF;
  IF p_movement_type IS NULL OR NOT (p_movement_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid inventory movement_type: %', p_movement_type;
  END IF;

  -- Idempotent source+movement: skip if identical ledger already exists
  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stock_ledger sl
    WHERE sl.organization_id = p_org_id
      AND sl.variant_id = p_variant_id
      AND sl.location_id = p_location_id
      AND sl.reference_type = p_reference_type
      AND sl.reference_id = p_reference_id
      AND sl.movement_type = p_movement_type
      AND sl.quantity_delta = p_qty_delta
      AND sl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_bal := public._ensure_inventory_balance(p_org_id, p_variant_id, p_location_id, p_actor);
  v_before := v_bal.quantity;
  v_after := v_before + p_qty_delta;

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for variant % (have %, delta %)',
      p_variant_id, v_before, p_qty_delta;
  END IF;

  IF coalesce(v_bal.qty_reserved, 0) > v_after THEN
    RAISE EXCEPTION 'Reserved quantity (%) exceeds resulting on-hand (%) for variant %',
      v_bal.qty_reserved, v_after, p_variant_id;
  END IF;

  UPDATE public.inventory_balances
  SET quantity = v_after,
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = v_bal.id;

  INSERT INTO public.stock_ledger (
    organization_id, branch_id, variant_id, location_id,
    quantity_delta, quantity_before, quantity_after, unit_cost,
    movement_type, reference_type, reference_id, notes, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_variant_id, p_location_id,
    p_qty_delta, v_before, v_after, p_unit_cost,
    p_movement_type, p_reference_type, p_reference_id, p_notes, p_actor, p_actor
  );
END;
$$;

--------------------------------------------------------------------------------
-- Strengthened cash-book engine
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._post_financial_txn(
  p_organization_id uuid,
  p_branch_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_reference text,
  p_note text,
  p_created_by uuid,
  p_apply_balance boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before numeric(14, 2);
  v_after numeric(14, 2);
  v_txn_id uuid;
  v_allow_neg boolean := false;
  v_existing uuid;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'direction must be in or out';
  END IF;

  -- Idempotent: same posted source+account+direction+amount returns existing
  IF p_source_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.financial_transactions
    WHERE organization_id = p_organization_id
      AND source_type = p_source_type
      AND source_id = p_source_id
      AND account_id = p_account_id
      AND direction = p_direction
      AND amount = p_amount
      AND deleted_at IS NULL
      AND coalesce(status, 'posted') = 'posted'
      AND voided_at IS NULL
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  SELECT current_balance INTO v_before
  FROM public.financial_accounts
  WHERE id = p_account_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial account not found';
  END IF;

  IF p_apply_balance THEN
    IF p_direction = 'in' THEN
      v_after := round(v_before + p_amount, 2);
    ELSE
      SELECT coalesce(settings->'simple_accounting'->>'allow_negative_balance', 'false') = 'true'
      INTO v_allow_neg
      FROM public.organizations
      WHERE id = p_organization_id;

      v_after := round(v_before - p_amount, 2);
      IF v_after < 0 AND NOT coalesce(v_allow_neg, false) THEN
        RAISE EXCEPTION 'Insufficient balance on selected account';
      END IF;
    END IF;

    UPDATE public.financial_accounts
    SET current_balance = v_after,
        updated_by = p_created_by,
        updated_at = timezone('utc', now())
    WHERE id = p_account_id;
  ELSE
    -- Caller already adjusted balance; reconstruct before from current after
    v_after := v_before;
    IF p_direction = 'in' THEN
      v_before := round(v_after - p_amount, 2);
    ELSE
      v_before := round(v_after + p_amount, 2);
    END IF;
  END IF;

  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, source_number, transaction_date, note, status, created_by
  ) VALUES (
    p_organization_id, p_branch_id, p_account_id, p_transaction_type, p_direction,
    p_amount, v_before, v_after,
    p_source_type, p_source_id,
    p_reference, p_reference, timezone('utc', now()), p_note, 'posted', p_created_by
  )
  RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$$;

--------------------------------------------------------------------------------
-- Internal journal poster (balanced, immutable after post)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._post_journal(
  p_org_id uuid,
  p_branch_id uuid,
  p_entry_no text,
  p_source_type text,
  p_source_id uuid,
  p_memo text,
  p_lines jsonb,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_existing uuid;
  v_entry_id uuid;
  v_line jsonb;
  v_line_no int := 0;
  v_debit numeric(14, 2) := 0;
  v_credit numeric(14, 2) := 0;
  v_d numeric(14, 2);
  v_c numeric(14, 2);
  v_account uuid;
BEGIN
  IF p_lines IS NULL OR jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal requires at least two lines';
  END IF;

  IF p_source_id IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE organization_id = p_org_id
      AND source_type = p_source_type
      AND source_id = p_source_id
      AND status = 'posted'
      AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_d := round(coalesce((v_line->>'debit')::numeric, 0), 2);
    v_c := round(coalesce((v_line->>'credit')::numeric, 0), 2);
    IF (v_d > 0 AND v_c > 0) OR (v_d = 0 AND v_c = 0) THEN
      RAISE EXCEPTION 'Each journal line must be either debit or credit';
    END IF;
    v_debit := v_debit + v_d;
    v_credit := v_credit + v_c;
  END LOOP;

  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Unbalanced journal: debit % credit %', v_debit, v_credit;
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_entry_no,
    (timezone('utc', now()))::date, 'posted',
    p_source_type, p_source_id, p_memo, timezone('utc', now()),
    p_actor, p_actor
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_no := v_line_no + 1;
    v_account := nullif(v_line->>'chart_account_id', '')::uuid;
    IF v_account IS NULL THEN
      RAISE EXCEPTION 'chart_account_id required on journal line';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts ca
      WHERE ca.id = v_account
        AND ca.organization_id = p_org_id
        AND ca.is_active = true
        AND ca.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Inactive or missing chart account %', v_account;
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      p_org_id, v_entry_id, v_account,
      nullif(v_line->>'financial_account_id', '')::uuid,
      nullif(v_line->>'description', ''),
      round(coalesce((v_line->>'debit')::numeric, 0), 2),
      round(coalesce((v_line->>'credit')::numeric, 0), 2),
      v_line_no, p_actor, p_actor
    );
  END LOOP;

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public._post_journal(uuid, uuid, text, text, uuid, text, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._post_journal(uuid, uuid, text, text, uuid, text, jsonb, uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public._adjust_inventory(uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._post_financial_txn(uuid, uuid, uuid, text, text, numeric, text, uuid, text, text, uuid, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._adjust_inventory(uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text)
  TO service_role;
GRANT EXECUTE ON FUNCTION public._post_financial_txn(uuid, uuid, uuid, text, text, numeric, text, uuid, text, text, uuid, boolean)
  TO service_role;
