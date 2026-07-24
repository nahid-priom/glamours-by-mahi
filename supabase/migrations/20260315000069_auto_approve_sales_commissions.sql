-- Auto-approve commissions when accrued from active rules (no manual approval step).

-- Backfill existing pending commissions
UPDATE public.salesman_commissions
SET
  status = 'approved',
  approved_at = COALESCE(approved_at, created_at),
  updated_at = timezone('utc', now())
WHERE status = 'pending'
  AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Accrual: create as approved immediately
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accrue_sale_commission(p_sale_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_rule public.salesman_commission_rules%ROWTYPE;
  v_cogs numeric(14, 2) := 0;
  v_amount numeric(14, 2) := 0;
  v_commission_id uuid;
  v_key text;
  v_sale_date date;
  v_employee_id uuid;
  v_profile_id uuid;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  v_employee_id := v_sale.salesperson_employee_id;
  v_profile_id := v_sale.salesperson_id;

  IF v_employee_id IS NULL AND v_profile_id IS NOT NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.profile_id = v_profile_id
      AND e.organization_id = v_sale.organization_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated'
    ORDER BY e.created_at ASC
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND v_employee_id IS NOT NULL THEN
    SELECT e.profile_id INTO v_profile_id
    FROM public.employees e
    WHERE e.id = v_employee_id;
  END IF;

  IF v_employee_id IS NULL AND v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  v_key := 'sale-comm:' || p_sale_id::text;

  IF EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = v_sale.organization_id
      AND sc.client_txn_key = v_key
      AND sc.deleted_at IS NULL
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = v_sale.organization_id
      AND client_txn_key = v_key AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  SELECT * INTO v_rule
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_sale.organization_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND r.rule_type <> 'none'
    AND r.rate > 0
    AND r.effective_from <= v_sale_date
    AND (r.effective_to IS NULL OR r.effective_to >= v_sale_date)
    AND (r.branch_id IS NULL OR r.branch_id = v_sale.branch_id)
    AND (
      (v_employee_id IS NOT NULL AND r.employee_id = v_employee_id)
      OR (v_profile_id IS NOT NULL AND r.profile_id = v_profile_id AND r.employee_id IS NULL)
      OR (v_profile_id IS NOT NULL AND r.profile_id = v_profile_id)
    )
  ORDER BY
    CASE WHEN r.employee_id IS NOT NULL THEN 0 ELSE 1 END,
    r.branch_id NULLS LAST,
    r.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT COALESCE(sum(round(si.qty * si.cost_price, 2)), 0) INTO v_cogs
  FROM public.sale_items si
  WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL;

  v_amount := CASE v_rule.rule_type
    WHEN 'fixed' THEN v_rule.rate
    WHEN 'percent_sale' THEN round(v_sale.grand_total * (v_rule.rate / 100.0), 2)
    WHEN 'percent_profit' THEN round(GREATEST(v_sale.grand_total - v_cogs, 0) * (v_rule.rate / 100.0), 2)
    ELSE 0
  END;

  IF v_amount <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.salesman_commissions (
    organization_id, branch_id, profile_id, employee_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    approved_at, approved_by,
    client_txn_key, rule_snapshot, needs_employee_link, created_by, updated_by
  ) VALUES (
    v_sale.organization_id, v_sale.branch_id, v_profile_id, v_employee_id, p_sale_id,
    v_sale.grand_total, v_cogs, v_amount, 'approved',
    v_now, v_sale.created_by,
    v_key,
    jsonb_build_object(
      'rule_id', v_rule.id,
      'rule_type', v_rule.rule_type,
      'rate', v_rule.rate,
      'effective_from', v_rule.effective_from,
      'employee_id', v_rule.employee_id
    ),
    (v_employee_id IS NULL AND v_profile_id IS NOT NULL),
    v_sale.created_by, v_sale.created_by
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

--------------------------------------------------------------------------------
-- Allow payment from approved (and legacy pending) without a separate approve step
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_sales_commission(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_commission_id uuid;
  v_client_txn_key text;
  v_fin_acct uuid;
  v_row public.salesman_commissions%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.pay') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.pay' USING ERRCODE = '42501';
  END IF;

  v_commission_id := NULLIF(payload->>'commission_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_fin_acct := NULLIF(payload->>'financial_account_id', '')::uuid;

  IF v_commission_id IS NULL OR v_client_txn_key IS NULL OR v_fin_acct IS NULL THEN
    RAISE EXCEPTION 'commission_id, client_txn_key and financial_account_id are required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.financial_transactions ft
    WHERE ft.source_type = 'salesman_commission'
      AND ft.source_id = v_commission_id
      AND ft.status = 'posted'
      AND ft.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('commission_id', v_commission_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_commissions sc
  WHERE sc.id = v_commission_id
    AND sc.organization_id = v_org_id
    AND sc.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found'; END IF;
  IF v_row.status = 'paid' THEN
    RETURN jsonb_build_object('commission_id', v_row.id, 'idempotent', true);
  END IF;
  IF v_row.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Commission cannot be paid from status %', v_row.status;
  END IF;

  IF v_row.status = 'pending' THEN
    UPDATE public.salesman_commissions
    SET status = 'approved',
        approved_at = v_now,
        approved_by = v_profile_id,
        updated_by = v_profile_id
    WHERE id = v_row.id;
  END IF;

  PERFORM public._post_financial_txn(
    v_org_id,
    v_row.branch_id,
    v_fin_acct,
    'commission_payment',
    'out',
    v_row.commission_amount,
    'salesman_commission',
    v_row.id,
    'Commission payment',
    COALESCE(NULLIF(payload->>'notes', ''), 'Sales commission payment'),
    v_profile_id,
    true
  );

  UPDATE public.salesman_commissions
  SET status = 'paid',
      paid_at = v_now,
      financial_account_id = v_fin_acct,
      notes = COALESCE(notes, '') || ' paid:' || v_client_txn_key,
      updated_by = v_profile_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object('commission_id', v_row.id, 'status', 'paid', 'idempotent', false);
END;
$$;
