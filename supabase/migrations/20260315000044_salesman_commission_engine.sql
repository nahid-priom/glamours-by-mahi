-- Salesman commission accrual, approval, payment, and return reversal

INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('sales.commission.read', 'View salesperson commissions'),
  ('sales.commission.approve', 'Approve salesperson commissions'),
  ('sales.commission.pay', 'Pay salesperson commissions')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = x.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)
  AND p.key IN ('sales.commission.read', 'sales.commission.approve', 'sales.commission.pay')
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

CREATE TABLE IF NOT EXISTS public.salesman_commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  rule_type text NOT NULL DEFAULT 'none'
    CHECK (rule_type IN ('fixed', 'percent_sale', 'percent_profit', 'none')),
  rate numeric(14, 4) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT salesman_commission_rules_rate_non_negative CHECK (rate >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS salesman_commission_rules_org_profile_active_uidx
  ON public.salesman_commission_rules (organization_id, profile_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.salesman_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  profile_id uuid NOT NULL REFERENCES public.profiles (id),
  sale_id uuid REFERENCES public.sales (id),
  sale_return_id uuid REFERENCES public.sale_returns (id),
  base_amount numeric(14, 2) NOT NULL DEFAULT 0,
  cogs_amount numeric(14, 2) NOT NULL DEFAULT 0,
  commission_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'reversed', 'cancelled')),
  client_txn_key text,
  approved_by uuid REFERENCES public.profiles (id),
  approved_at timestamptz,
  paid_at timestamptz,
  financial_account_id uuid REFERENCES public.financial_accounts (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS salesman_commissions_org_client_txn_active_uidx
  ON public.salesman_commissions (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS salesman_commissions_org_profile_status_idx
  ON public.salesman_commissions (organization_id, profile_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.salesman_commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salesman_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY salesman_commission_rules_select ON public.salesman_commission_rules
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND public.user_has_permission('sales.commission.read')
  );

CREATE POLICY salesman_commissions_select ON public.salesman_commissions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND public.user_has_permission('sales.commission.read')
  );

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
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.salesperson_id IS NULL OR v_sale.status <> 'completed' THEN
    RETURN NULL;
  END IF;

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
      AND client_txn_key = v_key
      AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  SELECT * INTO v_rule
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_sale.organization_id
    AND r.profile_id = v_sale.salesperson_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND OR v_rule.rule_type = 'none' OR v_rule.rate <= 0 THEN
    RETURN NULL;
  END IF;

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
    organization_id, branch_id, profile_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    client_txn_key, created_by, updated_by
  ) VALUES (
    v_sale.organization_id, v_sale.branch_id, v_sale.salesperson_id, p_sale_id,
    v_sale.grand_total, v_cogs, v_amount, 'pending',
    v_key, v_sale.created_by, v_sale.created_by
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_sale_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_sale_commission(uuid) TO service_role;

--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_sales_commission(p_commission_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_row public.salesman_commissions%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.approve') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.approve' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_commissions sc
  WHERE sc.id = p_commission_id
    AND sc.organization_id = v_org_id
    AND sc.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found'; END IF;
  IF v_row.status = 'approved' OR v_row.status = 'paid' THEN
    RETURN jsonb_build_object('commission_id', v_row.id, 'idempotent', true);
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Commission cannot be approved from status %', v_row.status;
  END IF;

  UPDATE public.salesman_commissions
  SET status = 'approved',
      approved_by = v_profile_id,
      approved_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object('commission_id', v_row.id, 'status', 'approved', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_sales_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_commission(uuid) TO authenticated;

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
  IF v_row.status <> 'approved' THEN
    RAISE EXCEPTION 'Commission must be approved before payment';
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
      paid_at = timezone('utc', now()),
      financial_account_id = v_fin_acct,
      notes = COALESCE(notes, '') || ' paid:' || v_client_txn_key,
      updated_by = v_profile_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object(
    'commission_id', v_row.id,
    'amount', v_row.commission_amount,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_sales_commission(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_sales_commission(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Extend POS wrapper to accrue commission after successful sale
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
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_complete_pos_sale_core'
  ) THEN
    RAISE EXCEPTION 'POS sale core function missing';
  END IF;

  v_result := public._complete_pos_sale_core(payload);
  v_sale_id := NULLIF(v_result->>'sale_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_sale_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  FOR r IN
    SELECT
      sp.id AS payment_id,
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

  PERFORM public._accrue_sale_commission(v_sale_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;
