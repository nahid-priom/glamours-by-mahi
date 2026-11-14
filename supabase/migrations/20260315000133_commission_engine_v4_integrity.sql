-- Commission Engine V4.0 P0+P1 integrity
-- - Residual reverse helper for void/edit
-- - void_sale / edit_sale reverse remaining commissions
-- - Deduplicate POS accrual (trigger authoritative; link employees after resolve)
-- - Fixed per-sale: skip reverse on partial return
-- - Paid reverse: recoverable obligation, no phantom cash/bank

--------------------------------------------------------------------------------
-- Schema additions
--------------------------------------------------------------------------------
ALTER TABLE public.salesman_commissions
  ADD COLUMN IF NOT EXISTS recoverable_amount numeric(14, 2) NOT NULL DEFAULT 0
    CHECK (recoverable_amount >= 0);

CREATE TABLE IF NOT EXISTS public.commission_attribution_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id),
  reason text NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS commission_attribution_exceptions_sale_open_uidx
  ON public.commission_attribution_exceptions (sale_id)
  WHERE deleted_at IS NULL AND resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS commission_attribution_exceptions_org_idx
  ON public.commission_attribution_exceptions (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.commission_attribution_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commission_attribution_exceptions_select ON public.commission_attribution_exceptions;
CREATE POLICY commission_attribution_exceptions_select ON public.commission_attribution_exceptions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('sales.commission.read')
      OR public.user_has_permission('hr.employees.read')
      OR public.user_has_permission('*')
    )
  );

--------------------------------------------------------------------------------
-- Helper: is commission fixed per-sale from rule_snapshot
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._commission_is_fixed_per_sale(p_snapshot jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(
    (p_snapshot->>'structure_mode') = 'per_sale'
      AND lower(coalesce(p_snapshot->>'rule_type', '')) = 'fixed',
    false
  );
$$;

--------------------------------------------------------------------------------
-- Apply contributor reversals — no phantom cash; track recoverable
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_contributor_commission_reversals(
  p_sale_id uuid,
  p_source_id uuid,
  p_marker_prefix text,
  p_source_type text,
  p_contributor_bases jsonb,
  p_fallback_total numeric DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_comm public.salesman_commissions%ROWTYPE;
  v_marker_token text;
  v_returned_base numeric(14, 2);
  v_ratio numeric(14, 6);
  v_reverse numeric(14, 2);
  v_remaining numeric(14, 2);
  v_original numeric(14, 2);
  v_active_base numeric(14, 2);
  v_has_contributor_map boolean := false;
  v_fallback_ratio numeric(14, 6);
  v_actor uuid := coalesce(p_actor, public.current_profile_id());
  v_is_full boolean := false;
  v_returned_sale_total numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_marker_token := p_marker_prefix || p_source_id::text;

  IF jsonb_typeof(p_contributor_bases) = 'array'
     AND jsonb_array_length(p_contributor_bases) > 0 THEN
    v_has_contributor_map := true;
  END IF;

  IF NOT v_has_contributor_map THEN
    IF coalesce(p_fallback_total, 0) <= 0 OR coalesce(v_sale.grand_total, 0) <= 0 THEN
      RETURN;
    END IF;
    v_fallback_ratio := least(greatest(p_fallback_total / v_sale.grand_total, 0), 1);
    v_is_full := v_fallback_ratio >= 0.999;
  ELSE
    SELECT coalesce(sum((e.elem->>'returned_base')::numeric), 0)
    INTO v_returned_sale_total
    FROM jsonb_array_elements(p_contributor_bases) AS e(elem);
    v_is_full := coalesce(v_sale.grand_total, 0) > 0
      AND v_returned_sale_total >= (v_sale.grand_total * 0.999);
  END IF;

  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND sc.status IN ('pending', 'approved', 'paid')
    FOR UPDATE
  LOOP
    IF coalesce(v_comm.notes, '') LIKE '%' || v_marker_token || '%' THEN
      CONTINUE;
    END IF;

    -- Policy 2A: fixed per-sale reverses only on full return/void (ratio ~1)
    IF p_source_type = 'sale_return'
       AND public._commission_is_fixed_per_sale(v_comm.rule_snapshot)
       AND NOT v_is_full THEN
      CONTINUE;
    END IF;

    v_original := coalesce(
      v_comm.original_commission_amount,
      v_comm.commission_amount + coalesce(v_comm.reversed_amount, 0)
    );
    IF v_comm.original_commission_amount IS NULL THEN
      UPDATE public.salesman_commissions
      SET original_commission_amount = v_original
      WHERE id = v_comm.id;
    END IF;

    v_remaining := greatest(v_comm.commission_amount, 0);
    IF v_remaining <= 0 THEN
      CONTINUE;
    END IF;

    v_ratio := 0;
    v_returned_base := 0;

    IF v_has_contributor_map THEN
      SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
      INTO v_returned_base
      FROM jsonb_array_elements(p_contributor_bases) AS e(elem)
      WHERE NULLIF(e.elem->>'profile_id', '')::uuid IS NOT DISTINCT FROM v_comm.profile_id
      LIMIT 1;

      IF coalesce(v_returned_base, 0) <= 0 THEN
        CONTINUE;
      END IF;

      v_active_base := nullif(v_comm.base_amount, 0);
      IF v_active_base IS NULL THEN
        SELECT coalesce(sum(si.line_total), 0) INTO v_active_base
        FROM public.sale_items si
        WHERE si.sale_id = p_sale_id
          AND si.deleted_at IS NULL
          AND coalesce(si.contributor_profile_id, si.created_by) = v_comm.profile_id;
      END IF;

      IF coalesce(v_active_base, 0) <= 0 THEN
        CONTINUE;
      END IF;

      v_ratio := least(greatest(v_returned_base / v_active_base, 0), 1);
    ELSE
      v_ratio := v_fallback_ratio;
      v_returned_base := round(coalesce(v_comm.base_amount, 0) * v_ratio, 2);
    END IF;

    v_reverse := round(v_remaining * v_ratio, 2);
    IF v_reverse <= 0 THEN
      CONTINUE;
    END IF;

    -- Paid: track recoverable overpayment — do NOT fabricate cash/bank in
    UPDATE public.salesman_commissions
    SET original_commission_amount = v_original,
        reversed_amount = coalesce(reversed_amount, 0) + v_reverse,
        commission_amount = greatest(commission_amount - v_reverse, 0),
        base_amount = greatest(base_amount - coalesce(v_returned_base, 0), 0),
        recoverable_amount = CASE
          WHEN v_comm.status = 'paid' THEN coalesce(recoverable_amount, 0) + v_reverse
          ELSE coalesce(recoverable_amount, 0)
        END,
        status = CASE
          WHEN commission_amount - v_reverse <= 0 THEN 'reversed'
          ELSE status
        END,
        notes = trim(both FROM coalesce(notes, '') || ' '
          || v_marker_token || ':' || v_reverse::text || ':' || v_comm.status
          || CASE WHEN v_comm.status = 'paid' THEN ':recoverable' ELSE '' END),
        sale_return_id = CASE
          WHEN p_source_type = 'sale_return' THEN p_source_id
          ELSE sale_return_id
        END,
        updated_at = timezone('utc', now()),
        updated_by = v_actor
    WHERE id = v_comm.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._apply_contributor_commission_reversals(uuid, uuid, text, text, jsonb, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._apply_contributor_commission_reversals(uuid, uuid, text, text, jsonb, numeric, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Reverse ALL remaining commission entitlement for a sale (void / edit)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reverse_remaining_sale_commissions(
  p_sale_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_reason text DEFAULT NULL,
  p_actor uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_bases jsonb;
  v_before numeric(14, 2) := 0;
  v_after numeric(14, 2) := 0;
  v_actor uuid := coalesce(p_actor, public.current_profile_id());
  v_marker text;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT coalesce(sum(commission_amount), 0) INTO v_before
  FROM public.salesman_commissions
  WHERE sale_id = p_sale_id
    AND deleted_at IS NULL
    AND status IN ('pending', 'approved', 'paid');

  IF v_before <= 0 THEN
    RETURN 0;
  END IF;

  v_marker := CASE
    WHEN p_source_type = 'sale_void' THEN 'voided:'
    WHEN p_source_type = 'sale_edit' THEN 'corrected:'
    ELSE coalesce(p_source_type, 'reverse') || ':'
  END;

  SELECT coalesce(jsonb_agg(
           jsonb_build_object(
             'profile_id', x.profile_id,
             'returned_base', x.base_amount
           )
         ), '[]'::jsonb)
  INTO v_bases
  FROM (
    SELECT
      sc.profile_id,
      greatest(sum(sc.base_amount), sum(sc.commission_amount), 0.01) AS base_amount
    FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND sc.status IN ('pending', 'approved', 'paid')
      AND sc.profile_id IS NOT NULL
    GROUP BY sc.profile_id
  ) x;

  IF jsonb_array_length(v_bases) > 0 THEN
    PERFORM public._apply_contributor_commission_reversals(
      p_sale_id,
      p_source_id,
      v_marker,
      p_source_type,
      v_bases,
      NULL,
      v_actor
    );
  ELSE
    PERFORM public._apply_contributor_commission_reversals(
      p_sale_id,
      p_source_id,
      v_marker,
      p_source_type,
      '[]'::jsonb,
      greatest(v_sale.grand_total, v_before),
      v_actor
    );
  END IF;

  SELECT coalesce(sum(commission_amount), 0) INTO v_after
  FROM public.salesman_commissions
  WHERE sale_id = p_sale_id
    AND deleted_at IS NULL
    AND status IN ('pending', 'approved', 'paid');

  RETURN greatest(v_before - v_after, 0);
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_remaining_sale_commissions(uuid, text, uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_remaining_sale_commissions(uuid, text, uuid, text, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Link employee ids on commissions after POS resolves salesperson
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._link_sale_commission_employees(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN; END IF;

  IF v_sale.salesperson_employee_id IS NOT NULL THEN
    UPDATE public.salesman_commissions sc
    SET employee_id = coalesce(sc.employee_id, v_sale.salesperson_employee_id),
        needs_employee_link = false,
        updated_at = timezone('utc', now())
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND (
        sc.employee_id IS NULL
        OR sc.needs_employee_link = true
      )
      AND (
        sc.profile_id IS NOT DISTINCT FROM v_sale.salesperson_id
        OR sc.profile_id IS NOT DISTINCT FROM v_sale.created_by
      );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._link_sale_commission_employees(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._link_sale_commission_employees(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Record unresolved attribution after completed sale (allow sale; flag for HR)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._record_commission_attribution_exception(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_has_comm boolean;
  v_has_subject boolean;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_sale.status <> 'completed' THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id AND sc.deleted_at IS NULL
  ) INTO v_has_comm;

  IF v_has_comm THEN
    RETURN;
  END IF;

  v_has_subject := (
    v_sale.salesperson_employee_id IS NOT NULL
    OR v_sale.salesperson_id IS NOT NULL
    OR v_sale.moderator_id IS NOT NULL
    OR v_sale.tele_salesman_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM public.sale_items si
      WHERE si.sale_id = p_sale_id
        AND si.deleted_at IS NULL
        AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    )
  );

  IF EXISTS (
    SELECT 1 FROM public.commission_attribution_exceptions e
    WHERE e.sale_id = p_sale_id AND e.deleted_at IS NULL AND e.resolved_at IS NULL
  ) THEN
    RETURN;
  END IF;

  IF NOT v_has_subject THEN
    INSERT INTO public.commission_attribution_exceptions (
      organization_id, branch_id, sale_id, reason, created_by
    )
    VALUES (
      v_sale.organization_id,
      v_sale.branch_id,
      v_sale.id,
      'No resolvable commission contributor (employee/profile) on completed sale',
      v_sale.created_by
    );
  ELSE
    INSERT INTO public.commission_attribution_exceptions (
      organization_id, branch_id, sale_id, reason, created_by
    )
    VALUES (
      v_sale.organization_id,
      v_sale.branch_id,
      v_sale.id,
      'Completed sale has contributor but no commission accrued (no matching active rule)',
      v_sale.created_by
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._record_commission_attribution_exception(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._record_commission_attribution_exception(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Trigger: after accrue attempt, record exception if still empty
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sales_completed_accrue_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public._accrue_sale_commission(NEW.id);
    PERFORM public._record_commission_attribution_exception(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

--------------------------------------------------------------------------------
-- complete_pos_sale: keep financial txn posting; remove duplicate accrue
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_pos_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_sale_id uuid;
  v_idempotent boolean;
  r record;
  v_is_due boolean;
  v_branch_id uuid;
  v_sp record;
BEGIN
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;

  v_result := public._complete_pos_sale_core(payload);
  v_sale_id := NULLIF(v_result->>'sale_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_sale_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_sp
  FROM public._resolve_pos_salesperson(payload, v_branch_id);

  UPDATE public.sales s
  SET salesperson_employee_id = v_sp.employee_id,
      salesperson_id = coalesce(v_sp.profile_id, s.salesperson_id),
      updated_at = timezone('utc', now())
  WHERE s.id = v_sale_id;

  -- Link employee on commissions already accrued by completed trigger
  PERFORM public._link_sale_commission_employees(v_sale_id);
  PERFORM public._record_commission_attribution_exception(v_sale_id);

  FOR r IN
    SELECT
      sp.amount,
      sp.method,
      sp.financial_account_id,
      sp.reference,
      s.organization_id,
      s.branch_id,
      s.invoice_no,
      s.created_by
    FROM public.sale_payments sp
    JOIN public.sales s ON s.id = sp.sale_id
    WHERE sp.sale_id = v_sale_id
      AND sp.financial_account_id IS NOT NULL
      AND sp.deleted_at IS NULL
    ORDER BY sp.created_at ASC, sp.id ASC
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = r.organization_id
      AND lower(pm.code) = lower(r.method)
      AND pm.deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      v_is_due := (lower(r.method) IN ('due', 'credit', 'receivable'));
    END IF;

    IF v_is_due THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.source_type = 'sale'
        AND ft.source_id = v_sale_id
        AND ft.account_id = r.financial_account_id
        AND ft.amount = r.amount
        AND ft.status = 'posted'
        AND ft.deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public._post_financial_txn(
      r.organization_id,
      r.branch_id,
      r.financial_account_id,
      'sale_payment',
      'in',
      r.amount,
      'sale',
      v_sale_id,
      coalesce(r.reference, r.invoice_no),
      'Sale payment ' || coalesce(r.invoice_no, ''),
      r.created_by,
      false
    );
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- void_sale: reverse remaining commissions
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
  v_sale_date date;
  v_comm_reversed numeric(14, 2) := 0;
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

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  PERFORM public._assert_sale_period_open(v_org_id, v_sale_date);

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

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

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL AND sp.reversed_at IS NULL
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

    UPDATE public.sale_payments
    SET reversed_at = timezone('utc', now()),
        reversal_note = btrim(reason),
        updated_by = v_profile_id
    WHERE id = v_payment.id;
  END LOOP;

  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, btrim(reason));
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
    v_profile_id
  );

  v_comm_reversed := public._reverse_remaining_sale_commissions(
    v_sale.id, 'sale_void', v_sale.id, btrim(reason), v_profile_id
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
    jsonb_build_object(
      'status', 'voided',
      'reason', btrim(reason),
      'reversing_journal_id', v_rev_journal,
      'commission_reversed', v_comm_reversed
    ),
    btrim(reason),
    jsonb_build_object('source', 'void_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'status', 'voided',
    'reversing_journal_id', v_rev_journal,
    'cogs_reversed', v_cogs_total,
    'commission_reversed', v_comm_reversed
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- edit_sale: reverse remaining commissions before replacement accrues
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.edit_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale_id uuid;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_location_id uuid;
  v_is_due boolean;
  v_rev_journal uuid;
  v_new_sale jsonb;
  v_new_sale_id uuid;
  v_merged_payload jsonb;
  v_reason text;
  v_client_txn_key text;
  v_sale_date date;
  v_existing uuid;
  v_comm_reversed numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.update')
    OR public.user_has_permission('sales.correct')
  ) THEN
    RAISE EXCEPTION 'Missing permission sales.update' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_reason := NULLIF(btrim(coalesce(payload->>'reason', '')), '');
  v_client_txn_key := NULLIF(btrim(coalesce(payload->>'client_txn_key', '')), '');

  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Edit reason is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;

  SELECT s.id INTO v_existing
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'original_sale_id', v_sale_id,
      'new_sale_id', v_existing,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be edited';
  END IF;

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  PERFORM public._assert_sale_period_open(v_org_id, v_sale_date);

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

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
    v_reason,
    v_profile_id, v_profile_id
  );

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN
    SELECT * FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      v_item.qty, v_item.cost_price, 'correction', 'sale', v_sale.id,
      v_profile_id, 'Edit reverse restock'
    );
  END LOOP;

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL AND sp.reversed_at IS NULL
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
    UPDATE public.sale_payments
    SET reversed_at = timezone('utc', now()),
        reversal_note = v_reason,
        updated_by = v_profile_id
    WHERE id = v_payment.id;
  END LOOP;

  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, v_reason);
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Edit reverse ' || v_sale.invoice_no || ': ' || v_reason,
    v_profile_id
  );

  -- Reverse residual commission on original BEFORE replacement accrues
  v_comm_reversed := public._reverse_remaining_sale_commissions(
    v_sale.id, 'sale_edit', v_sale.id, v_reason, v_profile_id
  );

  UPDATE public.sales
  SET status = 'corrected',
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  v_merged_payload := jsonb_build_object(
    'branch_id', v_sale.branch_id,
    'customer_id', coalesce(NULLIF(payload->>'customer_id', '')::uuid, v_sale.customer_id),
    'client_txn_key', v_client_txn_key,
    'note', coalesce(payload->>'note', payload->>'reason'),
    'discount', coalesce((payload->>'discount')::numeric, 0),
    'tax', coalesce((payload->>'tax')::numeric, v_sale.tax),
    'shipping', coalesce((payload->>'shipping')::numeric, v_sale.shipping),
    'items', payload->'items',
    'payments', coalesce(payload->'payments', '[]'::jsonb)
  );

  PERFORM set_config('app.skip_pos_permission', '1', true);
  v_new_sale := public.complete_pos_sale(v_merged_payload);
  v_new_sale_id := (v_new_sale->>'sale_id')::uuid;

  UPDATE public.sales
  SET previous_sale_id = v_sale.id,
      corrected_from_id = v_sale.id,
      version = v_sale.version + 1,
      updated_by = v_profile_id
  WHERE id = v_new_sale_id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.edit', 'sale', v_sale.id,
    jsonb_build_object(
      'status', 'completed',
      'grand_total', v_sale.grand_total,
      'paid_total', v_sale.paid_total,
      'due_total', v_sale.due_total
    ),
    jsonb_build_object(
      'status', 'corrected',
      'new_sale_id', v_new_sale_id,
      'new_invoice_no', v_new_sale->>'invoice_no',
      'new_grand_total', v_new_sale->>'grand_total',
      'reason', v_reason,
      'note', payload->>'note',
      'commission_reversed', v_comm_reversed
    ),
    v_reason,
    jsonb_build_object('source', 'edit_sale')
  );

  RETURN jsonb_build_object(
    'original_sale_id', v_sale.id,
    'new_sale_id', v_new_sale_id,
    'new_invoice_no', v_new_sale->>'invoice_no',
    'reversing_journal_id', v_rev_journal,
    'commission_reversed', v_comm_reversed,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.edit_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_sale(jsonb) TO authenticated;
