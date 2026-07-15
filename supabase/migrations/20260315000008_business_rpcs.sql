-- Glamourous by Mahi Â· Retail ERP
-- Migration 008: Complete business SECURITY DEFINER RPCs
-- Depends on: 001â€“007

--------------------------------------------------------------------------------
-- Internal helpers
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._coa_by_role(p_org_id uuid, p_role text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.chart_of_accounts
  WHERE organization_id = p_org_id
    AND system_role = p_role
    AND deleted_at IS NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._saleable_location(p_org_id uuid, p_branch_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.id
  FROM public.stock_locations sl
  WHERE sl.branch_id = p_branch_id
    AND sl.organization_id = p_org_id
    AND sl.location_type = 'saleable'
    AND sl.deleted_at IS NULL
    AND sl.is_active = true
  ORDER BY sl.is_default DESC, sl.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._location_by_type(p_org_id uuid, p_branch_id uuid, p_type text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sl.id
  FROM public.stock_locations sl
  WHERE sl.branch_id = p_branch_id
    AND sl.organization_id = p_org_id
    AND sl.location_type = p_type
    AND sl.deleted_at IS NULL
    AND sl.is_active = true
  ORDER BY sl.is_default DESC, sl.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public._ensure_inventory_balance(
  p_org_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_actor uuid
)
RETURNS public.inventory_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
BEGIN
  SELECT * INTO v_bal
  FROM public.inventory_balances ib
  WHERE ib.variant_id = p_variant_id
    AND ib.location_id = p_location_id
    AND ib.organization_id = p_org_id
    AND ib.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN v_bal;
  END IF;

  INSERT INTO public.inventory_balances (
    organization_id, variant_id, location_id, quantity, created_by, updated_by
  ) VALUES (
    p_org_id, p_variant_id, p_location_id, 0, p_actor, p_actor
  )
  RETURNING * INTO v_bal;

  RETURN v_bal;
END;
$$;

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
SET search_path = public
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
BEGIN
  v_bal := public._ensure_inventory_balance(p_org_id, p_variant_id, p_location_id, p_actor);
  v_before := v_bal.quantity;
  v_after := v_before + p_qty_delta;

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for variant % (have %, delta %)',
      p_variant_id, v_before, p_qty_delta;
  END IF;

  UPDATE public.inventory_balances
  SET quantity = v_after,
      updated_by = p_actor
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

CREATE OR REPLACE FUNCTION public._reverse_journal_for_source(
  p_org_id uuid,
  p_branch_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_memo text,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orig public.journal_entries%ROWTYPE;
  v_rev_id uuid;
  v_entry_no text;
  v_line public.journal_lines%ROWTYPE;
  v_line_no int := 0;
BEGIN
  SELECT * INTO v_orig
  FROM public.journal_entries je
  WHERE je.organization_id = p_org_id
    AND je.source_type = p_source_type
    AND je.source_id = p_source_id
    AND je.status = 'posted'
    AND je.deleted_at IS NULL
  ORDER BY je.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_entry_no := 'JE-REV-' || replace(v_orig.id::text, '-', '');

  INSERT INTO public.journal_entries (
    organization_id, branch_id, period_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, reversed_entry_id, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, v_orig.period_id, v_entry_no,
    (timezone('utc', now()))::date, 'posted',
    p_source_type, p_source_id, p_memo, timezone('utc', now()),
    v_orig.id, p_actor, p_actor
  )
  RETURNING id INTO v_rev_id;

  FOR v_line IN
    SELECT * FROM public.journal_lines jl
    WHERE jl.journal_entry_id = v_orig.id
      AND jl.deleted_at IS NULL
    ORDER BY jl.line_no
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      p_org_id, v_rev_id, v_line.chart_account_id, v_line.financial_account_id,
      coalesce('Reversal: ' || v_line.description, 'Reversal'),
      v_line.credit, v_line.debit, v_line_no, p_actor, p_actor
    );
  END LOOP;

  UPDATE public.journal_entries
  SET status = 'reversed',
      updated_by = p_actor
  WHERE id = v_orig.id;

  RETURN v_rev_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._auth_ctx(OUT o_profile_id uuid, OUT o_org_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  o_profile_id := public.current_profile_id();
  o_org_id := public.current_organization_id();
  IF o_profile_id IS NULL OR o_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._coa_by_role(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._saleable_location(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._location_by_type(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._ensure_inventory_balance(uuid, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._adjust_inventory(uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._reverse_journal_for_source(uuid, uuid, text, uuid, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._auth_ctx() FROM PUBLIC;

--------------------------------------------------------------------------------
-- 1. collect_customer_due(payload jsonb)
-- {
--   branch_id, customer_id, client_txn_key, amount?, notes?,
--   payments: [{ method, amount, financial_account_id, reference }]
-- }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collect_customer_due(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_client_txn_key text;
  v_amount numeric(14, 2) := 0;
  v_payment jsonb;
  v_pay_amount numeric(14, 2);
  v_fin_acct uuid;
  v_customer public.customers%ROWTYPE;
  v_existing uuid;
  v_collection_id uuid := gen_random_uuid();
  v_entry_no text;
  v_journal_id uuid;
  v_cash_coa uuid;
  v_recv_coa uuid;
  v_line_no int := 0;
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.post')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission accounts.post or sales.read' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_customer_id := NULLIF(payload->>'customer_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'customer_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required for idempotency'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  -- Idempotency via deterministic journal entry_no
  v_entry_no := 'JE-COL-' || left(encode(extensions.digest(v_org_id::text || ':' || v_client_txn_key, 'sha256'), 'hex'), 24);

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE organization_id = v_org_id
    AND entry_no = v_entry_no
    AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'collection_id', v_existing,
      'journal_id', v_existing,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.organization_id = v_org_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'payments') < 1 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment amount';
    END IF;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
    IF v_fin_acct IS NULL THEN
      RAISE EXCEPTION 'financial_account_id required for collection payment';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_accounts fa
      WHERE fa.id = v_fin_acct
        AND fa.organization_id = v_org_id
        AND fa.deleted_at IS NULL
        AND fa.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid financial_account_id';
    END IF;
    v_amount := v_amount + v_pay_amount;
  END LOOP;

  IF payload ? 'amount' AND payload->>'amount' IS NOT NULL THEN
    IF abs((payload->>'amount')::numeric - v_amount) > 0.009 THEN
      RAISE EXCEPTION 'amount must equal sum of payments';
    END IF;
  END IF;

  IF v_amount > v_customer.current_due THEN
    RAISE EXCEPTION 'Collection amount % exceeds customer due %', v_amount, v_customer.current_due;
  END IF;

  -- Apply payments to financial accounts
  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := (v_payment->>'financial_account_id')::uuid;

    UPDATE public.financial_accounts
    SET current_balance = current_balance + v_pay_amount,
        updated_by = v_profile_id
    WHERE id = v_fin_acct;
  END LOOP;

  UPDATE public.customers
  SET current_due = current_due - v_amount,
      total_paid = total_paid + v_amount,
      updated_by = v_profile_id
  WHERE id = v_customer_id
  RETURNING * INTO v_customer;

  INSERT INTO public.customer_ledger (
    organization_id, branch_id, customer_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_customer_id, 'collection',
    0, v_amount, v_customer.current_due,
    'collection', v_collection_id,
    coalesce(NULLIF(payload->>'notes', ''), 'Due collection ' || v_client_txn_key),
    v_profile_id, v_profile_id
  );

  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'bank');
  END IF;
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'mobile_money');
  END IF;
  v_recv_coa := public._coa_by_role(v_org_id, 'receivable');

  IF v_cash_coa IS NULL OR v_recv_coa IS NULL THEN
    RAISE EXCEPTION 'Chart accounts cash/receivable required for collection';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
    'collection', v_collection_id,
    'Customer due collection ' || v_client_txn_key,
    timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_journal_id;

  -- Dr cash/bank per payment account chart; Cr receivable
  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := (v_payment->>'financial_account_id')::uuid;
    SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id,
      coalesce(v_fa.chart_account_id, v_cash_coa),
      v_fin_acct,
      'Cash collected', v_pay_amount, 0, v_line_no, v_profile_id, v_profile_id
    );
  END LOOP;

  v_line_no := v_line_no + 1;
  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, chart_account_id,
    description, debit, credit, line_no, created_by, updated_by
  ) VALUES (
    v_org_id, v_journal_id, v_recv_coa,
    'Receivable reduced', 0, v_amount, v_line_no, v_profile_id, v_profile_id
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'collection.create', 'collection', v_collection_id,
    NULL,
    jsonb_build_object(
      'customer_id', v_customer_id,
      'amount', v_amount,
      'client_txn_key', v_client_txn_key,
      'balance_after', v_customer.current_due
    ),
    NULLIF(payload->>'notes', ''),
    jsonb_build_object('source', 'collect_customer_due')
  );

  RETURN jsonb_build_object(
    'collection_id', v_collection_id,
    'journal_id', v_journal_id,
    'amount', v_amount,
    'balance_after', v_customer.current_due,
    'idempotent', false
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE organization_id = v_org_id AND entry_no = v_entry_no AND deleted_at IS NULL;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('collection_id', v_existing, 'journal_id', v_existing, 'idempotent', true);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.collect_customer_due(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_customer_due(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 2. complete_purchase(payload jsonb)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_purchase(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_supplier_id uuid;
  v_client_txn_key text;
  v_existing public.purchases%ROWTYPE;
  v_purchase_id uuid;
  v_invoice_no text;
  v_item jsonb;
  v_payment jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_location_id uuid;
  v_qty numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_shipping numeric(14, 2) := 0;
  v_grand_total numeric(14, 2) := 0;
  v_paid_total numeric(14, 2) := 0;
  v_due_total numeric(14, 2) := 0;
  v_non_due_paid numeric(14, 2) := 0;
  v_due_paid numeric(14, 2) := 0;
  v_is_due boolean;
  v_method text;
  v_fin_acct uuid;
  v_pay_amount numeric(14, 2);
  v_payment_status text;
  v_seq bigint;
  v_inv_coa uuid;
  v_pay_coa uuid;
  v_cash_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_line_no int := 0;
  v_supplier public.suppliers%ROWTYPE;
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('purchases.create') THEN
    RAISE EXCEPTION 'Missing permission purchases.create' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_supplier_id := NULLIF(payload->>'supplier_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required for idempotency'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.purchases p
  WHERE p.organization_id = v_org_id
    AND p.client_txn_key = v_client_txn_key
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchase_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'idempotent', true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = v_supplier_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid supplier_id';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one purchase item is required';
  END IF;

  v_discount := coalesce((payload->>'discount')::numeric, 0);
  v_tax := coalesce((payload->>'tax')::numeric, 0);
  v_shipping := coalesce((payload->>'shipping')::numeric, 0);
  IF v_discount < 0 OR v_tax < 0 OR v_shipping < 0 THEN
    RAISE EXCEPTION 'discount/tax/shipping cannot be negative';
  END IF;

  v_location_id := public._saleable_location(v_org_id, v_branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid item qty'; END IF;
    IF v_unit_cost < 0 OR v_line_discount < 0 THEN RAISE EXCEPTION 'Invalid item cost/discount'; END IF;

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
    END IF;

    v_line_total := round((v_qty * v_unit_cost) - v_line_discount, 2);
    IF v_line_total < 0 THEN RAISE EXCEPTION 'Line total cannot be negative'; END IF;
    v_subtotal := v_subtotal + round(v_qty * v_unit_cost, 2);

    -- Lock inventory row early
    PERFORM public._ensure_inventory_balance(v_org_id, v_variant.id, v_location_id, v_profile_id);
  END LOOP;

  v_grand_total := round(v_subtotal - v_discount + v_tax + v_shipping, 2);
  IF v_grand_total < 0 THEN RAISE EXCEPTION 'grand_total cannot be negative'; END IF;

  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'payments array is required (may be empty)';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_method = '' OR v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment method/amount';
    END IF;

    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      v_is_due := (v_method IN ('due', 'credit', 'payable'));
    END IF;

    IF v_is_due THEN
      v_due_paid := v_due_paid + v_pay_amount;
    ELSE
      v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
      IF v_fin_acct IS NULL THEN
        RAISE EXCEPTION 'financial_account_id required for method %', v_method;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.financial_accounts fa
        WHERE fa.id = v_fin_acct AND fa.organization_id = v_org_id
          AND fa.deleted_at IS NULL AND fa.is_active = true
      ) THEN
        RAISE EXCEPTION 'Invalid financial_account_id';
      END IF;
      v_non_due_paid := v_non_due_paid + v_pay_amount;
    END IF;
  END LOOP;

  v_paid_total := v_non_due_paid;
  IF v_paid_total + v_due_paid < v_grand_total THEN
    v_due_total := round(v_grand_total - v_paid_total, 2);
    IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
      RAISE EXCEPTION 'Due payment amount must equal remaining balance';
    END IF;
  ELSIF v_paid_total > v_grand_total THEN
    RAISE EXCEPTION 'Paid amount cannot exceed grand_total for purchases';
  ELSE
    v_due_total := 0;
    IF v_due_paid > 0 THEN
      RAISE EXCEPTION 'Due payment not allowed when fully paid';
    END IF;
  END IF;

  IF v_due_total <= 0 AND v_paid_total >= v_grand_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid_total > 0 AND v_due_total > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':purchase_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(p.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1
  INTO v_seq
  FROM public.purchases p
  WHERE p.organization_id = v_org_id AND p.deleted_at IS NULL;

  v_invoice_no := 'PO-' || lpad(v_seq::text, 6, '0');

  BEGIN
    INSERT INTO public.purchases (
      organization_id, branch_id, invoice_no, supplier_id,
      status, payment_status, subtotal, discount, tax, shipping, grand_total,
      paid_total, due_total, client_txn_key, note, completed_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_invoice_no, v_supplier_id,
      'completed', v_payment_status, v_subtotal, v_discount, v_tax, v_shipping, v_grand_total,
      v_paid_total, v_due_total, v_client_txn_key, NULLIF(payload->>'note', ''),
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_purchase_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT p.id, p.invoice_no INTO v_purchase_id, v_invoice_no
      FROM public.purchases p
      WHERE p.organization_id = v_org_id AND p.client_txn_key = v_client_txn_key AND p.deleted_at IS NULL;
      IF v_purchase_id IS NULL THEN RAISE; END IF;
      RETURN jsonb_build_object('purchase_id', v_purchase_id, 'invoice_no', v_invoice_no, 'idempotent', true);
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);
    v_line_total := round((v_qty * v_unit_cost) - v_line_discount, 2);

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid;

    INSERT INTO public.purchase_items (
      organization_id, purchase_id, variant_id, qty, unit_cost,
      line_discount, line_total, created_by, updated_by
    ) VALUES (
      v_org_id, v_purchase_id, v_variant.id, v_qty, v_unit_cost,
      v_line_discount, v_line_total, v_profile_id, v_profile_id
    );

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      v_qty, v_unit_cost, 'purchase', 'purchase', v_purchase_id, v_profile_id, NULL
    );

    UPDATE public.product_variants
    SET purchase_price = v_unit_cost,
        updated_by = v_profile_id
    WHERE id = v_variant.id;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL AND pm.is_active = true;
    IF NOT FOUND THEN
      v_is_due := (v_method IN ('due', 'credit', 'payable'));
    END IF;
    IF v_is_due THEN CONTINUE; END IF;

    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;

    INSERT INTO public.purchase_payments (
      organization_id, purchase_id, method, amount,
      financial_account_id, reference, created_by, updated_by
    ) VALUES (
      v_org_id, v_purchase_id, btrim(v_payment->>'method'), v_pay_amount,
      v_fin_acct, NULLIF(v_payment->>'reference', ''), v_profile_id, v_profile_id
    );

    UPDATE public.financial_accounts
    SET current_balance = current_balance - v_pay_amount,
        updated_by = v_profile_id
    WHERE id = v_fin_acct;
  END LOOP;

  IF v_due_total > 0 THEN
    UPDATE public.suppliers
    SET current_due = current_due + v_due_total,
        updated_by = v_profile_id
    WHERE id = v_supplier_id
    RETURNING * INTO v_supplier;

    INSERT INTO public.supplier_ledger (
      organization_id, branch_id, supplier_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_supplier_id, 'purchase_due',
      v_due_total, 0, v_supplier.current_due,
      'purchase', v_purchase_id,
      'Purchase due ' || v_invoice_no, v_profile_id, v_profile_id
    );
  END IF;

  v_inv_coa := public._coa_by_role(v_org_id, 'inventory_asset');
  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'bank'); END IF;

  IF v_inv_coa IS NOT NULL AND (v_pay_coa IS NOT NULL OR v_cash_coa IS NOT NULL) THEN
    v_entry_no := 'JE-PO-' || replace(v_purchase_id::text, '-', '');
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'purchase', v_purchase_id, 'Purchase ' || v_invoice_no,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    v_line_no := 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_inv_coa,
      'Inventory received', v_grand_total, 0, v_line_no, v_profile_id, v_profile_id
    );

    IF v_paid_total > 0 AND v_cash_coa IS NOT NULL THEN
      FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
      LOOP
        v_method := lower(btrim(coalesce(v_payment->>'method', '')));
        SELECT coalesce(pm.is_due, false) INTO v_is_due
        FROM public.payment_methods pm
        WHERE pm.organization_id = v_org_id AND lower(pm.code) = v_method
          AND pm.deleted_at IS NULL AND pm.is_active = true;
        IF NOT FOUND THEN v_is_due := (v_method IN ('due', 'credit', 'payable')); END IF;
        IF v_is_due THEN CONTINUE; END IF;

        v_pay_amount := (v_payment->>'amount')::numeric;
        v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
        SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
        v_line_no := v_line_no + 1;
        INSERT INTO public.journal_lines (
          organization_id, journal_entry_id, chart_account_id, financial_account_id,
          description, debit, credit, line_no, created_by, updated_by
        ) VALUES (
          v_org_id, v_journal_id, coalesce(v_fa.chart_account_id, v_cash_coa), v_fin_acct,
          'Cash/bank payment', 0, v_pay_amount, v_line_no, v_profile_id, v_profile_id
        );
      END LOOP;
    END IF;

    IF v_due_total > 0 AND v_pay_coa IS NOT NULL THEN
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_pay_coa,
        'Accounts payable', 0, v_due_total, v_line_no, v_profile_id, v_profile_id
      );
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'purchase.create', 'purchase', v_purchase_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'grand_total', v_grand_total,
      'paid_total', v_paid_total,
      'due_total', v_due_total,
      'client_txn_key', v_client_txn_key
    ),
    NULL,
    jsonb_build_object('source', 'complete_purchase')
  );

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'invoice_no', v_invoice_no,
    'grand_total', v_grand_total,
    'paid_total', v_paid_total,
    'due_total', v_due_total,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_purchase(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_purchase(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 3. pay_supplier(payload jsonb)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_supplier(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_supplier_id uuid;
  v_purchase_id uuid;
  v_client_txn_key text;
  v_amount numeric(14, 2) := 0;
  v_payment jsonb;
  v_pay_amount numeric(14, 2);
  v_fin_acct uuid;
  v_supplier public.suppliers%ROWTYPE;
  v_existing uuid;
  v_payment_id uuid := gen_random_uuid();
  v_entry_no text;
  v_journal_id uuid;
  v_pay_coa uuid;
  v_cash_coa uuid;
  v_line_no int := 0;
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('purchases.read')
    OR public.user_has_permission('accounts.post')
  ) THEN
    RAISE EXCEPTION 'Missing permission purchases.read or accounts.post' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_supplier_id := NULLIF(payload->>'supplier_id', '')::uuid;
  v_purchase_id := NULLIF(payload->>'purchase_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required for idempotency'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  v_entry_no := 'JE-SPAY-' || left(encode(extensions.digest(v_org_id::text || ':' || v_client_txn_key, 'sha256'), 'hex'), 24);

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE organization_id = v_org_id AND entry_no = v_entry_no AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('payment_id', v_existing, 'journal_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_supplier
  FROM public.suppliers s
  WHERE s.id = v_supplier_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;

  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'payments') < 1 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment amount';
    END IF;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
    IF v_fin_acct IS NULL THEN
      RAISE EXCEPTION 'financial_account_id required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_accounts fa
      WHERE fa.id = v_fin_acct AND fa.organization_id = v_org_id
        AND fa.deleted_at IS NULL AND fa.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid financial_account_id';
    END IF;
    v_amount := v_amount + v_pay_amount;
  END LOOP;

  IF v_amount > v_supplier.current_due THEN
    RAISE EXCEPTION 'Payment % exceeds supplier due %', v_amount, v_supplier.current_due;
  END IF;

  IF v_purchase_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = v_purchase_id AND p.organization_id = v_org_id
        AND p.supplier_id = v_supplier_id AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid purchase_id';
    END IF;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
    LOOP
      INSERT INTO public.purchase_payments (
        organization_id, purchase_id, method, amount,
        financial_account_id, reference, created_by, updated_by
      ) VALUES (
        v_org_id, v_purchase_id,
        coalesce(NULLIF(btrim(v_payment->>'method'), ''), 'cash'),
        (v_payment->>'amount')::numeric,
        (v_payment->>'financial_account_id')::uuid,
        NULLIF(v_payment->>'reference', ''),
        v_profile_id, v_profile_id
      );
    END LOOP;

    UPDATE public.purchases
    SET paid_total = paid_total + v_amount,
        due_total = greatest(due_total - v_amount, 0),
        payment_status = CASE
          WHEN greatest(due_total - v_amount, 0) <= 0 THEN 'paid'
          WHEN paid_total + v_amount > 0 THEN 'partial'
          ELSE payment_status
        END,
        updated_by = v_profile_id
    WHERE id = v_purchase_id;
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    UPDATE public.financial_accounts
    SET current_balance = current_balance - (v_payment->>'amount')::numeric,
        updated_by = v_profile_id
    WHERE id = (v_payment->>'financial_account_id')::uuid;
  END LOOP;

  UPDATE public.suppliers
  SET current_due = current_due - v_amount,
      updated_by = v_profile_id
  WHERE id = v_supplier_id
  RETURNING * INTO v_supplier;

  INSERT INTO public.supplier_ledger (
    organization_id, branch_id, supplier_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_supplier_id, 'payment',
    0, v_amount, v_supplier.current_due,
    coalesce(CASE WHEN v_purchase_id IS NOT NULL THEN 'purchase' END, 'supplier_payment'),
    coalesce(v_purchase_id, v_payment_id),
    coalesce(NULLIF(payload->>'notes', ''), 'Supplier payment ' || v_client_txn_key),
    v_profile_id, v_profile_id
  );

  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'bank'); END IF;

  IF v_pay_coa IS NULL OR v_cash_coa IS NULL THEN
    RAISE EXCEPTION 'Chart accounts payable/cash required for supplier payment';
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
    'supplier_payment', v_payment_id,
    'Supplier payment ' || v_client_txn_key,
    timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_journal_id;

  -- Dr payable
  v_line_no := 1;
  INSERT INTO public.journal_lines (
    organization_id, journal_entry_id, chart_account_id,
    description, debit, credit, line_no, created_by, updated_by
  ) VALUES (
    v_org_id, v_journal_id, v_pay_coa,
    'Payable reduced', v_amount, 0, v_line_no, v_profile_id, v_profile_id
  );

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := (v_payment->>'financial_account_id')::uuid;
    SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, coalesce(v_fa.chart_account_id, v_cash_coa), v_fin_acct,
      'Cash paid', 0, v_pay_amount, v_line_no, v_profile_id, v_profile_id
    );
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'supplier.pay', 'supplier', v_supplier_id,
    NULL,
    jsonb_build_object(
      'amount', v_amount,
      'purchase_id', v_purchase_id,
      'client_txn_key', v_client_txn_key,
      'balance_after', v_supplier.current_due
    ),
    NULLIF(payload->>'notes', ''),
    jsonb_build_object('source', 'pay_supplier')
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'journal_id', v_journal_id,
    'amount', v_amount,
    'balance_after', v_supplier.current_due,
    'idempotent', false
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing
    FROM public.journal_entries
    WHERE organization_id = v_org_id AND entry_no = v_entry_no AND deleted_at IS NULL;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('payment_id', v_existing, 'journal_id', v_existing, 'idempotent', true);
    END IF;
    RAISE;
END;
$$;

REVOKE ALL ON FUNCTION public.pay_supplier(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_supplier(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 4. void_sale (complete reversal)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_sale(sale_id uuid, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_location_id uuid;
  v_is_due boolean;
  v_rev_journal uuid;
  v_cogs_total numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.void') THEN
    RAISE EXCEPTION 'Missing permission sales.void' USING ERRCODE = '42501';
  END IF;

  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be voided';
  END IF;

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  -- Restock items
  FOR v_item IN
    SELECT * FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
  LOOP
    v_cogs_total := v_cogs_total + round(v_item.qty * v_item.cost_price, 2);
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      v_item.qty, v_item.cost_price, 'correction', 'sale', v_sale.id,
      v_profile_id, 'Void sale restock'
    );
  END LOOP;

  -- Reverse non-due payment effects on financial accounts
  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = lower(v_payment.method)
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      v_is_due := (lower(v_payment.method) IN ('due', 'credit', 'receivable'));
    END IF;

    IF NOT v_is_due AND v_payment.financial_account_id IS NOT NULL THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance - v_payment.amount,
          updated_by = v_profile_id
      WHERE id = v_payment.financial_account_id;
    END IF;
  END LOOP;

  -- Reverse customer due / spend
  IF v_sale.customer_id IS NOT NULL THEN
    IF v_sale.due_total > 0 THEN
      UPDATE public.customers
      SET current_due = greatest(current_due - v_sale.due_total, 0),
          total_spent = greatest(total_spent - v_sale.grand_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      )
      SELECT
        v_org_id, v_sale.branch_id, v_sale.customer_id, 'return_credit',
        0, v_sale.due_total, c.current_due,
        'sale', v_sale.id,
        'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
        v_profile_id, v_profile_id
      FROM public.customers c WHERE c.id = v_sale.customer_id;
    ELSE
      UPDATE public.customers
      SET total_spent = greatest(total_spent - v_sale.grand_total, 0),
          total_paid = greatest(total_paid - v_sale.paid_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;
    END IF;
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
    v_profile_id
  );

  UPDATE public.sales
  SET status = 'voided',
      voided_at = timezone('utc', now()),
      void_reason = btrim(reason),
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.void', 'sale', v_sale.id,
    jsonb_build_object('status', 'completed', 'grand_total', v_sale.grand_total),
    jsonb_build_object('status', 'voided', 'reason', btrim(reason), 'reversing_journal_id', v_rev_journal),
    btrim(reason),
    jsonb_build_object('source', 'void_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'status', 'voided',
    'reversing_journal_id', v_rev_journal,
    'cogs_reversed', v_cogs_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- 5. request_sale_correction
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_sale_correction(sale_id uuid, reason text, items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale public.sales%ROWTYPE;
  v_approval_id uuid;
  v_sale_approval_id uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.correct') THEN
    RAISE EXCEPTION 'Missing permission sales.correct' USING ERRCODE = '42501';
  END IF;

  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'Correction reason is required';
  END IF;

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'items array is required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = sale_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be corrected';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.approval_requests ar
    WHERE ar.organization_id = v_org_id
      AND ar.entity_type = 'sale'
      AND ar.entity_id = v_sale.id
      AND ar.request_type = 'sale_correction'
      AND ar.status = 'pending'
      AND ar.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'A pending correction request already exists for this sale';
  END IF;

  INSERT INTO public.approval_requests (
    organization_id, branch_id, entity_type, entity_id, request_type, status,
    payload, reason, requested_by, created_by, updated_by
  ) VALUES (
    v_org_id, v_sale.branch_id, 'sale', v_sale.id, 'sale_correction', 'pending',
    jsonb_build_object('items', items, 'sale_id', v_sale.id),
    btrim(reason), v_profile_id, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_approval_id;

  INSERT INTO public.sale_approvals (
    organization_id, sale_id, approval_type, status, reason,
    requested_by, created_by, updated_by
  ) VALUES (
    v_org_id, v_sale.id, 'correction', 'pending', btrim(reason),
    v_profile_id, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_sale_approval_id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.correction.request', 'sale', v_sale.id,
    NULL,
    jsonb_build_object(
      'approval_id', v_approval_id,
      'sale_approval_id', v_sale_approval_id,
      'items', items
    ),
    btrim(reason),
    jsonb_build_object('source', 'request_sale_correction')
  );

  RETURN jsonb_build_object(
    'approval_id', v_approval_id,
    'sale_approval_id', v_sale_approval_id,
    'sale_id', v_sale.id,
    'status', 'pending'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.request_sale_correction(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_sale_correction(uuid, text, jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Patch: allow sale correction flow to call complete_pos_sale
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_pos_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_org_id uuid := public.current_organization_id();
  v_branch_id uuid;
  v_customer_id uuid;
  v_client_txn_key text;
  v_existing_sale public.sales%ROWTYPE;
  v_sale_id uuid;
  v_invoice_no text;
  v_item jsonb;
  v_payment jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_location_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_total numeric(14, 2);
  v_cost_price numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_shipping numeric(14, 2) := 0;
  v_grand_total numeric(14, 2) := 0;
  v_paid_total numeric(14, 2) := 0;
  v_due_total numeric(14, 2) := 0;
  v_change_amount numeric(14, 2) := 0;
  v_cogs_total numeric(14, 2) := 0;
  v_payment_status text;
  v_seq bigint;
  v_qty_before numeric(14, 3);
  v_qty_after numeric(14, 3);
  v_cash_coa uuid;
  v_recv_coa uuid;
  v_sales_coa uuid;
  v_cogs_coa uuid;
  v_inv_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_pay_amount numeric(14, 2);
  v_non_due_paid numeric(14, 2) := 0;
  v_due_paid numeric(14, 2) := 0;
  v_is_due boolean;
  v_method text;
  v_fin_acct uuid;
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization context missing' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('pos.create')
     AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Missing permission pos.create' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = v_branch_id
      AND b.organization_id = v_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required for idempotency';
  END IF;

  SELECT * INTO v_existing_sale
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sale_id', v_existing_sale.id,
      'invoice_no', v_existing_sale.invoice_no,
      'idempotent', true
    );
  END IF;

  v_customer_id := NULLIF(payload->>'customer_id', '')::uuid;
  IF v_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = v_customer_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid customer_id';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  v_discount := coalesce((payload->>'discount')::numeric, 0);
  v_tax := coalesce((payload->>'tax')::numeric, 0);
  v_shipping := coalesce((payload->>'shipping')::numeric, 0);

  IF v_discount < 0 OR v_tax < 0 OR v_shipping < 0 THEN
    RAISE EXCEPTION 'discount/tax/shipping cannot be negative';
  END IF;

  SELECT sl.id INTO v_location_id
  FROM public.stock_locations sl
  WHERE sl.branch_id = v_branch_id
    AND sl.organization_id = v_org_id
    AND sl.location_type = 'saleable'
    AND sl.deleted_at IS NULL
    AND sl.is_active = true
  ORDER BY sl.is_default DESC, sl.created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item qty';
    END IF;
    IF v_unit_price < 0 OR v_line_discount < 0 THEN
      RAISE EXCEPTION 'Invalid item price/discount';
    END IF;

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL
      AND pv.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
    END IF;

    IF v_item ? 'unit_price' AND (v_item->>'unit_price') IS NOT NULL THEN
      IF v_unit_price <> v_variant.selling_price
         AND NOT public.user_has_permission('pos.price_override')
         AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
        v_unit_price := v_variant.selling_price;
      END IF;
    ELSE
      v_unit_price := v_variant.selling_price;
    END IF;

    IF v_line_discount > 0
       AND NOT public.user_has_permission('pos.discount')
       AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
      RAISE EXCEPTION 'Missing permission pos.discount';
    END IF;

    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);
    IF v_line_total < 0 THEN
      RAISE EXCEPTION 'Line total cannot be negative';
    END IF;

    v_cost_price := coalesce(v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
    v_cogs_total := v_cogs_total + round(v_qty * v_cost_price, 2);

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.organization_id = v_org_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory balance for variant %', v_variant.id;
    END IF;

    IF v_balance.quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for variant % (have %, need %)',
        v_variant.id, v_balance.quantity, v_qty;
    END IF;
  END LOOP;

  IF v_discount > 0
     AND NOT public.user_has_permission('pos.discount')
     AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Missing permission pos.discount';
  END IF;

  v_grand_total := round(v_subtotal - v_discount + v_tax + v_shipping, 2);
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'grand_total cannot be negative';
  END IF;

  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'payments array is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_method = '' OR v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment method/amount';
    END IF;

    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      v_is_due := (v_method IN ('due', 'credit', 'receivable'));
    END IF;

    IF v_is_due THEN
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Due payment requires a customer';
      END IF;
      v_due_paid := v_due_paid + v_pay_amount;
    ELSE
      v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
      IF v_fin_acct IS NULL THEN
        RAISE EXCEPTION 'financial_account_id required for method %', v_method;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.financial_accounts fa
        WHERE fa.id = v_fin_acct
          AND fa.organization_id = v_org_id
          AND fa.deleted_at IS NULL
          AND fa.is_active = true
      ) THEN
        RAISE EXCEPTION 'Invalid financial_account_id';
      END IF;
      v_non_due_paid := v_non_due_paid + v_pay_amount;
    END IF;
  END LOOP;

  v_paid_total := v_non_due_paid;
  IF v_paid_total + v_due_paid < v_grand_total THEN
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'Payments do not cover grand_total';
    END IF;
    v_due_total := round(v_grand_total - v_paid_total, 2);
    IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
      RAISE EXCEPTION 'Due payment amount must equal remaining balance';
    END IF;
    IF v_due_paid = 0 THEN
      v_due_total := round(v_grand_total - v_paid_total, 2);
    END IF;
  ELSIF v_paid_total > v_grand_total THEN
    v_change_amount := round(v_paid_total - v_grand_total, 2);
    v_paid_total := v_grand_total;
    v_due_total := 0;
  ELSE
    v_due_total := 0;
    IF v_due_paid > 0 THEN
      RAISE EXCEPTION 'Due payment not allowed when fully paid in cash/bank';
    END IF;
  END IF;

  IF v_due_total > 0 AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Due requires a customer';
  END IF;

  IF v_due_total <= 0 AND v_paid_total >= v_grand_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid_total > 0 AND v_due_total > 0 THEN
    v_payment_status := 'partial';
  ELSIF v_paid_total = 0 AND v_due_total > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':sale_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1
  INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL;

  v_invoice_no := 'INV-' || lpad(v_seq::text, 6, '0');

  BEGIN
    INSERT INTO public.sales (
      organization_id, branch_id, invoice_no, customer_id, salesperson_id,
      status, payment_status, subtotal, discount, tax, shipping, grand_total,
      paid_total, due_total, change_amount, client_txn_key, version,
      note, completed_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_invoice_no, v_customer_id, v_profile_id,
      'completed', v_payment_status, v_subtotal, v_discount, v_tax, v_shipping, v_grand_total,
      v_paid_total, v_due_total, v_change_amount, v_client_txn_key, 1,
      NULLIF(payload->>'note', ''), timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_sale_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT s.id, s.invoice_no INTO v_sale_id, v_invoice_no
      FROM public.sales s
      WHERE s.organization_id = v_org_id
        AND s.client_txn_key = v_client_txn_key
        AND s.deleted_at IS NULL;

      IF v_sale_id IS NULL THEN
        RAISE;
      END IF;

      RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'invoice_no', v_invoice_no,
        'idempotent', true
      );
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL;

    v_unit_price := coalesce((v_item->>'unit_price')::numeric, v_variant.selling_price);
    IF v_unit_price <> v_variant.selling_price
       AND NOT public.user_has_permission('pos.price_override')
       AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
      v_unit_price := v_variant.selling_price;
    END IF;

    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);
    v_cost_price := coalesce(v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price, created_by, updated_by
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      v_line_discount, v_line_total, v_cost_price, v_profile_id, v_profile_id
    );

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    v_qty_before := v_balance.quantity;
    v_qty_after := v_qty_before - v_qty;

    UPDATE public.inventory_balances
    SET quantity = v_qty_after,
        updated_by = v_profile_id
    WHERE id = v_balance.id;

    INSERT INTO public.stock_ledger (
      organization_id, branch_id, variant_id, location_id,
      quantity_delta, quantity_before, quantity_after, unit_cost,
      movement_type, reference_type, reference_id, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      -v_qty, v_qty_before, v_qty_after, v_cost_price,
      'sale', 'sale', v_sale_id, v_profile_id, v_profile_id
    );
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    INSERT INTO public.sale_payments (
      organization_id, sale_id, method, amount,
      financial_account_id, reference, created_by, updated_by
    ) VALUES (
      v_org_id,
      v_sale_id,
      btrim(v_payment->>'method'),
      (v_payment->>'amount')::numeric,
      NULLIF(v_payment->>'financial_account_id', '')::uuid,
      NULLIF(v_payment->>'reference', ''),
      v_profile_id,
      v_profile_id
    );

    IF NULLIF(v_payment->>'financial_account_id', '') IS NOT NULL THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance + (v_payment->>'amount')::numeric,
          updated_by = v_profile_id
      WHERE id = (v_payment->>'financial_account_id')::uuid;
    END IF;
  END LOOP;

  IF v_due_total > 0 THEN
    UPDATE public.customers
    SET current_due = current_due + v_due_total,
        total_spent = total_spent + v_grand_total,
        updated_by = v_profile_id
    WHERE id = v_customer_id;

    INSERT INTO public.customer_ledger (
      organization_id, branch_id, customer_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    )
    SELECT
      v_org_id, v_branch_id, v_customer_id, 'sale_due',
      v_due_total, 0,
      c.current_due,
      'sale', v_sale_id,
      'POS sale due ' || v_invoice_no,
      v_profile_id, v_profile_id
    FROM public.customers c
    WHERE c.id = v_customer_id;
  ELSIF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = total_spent + v_grand_total,
        total_paid = total_paid + v_paid_total,
        updated_by = v_profile_id
    WHERE id = v_customer_id;
  END IF;

  SELECT id INTO v_sales_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'sales_revenue' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cogs_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'cogs' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_inv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'inventory_asset' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_recv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'receivable' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cash_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role IN ('cash', 'bank') AND deleted_at IS NULL
  ORDER BY CASE system_role WHEN 'cash' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_sales_coa IS NOT NULL AND (v_cash_coa IS NOT NULL OR v_recv_coa IS NOT NULL) THEN
    v_entry_no := 'JE-SALE-' || replace(v_sale_id::text, '-', '');

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'sale', v_sale_id, 'POS sale ' || v_invoice_no, timezone('utc', now()),
      v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    IF v_paid_total > 0 AND v_cash_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_cash_coa,
        'Cash/bank received', v_paid_total, 0, 1, v_profile_id, v_profile_id
      );
    END IF;

    IF v_due_total > 0 AND v_recv_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_recv_coa,
        'Customer receivable', v_due_total, 0, 2, v_profile_id, v_profile_id
      );
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_sales_coa,
      'Sales revenue', 0, v_grand_total, 3, v_profile_id, v_profile_id
    );

    IF v_cogs_total > 0 AND v_cogs_coa IS NOT NULL AND v_inv_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES
        (v_org_id, v_journal_id, v_cogs_coa, 'Cost of goods sold', v_cogs_total, 0, 4, v_profile_id, v_profile_id),
        (v_org_id, v_journal_id, v_inv_coa, 'Inventory relief', 0, v_cogs_total, 5, v_profile_id, v_profile_id);
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id,
    v_branch_id,
    v_profile_id,
    'sale.create',
    'sale',
    v_sale_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'grand_total', v_grand_total,
      'paid_total', v_paid_total,
      'due_total', v_due_total,
      'client_txn_key', v_client_txn_key
    ),
    NULL,
    jsonb_build_object('source', 'complete_pos_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'idempotent', false,
    'grand_total', v_grand_total,
    'paid_total', v_paid_total,
    'due_total', v_due_total,
    'change_amount', v_change_amount
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.complete_pos_sale(jsonb) IS
  'Atomically complete a POS sale (also used by sale correction via app.skip_pos_permission).';

--------------------------------------------------------------------------------
-- 6. approve_sale_correction
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_sale_correction(approval_id uuid, corrected_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_req public.approval_requests%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_location_id uuid;
  v_is_due boolean;
  v_rev_journal uuid;
  v_new_sale jsonb;
  v_new_sale_id uuid;
  v_merged_payload jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.correct') THEN
    RAISE EXCEPTION 'Missing permission sales.correct' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.approval_requests ar
  WHERE ar.id = approval_id
    AND ar.organization_id = v_org_id
    AND ar.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Approval request not found'; END IF;

  IF v_req.request_type <> 'sale_correction' THEN
    RAISE EXCEPTION 'Approval is not a sale correction request';
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Approval is not pending';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_req.entity_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be corrected';
  END IF;

  -- Snapshot original
  INSERT INTO public.sale_versions (
    organization_id, sale_id, version, snapshot, reason, created_by, updated_by
  ) VALUES (
    v_org_id, v_sale.id, v_sale.version,
    to_jsonb(v_sale) || jsonb_build_object(
      'items', coalesce((
        SELECT jsonb_agg(to_jsonb(si)) FROM public.sale_items si
        WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
      ), '[]'::jsonb),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(sp)) FROM public.sale_payments sp
        WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL
      ), '[]'::jsonb)
    ),
    coalesce(v_req.reason, 'Sale correction'),
    v_profile_id, v_profile_id
  );

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  -- Void-like reverse of original (mark corrected, never delete)
  FOR v_item IN
    SELECT * FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      v_item.qty, v_item.cost_price, 'correction', 'sale', v_sale.id,
      v_profile_id, 'Correction reverse restock'
    );
  END LOOP;

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = lower(v_payment.method)
      AND pm.deleted_at IS NULL AND pm.is_active = true;
    IF NOT FOUND THEN
      v_is_due := (lower(v_payment.method) IN ('due', 'credit', 'receivable'));
    END IF;
    IF NOT v_is_due AND v_payment.financial_account_id IS NOT NULL THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance - v_payment.amount,
          updated_by = v_profile_id
      WHERE id = v_payment.financial_account_id;
    END IF;
  END LOOP;

  IF v_sale.customer_id IS NOT NULL THEN
    IF v_sale.due_total > 0 THEN
      UPDATE public.customers
      SET current_due = greatest(current_due - v_sale.due_total, 0),
          total_spent = greatest(total_spent - v_sale.grand_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      )
      SELECT
        v_org_id, v_sale.branch_id, v_sale.customer_id, 'adjustment',
        0, v_sale.due_total, c.current_due,
        'sale', v_sale.id,
        'Correction reverse ' || v_sale.invoice_no,
        v_profile_id, v_profile_id
      FROM public.customers c WHERE c.id = v_sale.customer_id;
    ELSE
      UPDATE public.customers
      SET total_spent = greatest(total_spent - v_sale.grand_total, 0),
          total_paid = greatest(total_paid - v_sale.paid_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;
    END IF;
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Correction reverse ' || v_sale.invoice_no,
    v_profile_id
  );

  UPDATE public.sales
  SET status = 'corrected',
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  -- Build corrected POS payload and create new sale version
  v_merged_payload := coalesce(corrected_payload, '{}'::jsonb);
  IF NOT (v_merged_payload ? 'branch_id') THEN
    v_merged_payload := v_merged_payload || jsonb_build_object('branch_id', v_sale.branch_id);
  END IF;
  IF NOT (v_merged_payload ? 'customer_id') AND v_sale.customer_id IS NOT NULL THEN
    v_merged_payload := v_merged_payload || jsonb_build_object('customer_id', v_sale.customer_id);
  END IF;
  IF NOT (v_merged_payload ? 'client_txn_key') THEN
    v_merged_payload := v_merged_payload || jsonb_build_object(
      'client_txn_key', 'corr-' || replace(v_sale.id::text, '-', '') || '-' || extract(epoch from now())::bigint
    );
  END IF;
  IF NOT (v_merged_payload ? 'items') AND (v_req.payload ? 'items') THEN
    v_merged_payload := v_merged_payload || jsonb_build_object('items', v_req.payload->'items');
  END IF;

  -- Allow posting corrected sale without requiring pos.create on the approver
  PERFORM set_config('app.skip_pos_permission', '1', true);
  v_new_sale := public.complete_pos_sale(v_merged_payload);

  v_new_sale_id := (v_new_sale->>'sale_id')::uuid;

  UPDATE public.sales
  SET previous_sale_id = v_sale.id,
      corrected_from_id = v_sale.id,
      version = v_sale.version + 1,
      updated_by = v_profile_id
  WHERE id = v_new_sale_id;

  UPDATE public.approval_requests
  SET status = 'approved',
      decided_by = v_profile_id,
      decided_at = timezone('utc', now()),
      decision_note = 'Correction approved',
      updated_by = v_profile_id
  WHERE id = v_req.id;

  UPDATE public.sale_approvals
  SET status = 'approved',
      decided_by = v_profile_id,
      decided_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE sale_id = v_sale.id
    AND approval_type = 'correction'
    AND status = 'pending'
    AND deleted_at IS NULL;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.correction.approve', 'sale', v_sale.id,
    jsonb_build_object('status', 'completed'),
    jsonb_build_object(
      'status', 'corrected',
      'new_sale_id', v_new_sale_id,
      'reversing_journal_id', v_rev_journal
    ),
    v_req.reason,
    jsonb_build_object('source', 'approve_sale_correction')
  );

  RETURN jsonb_build_object(
    'approval_id', v_req.id,
    'original_sale_id', v_sale.id,
    'new_sale_id', v_new_sale_id,
    'new_invoice_no', v_new_sale->>'invoice_no',
    'reversing_journal_id', v_rev_journal
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sale_correction(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sale_correction(uuid, jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 7. approve_courier_return (complete)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_courier_return(request_id uuid, items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_req public.courier_return_requests%ROWTYPE;
  v_item jsonb;
  v_cri public.courier_return_items%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_sale_item public.sale_items%ROWTYPE;
  v_condition text;
  v_recv_qty numeric(14, 3);
  v_loc uuid;
  v_movement text;
  v_return_id uuid;
  v_return_no text;
  v_seq bigint;
  v_return_total numeric(14, 2) := 0;
  v_line_total numeric(14, 2);
  v_cogs_rev numeric(14, 2) := 0;
  v_sales_rev numeric(14, 2) := 0;
  v_unit_price numeric(14, 2);
  v_cost numeric(14, 2);
  v_sales_coa uuid;
  v_sales_ret_coa uuid;
  v_cogs_coa uuid;
  v_inv_coa uuid;
  v_recv_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_line_no int := 0;
  v_recv_reduce numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.return.review') THEN
    RAISE EXCEPTION 'Missing permission sales.return.review' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.courier_return_requests r
  WHERE r.id = request_id
    AND r.organization_id = v_org_id
    AND r.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Courier return request not found'; END IF;

  -- Idempotent if already approved
  IF v_req.status = 'approved' THEN
    RETURN jsonb_build_object(
      'request_id', v_req.id,
      'status', 'approved',
      'idempotent', true
    );
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'items array with received qty/condition is required';
  END IF;

  IF v_req.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_req.sale_id AND deleted_at IS NULL;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':sale_return'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(sr.return_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sale_returns sr
  WHERE sr.organization_id = v_org_id AND sr.deleted_at IS NULL;

  v_return_no := 'SR-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.sale_returns (
    organization_id, branch_id, sale_id, return_no, status, reason, total,
    approved_by, approved_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_req.branch_id, v_req.sale_id, v_return_no, 'completed',
    coalesce(v_req.courier_reason, 'Courier return'), 0,
    v_profile_id, timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_condition := lower(btrim(coalesce(v_item->>'condition', '')));
    v_recv_qty := (v_item->>'received_qty')::numeric;

    IF v_condition NOT IN ('sellable', 'damaged', 'quarantine', 'missing', 'wrong_item') THEN
      RAISE EXCEPTION 'Invalid condition: %', v_condition;
    END IF;
    IF v_recv_qty IS NULL OR v_recv_qty < 0 THEN
      RAISE EXCEPTION 'Each item requires non-negative received_qty';
    END IF;

    SELECT * INTO v_cri
    FROM public.courier_return_items cri
    WHERE cri.request_id = v_req.id
      AND cri.organization_id = v_org_id
      AND cri.deleted_at IS NULL
      AND (
        (v_item->>'id') IS NOT NULL AND cri.id = (v_item->>'id')::uuid
        OR (v_item->>'variant_id') IS NOT NULL AND cri.variant_id = (v_item->>'variant_id')::uuid
        OR (v_item->>'sale_item_id') IS NOT NULL AND cri.sale_item_id = (v_item->>'sale_item_id')::uuid
      )
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Courier return item not found for payload entry';
    END IF;

    UPDATE public.courier_return_items
    SET received_qty = v_recv_qty,
        condition = v_condition,
        updated_by = v_profile_id
    WHERE id = v_cri.id;

    v_unit_price := 0;
    v_cost := 0;
    IF v_cri.sale_item_id IS NOT NULL THEN
      SELECT * INTO v_sale_item FROM public.sale_items WHERE id = v_cri.sale_item_id;
      IF FOUND THEN
        v_unit_price := v_sale_item.unit_price;
        v_cost := v_sale_item.cost_price;
      END IF;
    ELSIF v_cri.variant_id IS NOT NULL THEN
      SELECT purchase_price, selling_price INTO v_cost, v_unit_price
      FROM public.product_variants WHERE id = v_cri.variant_id;
    END IF;

    -- Restock only physically returned non-missing items
    IF v_recv_qty > 0 AND v_condition IN ('sellable', 'damaged', 'quarantine')
       AND v_cri.variant_id IS NOT NULL AND v_req.branch_id IS NOT NULL THEN
      IF v_condition = 'sellable' THEN
        v_loc := public._location_by_type(v_org_id, v_req.branch_id, 'saleable');
        v_movement := 'sale_return';
      ELSIF v_condition = 'damaged' THEN
        v_loc := public._location_by_type(v_org_id, v_req.branch_id, 'damaged');
        v_movement := 'damage';
      ELSE
        v_loc := public._location_by_type(v_org_id, v_req.branch_id, 'quarantine');
        v_movement := 'quarantine';
      END IF;

      IF v_loc IS NULL THEN
        RAISE EXCEPTION 'No % stock location for branch', v_condition;
      END IF;

      PERFORM public._adjust_inventory(
        v_org_id, v_req.branch_id, v_cri.variant_id, v_loc,
        v_recv_qty, v_cost, v_movement, 'sale_return', v_return_id,
        v_profile_id, 'Courier return ' || v_condition
      );
    END IF;

    -- Accounting: reverse revenue/COGS/receivable for returned qty (excluding missing/wrong fully?)
    -- Apply partial reverse for any condition with received_qty or expected for missing
    IF v_condition = 'missing' THEN
      -- no restock; still reverse receivable/revenue for missing delivered units if expected
      v_recv_qty := coalesce(v_cri.expected_qty, 0);
    END IF;

    IF v_recv_qty > 0 AND v_cri.variant_id IS NOT NULL THEN
      v_line_total := round(v_recv_qty * v_unit_price, 2);
      v_return_total := v_return_total + v_line_total;
      v_sales_rev := v_sales_rev + v_line_total;
      v_cogs_rev := v_cogs_rev + round(v_recv_qty * v_cost, 2);

      INSERT INTO public.sale_return_items (
        organization_id, sale_return_id, sale_item_id, variant_id,
        qty, unit_price, line_total, condition, created_by, updated_by
      ) VALUES (
        v_org_id, v_return_id, v_cri.sale_item_id, v_cri.variant_id,
        v_recv_qty, v_unit_price, v_line_total, v_condition,
        v_profile_id, v_profile_id
      );
    END IF;
  END LOOP;

  UPDATE public.sale_returns
  SET total = v_return_total, updated_by = v_profile_id
  WHERE id = v_return_id;

  -- Partial receivable / customer ledger if sale had due
  IF v_sale.id IS NOT NULL AND v_sales_rev > 0 AND v_sale.customer_id IS NOT NULL THEN
    v_recv_reduce := least(v_sale.due_total, v_sales_rev);
    IF v_recv_reduce > 0 THEN
      UPDATE public.customers
      SET current_due = greatest(current_due - v_recv_reduce, 0),
          total_spent = greatest(total_spent - v_sales_rev, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      )
      SELECT
        v_org_id, v_req.branch_id, v_sale.customer_id, 'return_credit',
        0, v_recv_reduce, c.current_due,
        'sale_return', v_return_id,
        'Courier return ' || v_return_no,
        v_profile_id, v_profile_id
      FROM public.customers c WHERE c.id = v_sale.customer_id;
    END IF;
  END IF;

  v_sales_coa := public._coa_by_role(v_org_id, 'sales_revenue');
  v_sales_ret_coa := public._coa_by_role(v_org_id, 'sales_return');
  v_cogs_coa := public._coa_by_role(v_org_id, 'cogs');
  v_inv_coa := public._coa_by_role(v_org_id, 'inventory_asset');
  v_recv_coa := public._coa_by_role(v_org_id, 'receivable');

  IF v_sales_rev > 0 AND (v_sales_ret_coa IS NOT NULL OR v_sales_coa IS NOT NULL) THEN
    v_entry_no := 'JE-CRR-' || replace(v_req.id::text, '-', '');
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_req.branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'courier_return', v_req.id, 'Courier return ' || v_return_no,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    -- Dr sales return (or sales), Cr receivable (partial) / leave cash path via refund_payable if paid
    v_line_no := 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, coalesce(v_sales_ret_coa, v_sales_coa),
      'Sales return', v_sales_rev, 0, v_line_no, v_profile_id, v_profile_id
    );

    IF v_recv_reduce > 0 AND v_recv_coa IS NOT NULL THEN
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_recv_coa,
        'Receivable reduced', 0, v_recv_reduce, v_line_no, v_profile_id, v_profile_id
      );
    END IF;

    -- Remaining credit to refund payable if paid portion returned
    IF v_sales_rev - v_recv_reduce > 0.009 THEN
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id,
        coalesce(public._coa_by_role(v_org_id, 'refund_payable'), v_recv_coa, v_sales_coa),
        'Refund liability / paid reversal', 0, round(v_sales_rev - v_recv_reduce, 2),
        v_line_no, v_profile_id, v_profile_id
      );
    END IF;

    -- Reverse COGS for restocked sellable/damaged/quarantine (inventory back)
    IF v_cogs_rev > 0 AND v_cogs_coa IS NOT NULL AND v_inv_coa IS NOT NULL THEN
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES
        (v_org_id, v_journal_id, v_inv_coa, 'Inventory restock', v_cogs_rev, 0, v_line_no, v_profile_id, v_profile_id);
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES
        (v_org_id, v_journal_id, v_cogs_coa, 'COGS reversal', 0, v_cogs_rev, v_line_no, v_profile_id, v_profile_id);
    END IF;
  END IF;

  UPDATE public.courier_return_requests
  SET status = 'approved',
      reviewed_by = v_profile_id,
      reviewed_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_req.id;

  PERFORM public.write_audit_log(
    v_org_id, v_req.branch_id, v_profile_id,
    'courier_return.approve', 'courier_return_request', v_req.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object(
      'status', 'approved',
      'sale_return_id', v_return_id,
      'return_total', v_return_total,
      'items', items
    ),
    NULL,
    jsonb_build_object('source', 'approve_courier_return')
  );

  RETURN jsonb_build_object(
    'request_id', v_req.id,
    'status', 'approved',
    'sale_return_id', v_return_id,
    'return_no', v_return_no,
    'return_total', v_return_total,
    'journal_id', v_journal_id,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_courier_return(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_courier_return(uuid, jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 8. reject_courier_return
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_courier_return(request_id uuid, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_req public.courier_return_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.return.review') THEN
    RAISE EXCEPTION 'Missing permission sales.return.review' USING ERRCODE = '42501';
  END IF;

  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'Rejection reason is required';
  END IF;

  SELECT * INTO v_req
  FROM public.courier_return_requests r
  WHERE r.id = request_id
    AND r.organization_id = v_org_id
    AND r.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Courier return request not found'; END IF;

  IF v_req.status = 'rejected' THEN
    RETURN jsonb_build_object('request_id', v_req.id, 'status', 'rejected', 'idempotent', true);
  END IF;

  IF v_req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending';
  END IF;

  UPDATE public.courier_return_requests
  SET status = 'rejected',
      rejection_reason = btrim(reason),
      reviewed_by = v_profile_id,
      reviewed_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_req.id;

  PERFORM public.write_audit_log(
    v_org_id, v_req.branch_id, v_profile_id,
    'courier_return.reject', 'courier_return_request', v_req.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'rejected', 'reason', btrim(reason)),
    btrim(reason),
    jsonb_build_object('source', 'reject_courier_return')
  );

  RETURN jsonb_build_object(
    'request_id', v_req.id,
    'status', 'rejected',
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reject_courier_return(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_courier_return(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- 9. create_stock_adjustment(payload jsonb)
-- {
--   branch_id, location_id, reason, notes?, client_txn_key?,
--   items: [{ variant_id, quantity_counted, unit_cost? }]
-- }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_adjustment(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_location_id uuid;
  v_item jsonb;
  v_variant_id uuid;
  v_counted numeric(14, 3);
  v_before numeric(14, 3);
  v_delta numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_adj_id uuid;
  v_adj_no text;
  v_seq bigint;
  v_value_delta numeric(14, 2) := 0;
  v_bal public.inventory_balances%ROWTYPE;
  v_inv_coa uuid;
  v_exp_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_client_txn_key text;
  v_existing uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.adjust') THEN
    RAISE EXCEPTION 'Missing permission inventory.adjust' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_location_id := NULLIF(payload->>'location_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_location_id IS NULL THEN RAISE EXCEPTION 'location_id is required'; END IF;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.stock_locations sl
    WHERE sl.id = v_location_id AND sl.branch_id = v_branch_id
      AND sl.organization_id = v_org_id AND sl.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid location for branch';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one adjustment item is required';
  END IF;

  IF v_client_txn_key IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.stock_adjustments
    WHERE organization_id = v_org_id
      AND adjustment_no = 'ADJ-IDEM-' || left(encode(extensions.digest(v_client_txn_key, 'sha256'), 'hex'), 16)
      AND deleted_at IS NULL;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object('adjustment_id', v_existing, 'idempotent', true);
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':stock_adj'));

  IF v_client_txn_key IS NOT NULL THEN
    v_adj_no := 'ADJ-IDEM-' || left(encode(extensions.digest(v_client_txn_key, 'sha256'), 'hex'), 16);
  ELSE
    SELECT coalesce(max(
      NULLIF(regexp_replace(sa.adjustment_no, '[^0-9]', '', 'g'), '')::bigint
    ), 0) + 1 INTO v_seq
    FROM public.stock_adjustments sa
    WHERE sa.organization_id = v_org_id AND sa.deleted_at IS NULL
      AND sa.adjustment_no ~ '^ADJ-[0-9]+$';
    v_adj_no := 'ADJ-' || lpad(v_seq::text, 6, '0');
  END IF;

  INSERT INTO public.stock_adjustments (
    organization_id, branch_id, location_id, adjustment_no, status,
    reason, notes, posted_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_location_id, v_adj_no, 'posted',
    NULLIF(payload->>'reason', ''), NULLIF(payload->>'notes', ''),
    timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_adj_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_variant_id := (v_item->>'variant_id')::uuid;
    v_counted := (v_item->>'quantity_counted')::numeric;
    IF v_variant_id IS NULL OR v_counted IS NULL OR v_counted < 0 THEN
      RAISE EXCEPTION 'Invalid adjustment item';
    END IF;

    SELECT coalesce((v_item->>'unit_cost')::numeric, pv.purchase_price, 0)
    INTO v_unit_cost
    FROM public.product_variants pv
    WHERE pv.id = v_variant_id AND pv.organization_id = v_org_id AND pv.deleted_at IS NULL;

    IF NOT FOUND THEN RAISE EXCEPTION 'Variant not found'; END IF;

    v_bal := public._ensure_inventory_balance(v_org_id, v_variant_id, v_location_id, v_profile_id);
    v_before := v_bal.quantity;
    v_delta := v_counted - v_before;

    INSERT INTO public.stock_adjustment_items (
      organization_id, adjustment_id, variant_id,
      quantity_before, quantity_counted, quantity_delta, unit_cost,
      created_by, updated_by
    ) VALUES (
      v_org_id, v_adj_id, v_variant_id,
      v_before, v_counted, v_delta, v_unit_cost,
      v_profile_id, v_profile_id
    );

    IF v_delta <> 0 THEN
      PERFORM public._adjust_inventory(
        v_org_id, v_branch_id, v_variant_id, v_location_id,
        v_delta, v_unit_cost, 'adjustment', 'stock_adjustment', v_adj_id,
        v_profile_id, NULLIF(payload->>'reason', '')
      );
      v_value_delta := v_value_delta + round(v_delta * v_unit_cost, 2);
    END IF;
  END LOOP;

  -- Optional journal when inventory value changes
  IF abs(v_value_delta) > 0.009 THEN
    v_inv_coa := public._coa_by_role(v_org_id, 'inventory_asset');
    v_exp_coa := public._coa_by_role(v_org_id, 'cogs');
    IF v_inv_coa IS NOT NULL AND v_exp_coa IS NOT NULL THEN
      v_entry_no := 'JE-ADJ-' || replace(v_adj_id::text, '-', '');
      INSERT INTO public.journal_entries (
        organization_id, branch_id, entry_no, entry_date, status,
        source_type, source_id, memo, posted_at, created_by, updated_by
      ) VALUES (
        v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
        'stock_adjustment', v_adj_id, 'Stock adjustment ' || v_adj_no,
        timezone('utc', now()), v_profile_id, v_profile_id
      )
      RETURNING id INTO v_journal_id;

      IF v_value_delta > 0 THEN
        INSERT INTO public.journal_lines (
          organization_id, journal_entry_id, chart_account_id,
          description, debit, credit, line_no, created_by, updated_by
        ) VALUES
          (v_org_id, v_journal_id, v_inv_coa, 'Inventory increase', v_value_delta, 0, 1, v_profile_id, v_profile_id),
          (v_org_id, v_journal_id, v_exp_coa, 'Adjustment offset', 0, v_value_delta, 2, v_profile_id, v_profile_id);
      ELSE
        INSERT INTO public.journal_lines (
          organization_id, journal_entry_id, chart_account_id,
          description, debit, credit, line_no, created_by, updated_by
        ) VALUES
          (v_org_id, v_journal_id, v_exp_coa, 'Inventory write-down', abs(v_value_delta), 0, 1, v_profile_id, v_profile_id),
          (v_org_id, v_journal_id, v_inv_coa, 'Inventory decrease', 0, abs(v_value_delta), 2, v_profile_id, v_profile_id);
      END IF;
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'inventory.adjust', 'stock_adjustment', v_adj_id,
    NULL,
    jsonb_build_object('adjustment_no', v_adj_no, 'value_delta', v_value_delta),
    NULLIF(payload->>'reason', ''),
    jsonb_build_object('source', 'create_stock_adjustment')
  );

  RETURN jsonb_build_object(
    'adjustment_id', v_adj_id,
    'adjustment_no', v_adj_no,
    'value_delta', v_value_delta,
    'journal_id', v_journal_id,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_adjustment(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_adjustment(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 10a. dispatch_stock_transfer
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_stock_transfer(transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_tr public.stock_transfers%ROWTYPE;
  v_item public.stock_transfer_items%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Missing permission inventory.transfer' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tr
  FROM public.stock_transfers st
  WHERE st.id = transfer_id AND st.organization_id = v_org_id AND st.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  IF NOT public.user_has_branch_access(v_tr.from_branch_id) THEN
    RAISE EXCEPTION 'No access to source branch' USING ERRCODE = '42501';
  END IF;

  IF v_tr.status = 'in_transit' THEN
    RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'in_transit', 'idempotent', true);
  END IF;

  IF v_tr.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transfers can be dispatched';
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_transfer_items sti
    WHERE sti.transfer_id = v_tr.id AND sti.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_tr.from_branch_id, v_item.variant_id, v_tr.from_location_id,
      -v_item.quantity_sent, v_item.unit_cost, 'transfer_out', 'stock_transfer', v_tr.id,
      v_profile_id, 'Dispatch transfer ' || v_tr.transfer_no
    );
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'in_transit',
      shipped_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_tr.id;

  PERFORM public.write_audit_log(
    v_org_id, v_tr.from_branch_id, v_profile_id,
    'inventory.transfer.dispatch', 'stock_transfer', v_tr.id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'in_transit'),
    NULL,
    jsonb_build_object('source', 'dispatch_stock_transfer')
  );

  RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'in_transit', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_stock_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_stock_transfer(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 10b. receive_stock_transfer(transfer_id, items jsonb)
-- items: [{ variant_id | id, quantity_received }]
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.receive_stock_transfer(transfer_id uuid, items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_tr public.stock_transfers%ROWTYPE;
  v_item jsonb;
  v_sti public.stock_transfer_items%ROWTYPE;
  v_recv numeric(14, 3);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Missing permission inventory.transfer' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tr
  FROM public.stock_transfers st
  WHERE st.id = transfer_id AND st.organization_id = v_org_id AND st.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  IF NOT public.user_has_branch_access(v_tr.to_branch_id) THEN
    RAISE EXCEPTION 'No access to destination branch' USING ERRCODE = '42501';
  END IF;

  IF v_tr.status = 'received' THEN
    RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'received', 'idempotent', true);
  END IF;

  IF v_tr.status <> 'in_transit' THEN
    RAISE EXCEPTION 'Only in_transit transfers can be received';
  END IF;

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'items with quantity_received is required';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_recv := (v_item->>'quantity_received')::numeric;
    IF v_recv IS NULL OR v_recv < 0 THEN
      RAISE EXCEPTION 'Invalid quantity_received';
    END IF;

    SELECT * INTO v_sti
    FROM public.stock_transfer_items sti
    WHERE sti.transfer_id = v_tr.id
      AND sti.deleted_at IS NULL
      AND (
        (v_item->>'id') IS NOT NULL AND sti.id = (v_item->>'id')::uuid
        OR (v_item->>'variant_id') IS NOT NULL AND sti.variant_id = (v_item->>'variant_id')::uuid
      )
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer item not found'; END IF;

    IF v_recv > v_sti.quantity_sent THEN
      RAISE EXCEPTION 'quantity_received cannot exceed quantity_sent';
    END IF;

    UPDATE public.stock_transfer_items
    SET quantity_received = v_recv,
        updated_by = v_profile_id
    WHERE id = v_sti.id;

    IF v_recv > 0 THEN
      PERFORM public._adjust_inventory(
        v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_tr.to_location_id,
        v_recv, v_sti.unit_cost, 'transfer_in', 'stock_transfer', v_tr.id,
        v_profile_id, 'Receive transfer ' || v_tr.transfer_no
      );
    END IF;
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'received',
      received_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_tr.id;

  PERFORM public.write_audit_log(
    v_org_id, v_tr.to_branch_id, v_profile_id,
    'inventory.transfer.receive', 'stock_transfer', v_tr.id,
    jsonb_build_object('status', 'in_transit'),
    jsonb_build_object('status', 'received', 'items', items),
    NULL,
    jsonb_build_object('source', 'receive_stock_transfer')
  );

  RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'received', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.receive_stock_transfer(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer(uuid, jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 11. post_manual_journal(payload jsonb)
-- { branch_id?, entry_date?, memo?, entry_no?,
--   lines: [{ chart_account_id, debit, credit, description?, financial_account_id?, line_no? }] }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_manual_journal(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_line jsonb;
  v_debit_sum numeric(14, 2) := 0;
  v_credit_sum numeric(14, 2) := 0;
  v_debit numeric(14, 2);
  v_credit numeric(14, 2);
  v_journal_id uuid;
  v_entry_no text;
  v_seq bigint;
  v_line_no int := 0;
  v_coa uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('accounts.post') THEN
    RAISE EXCEPTION 'Missing permission accounts.post' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(payload->'lines') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'lines') < 2 THEN
    RAISE EXCEPTION 'At least two journal lines are required';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(payload->'lines')
  LOOP
    v_debit := coalesce((v_line->>'debit')::numeric, 0);
    v_credit := coalesce((v_line->>'credit')::numeric, 0);
    IF v_debit < 0 OR v_credit < 0 THEN
      RAISE EXCEPTION 'debit/credit cannot be negative';
    END IF;
    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each line must have either debit or credit';
    END IF;
    v_coa := NULLIF(v_line->>'chart_account_id', '')::uuid;
    IF v_coa IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.chart_of_accounts c
      WHERE c.id = v_coa AND c.organization_id = v_org_id
        AND c.deleted_at IS NULL AND c.is_postable = true
    ) THEN
      RAISE EXCEPTION 'Invalid chart_account_id';
    END IF;
    v_debit_sum := v_debit_sum + v_debit;
    v_credit_sum := v_credit_sum + v_credit;
  END LOOP;

  IF abs(v_debit_sum - v_credit_sum) > 0.009 THEN
    RAISE EXCEPTION 'Journal not balanced: debit % credit %', v_debit_sum, v_credit_sum;
  END IF;

  v_entry_no := NULLIF(btrim(payload->>'entry_no'), '');
  IF v_entry_no IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':manual_je'));
    SELECT coalesce(max(
      NULLIF(regexp_replace(je.entry_no, '[^0-9]', '', 'g'), '')::bigint
    ), 0) + 1 INTO v_seq
    FROM public.journal_entries je
    WHERE je.organization_id = v_org_id AND je.deleted_at IS NULL
      AND je.entry_no LIKE 'JE-M-%';
    v_entry_no := 'JE-M-' || lpad(v_seq::text, 6, '0');
  END IF;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_no, entry_date, status,
    source_type, memo, posted_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_entry_no,
    coalesce((payload->>'entry_date')::date, (timezone('utc', now()))::date),
    'posted', 'manual', NULLIF(payload->>'memo', ''),
    timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_journal_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(payload->'lines')
  LOOP
    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id, financial_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id,
      (v_line->>'chart_account_id')::uuid,
      NULLIF(v_line->>'financial_account_id', '')::uuid,
      NULLIF(v_line->>'description', ''),
      coalesce((v_line->>'debit')::numeric, 0),
      coalesce((v_line->>'credit')::numeric, 0),
      coalesce((v_line->>'line_no')::int, v_line_no),
      v_profile_id, v_profile_id
    );
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'journal.post', 'journal_entry', v_journal_id,
    NULL,
    jsonb_build_object('entry_no', v_entry_no, 'debit_sum', v_debit_sum, 'credit_sum', v_credit_sum),
    NULLIF(payload->>'memo', ''),
    jsonb_build_object('source', 'post_manual_journal')
  );

  RETURN jsonb_build_object(
    'journal_id', v_journal_id,
    'entry_no', v_entry_no,
    'debit_sum', v_debit_sum,
    'credit_sum', v_credit_sum
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_manual_journal(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_manual_journal(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 12. complete_accounting_setup(payload jsonb)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_accounting_setup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_assets uuid;
  v_liab uuid;
  v_equity uuid;
  v_revenue uuid;
  v_expense uuid;
  v_cash_coa uuid;
  v_bank_coa uuid;
  v_mm_coa uuid;
  v_hq uuid;
  v_cash_fa uuid;
  v_bank_fa uuid;
  v_bkash_fa uuid;
  v_year int := extract(year from timezone('utc', now()))::int;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('settings.manage')
    OR public.user_has_permission('accounts.post')
  ) THEN
    RAISE EXCEPTION 'Missing permission settings.manage or accounts.post' USING ERRCODE = '42501';
  END IF;

  -- Ensure account groups
  INSERT INTO public.account_groups (organization_id, name, account_class, sort_order)
  SELECT v_org_id, g.name, g.account_class, g.sort_order
  FROM (VALUES
    ('Assets', 'asset', 10),
    ('Liabilities', 'liability', 20),
    ('Equity', 'equity', 30),
    ('Revenue', 'revenue', 40),
    ('Expenses', 'expense', 50)
  ) AS g(name, account_class, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.account_groups ag
    WHERE ag.organization_id = v_org_id AND lower(ag.name) = lower(g.name) AND ag.deleted_at IS NULL
  );

  SELECT id INTO v_assets FROM public.account_groups
  WHERE organization_id = v_org_id AND account_class = 'asset' AND deleted_at IS NULL ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_liab FROM public.account_groups
  WHERE organization_id = v_org_id AND account_class = 'liability' AND deleted_at IS NULL ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_equity FROM public.account_groups
  WHERE organization_id = v_org_id AND account_class = 'equity' AND deleted_at IS NULL ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_revenue FROM public.account_groups
  WHERE organization_id = v_org_id AND account_class = 'revenue' AND deleted_at IS NULL ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_expense FROM public.account_groups
  WHERE organization_id = v_org_id AND account_class = 'expense' AND deleted_at IS NULL ORDER BY sort_order LIMIT 1;

  -- Upsert chart defaults by system_role
  INSERT INTO public.chart_of_accounts (
    organization_id, group_id, code, name, account_type, system_role, is_postable
  )
  SELECT v_org_id, x.group_id, x.code, x.name, x.account_type, x.system_role, true
  FROM (VALUES
    (v_assets, '1000', 'Cash on Hand', 'asset', 'cash'),
    (v_assets, '1010', 'Bank Account', 'asset', 'bank'),
    (v_assets, '1020', 'bKash / Mobile Money', 'asset', 'mobile_money'),
    (v_assets, '1100', 'Accounts Receivable', 'asset', 'receivable'),
    (v_assets, '1200', 'Inventory Asset', 'asset', 'inventory_asset'),
    (v_liab, '2000', 'Accounts Payable', 'liability', 'payable'),
    (v_liab, '2100', 'Tax Payable', 'liability', 'tax_payable'),
    (v_liab, '2200', 'Refund Payable', 'liability', 'refund_payable'),
    (v_revenue, '4000', 'Sales Revenue', 'revenue', 'sales_revenue'),
    (v_revenue, '4100', 'Sales Returns', 'revenue', 'sales_return'),
    (v_expense, '5000', 'Cost of Goods Sold', 'expense', 'cogs'),
    (v_expense, '5100', 'Purchases', 'expense', 'purchase'),
    (v_assets, '1300', 'Tax Receivable', 'asset', 'tax_receivable')
  ) AS x(group_id, code, name, account_type, system_role)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = v_org_id AND c.system_role = x.system_role AND c.deleted_at IS NULL
  );

  SELECT id INTO v_cash_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'cash' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_bank_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'bank' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_mm_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'mobile_money' AND deleted_at IS NULL LIMIT 1;

  SELECT id INTO v_hq FROM public.branches
  WHERE organization_id = v_org_id AND is_central = true AND deleted_at IS NULL LIMIT 1;

  -- Financial accounts: cash / bank / bkash
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'petty cash' AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.financial_accounts (
      organization_id, branch_id, chart_account_id, name, account_kind,
      currency, opening_balance, current_balance, is_default
    ) VALUES (
      v_org_id, v_hq, v_cash_coa, 'Petty Cash', 'cash', 'BDT',
      coalesce((payload->>'cash_opening')::numeric, 0),
      coalesce((payload->>'cash_opening')::numeric, 0), true
    )
    RETURNING id INTO v_cash_fa;
  ELSE
    SELECT id INTO v_cash_fa FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'petty cash' AND deleted_at IS NULL LIMIT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'main bank' AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.financial_accounts (
      organization_id, branch_id, chart_account_id, name, account_kind,
      currency, opening_balance, current_balance, is_default
    ) VALUES (
      v_org_id, v_hq, v_bank_coa, 'Main Bank', 'bank', 'BDT',
      coalesce((payload->>'bank_opening')::numeric, 0),
      coalesce((payload->>'bank_opening')::numeric, 0), false
    )
    RETURNING id INTO v_bank_fa;
  ELSE
    SELECT id INTO v_bank_fa FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'main bank' AND deleted_at IS NULL LIMIT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'bkash' AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.financial_accounts (
      organization_id, branch_id, chart_account_id, name, account_kind,
      currency, opening_balance, current_balance, is_default
    ) VALUES (
      v_org_id, v_hq, v_mm_coa, 'bKash', 'mobile_money', 'BDT',
      coalesce((payload->>'bkash_opening')::numeric, 0),
      coalesce((payload->>'bkash_opening')::numeric, 0), false
    )
    RETURNING id INTO v_bkash_fa;
  ELSE
    SELECT id INTO v_bkash_fa FROM public.financial_accounts
    WHERE organization_id = v_org_id AND lower(name) = 'bkash' AND deleted_at IS NULL LIMIT 1;
  END IF;

  -- Default payment methods
  INSERT INTO public.payment_methods (organization_id, code, name, financial_account_id, is_due, sort_order)
  SELECT v_org_id, x.code, x.name, x.fa, x.is_due, x.sort_order
  FROM (VALUES
    ('cash', 'Cash', v_cash_fa, false, 10),
    ('bank', 'Bank Transfer', v_bank_fa, false, 20),
    ('bkash', 'bKash', v_bkash_fa, false, 30),
    ('due', 'Due / Credit', NULL::uuid, true, 40)
  ) AS x(code, name, fa, is_due, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id AND lower(pm.code) = x.code AND pm.deleted_at IS NULL
  );

  -- Current year financial period
  IF NOT EXISTS (
    SELECT 1 FROM public.financial_periods
    WHERE organization_id = v_org_id AND is_current = true AND deleted_at IS NULL
  ) THEN
    INSERT INTO public.financial_periods (
      organization_id, name, start_date, end_date, status, is_current
    ) VALUES (
      v_org_id,
      'FY ' || v_year,
      make_date(v_year, 1, 1),
      make_date(v_year, 12, 31),
      'open', true
    );
  END IF;

  UPDATE public.organizations
  SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
    'accounting_setup_complete', true,
    'currency', coalesce(payload->>'currency', 'BDT')
  ),
  currency = coalesce(NULLIF(payload->>'currency', ''), currency),
  updated_at = timezone('utc', now())
  WHERE id = v_org_id;

  PERFORM public.write_audit_log(
    v_org_id, v_hq, v_profile_id,
    'accounting.setup', 'organization', v_org_id,
    NULL,
    jsonb_build_object(
      'cash_fa', v_cash_fa,
      'bank_fa', v_bank_fa,
      'bkash_fa', v_bkash_fa
    ),
    NULL,
    jsonb_build_object('source', 'complete_accounting_setup')
  );

  RETURN jsonb_build_object(
    'accounting_setup_complete', true,
    'cash_account_id', v_cash_fa,
    'bank_account_id', v_bank_fa,
    'bkash_account_id', v_bkash_fa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_accounting_setup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_accounting_setup(jsonb) TO authenticated;

