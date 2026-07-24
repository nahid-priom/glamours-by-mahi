-- Commission rule management UI backend: effective dates, snapshots, secured RPCs

INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('sales.commission.manage', 'Create and manage salesperson commission rules')
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
  AND p.key = 'sales.commission.manage'
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

ALTER TABLE public.salesman_commission_rules
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches (id),
  ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT (timezone('utc', now()))::date,
  ADD COLUMN IF NOT EXISTS effective_to date,
  ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE public.salesman_commissions
  ADD COLUMN IF NOT EXISTS rule_snapshot jsonb;

DROP INDEX IF EXISTS salesman_commission_rules_org_profile_active_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS salesman_commission_rules_org_profile_branch_active_uidx
  ON public.salesman_commission_rules (organization_id, profile_id, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS salesman_commission_rules_effective_idx
  ON public.salesman_commission_rules (organization_id, profile_id, effective_from DESC)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_commission_rules(p_branch_id uuid DEFAULT NULL)
RETURNS SETOF public.salesman_commission_rules
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
BEGIN
  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('sales.commission.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission sales.commission.read' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT r.*
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_org_id
    AND r.deleted_at IS NULL
    AND (p_branch_id IS NULL OR r.branch_id IS NULL OR r.branch_id = p_branch_id)
  ORDER BY r.is_active DESC, r.effective_from DESC, r.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_commission_rules(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_commission_rules(uuid) TO authenticated;

--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_commission_rule(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_target_profile uuid;
  v_branch_id uuid;
  v_rule_type text;
  v_rate numeric(14, 4);
  v_effective_from date;
  v_notes text;
  v_existing public.salesman_commission_rules%ROWTYPE;
  v_new_id uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.manage') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.manage' USING ERRCODE = '42501';
  END IF;

  v_target_profile := NULLIF(payload->>'profile_id', '')::uuid;
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_rule_type := lower(btrim(coalesce(payload->>'rule_type', 'none')));
  v_rate := coalesce((payload->>'rate')::numeric, 0);
  v_effective_from := coalesce((payload->>'effective_from')::date, (timezone('utc', now()))::date);
  v_notes := NULLIF(payload->>'notes', '');

  IF v_target_profile IS NULL THEN RAISE EXCEPTION 'profile_id is required'; END IF;
  IF v_rule_type NOT IN ('fixed', 'percent_sale', 'percent_profit', 'none') THEN
    RAISE EXCEPTION 'Invalid rule_type';
  END IF;
  IF v_rate < 0 THEN RAISE EXCEPTION 'rate cannot be negative'; END IF;

  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_target_profile AND p.organization_id = v_org_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid salesperson profile';
  END IF;

  SELECT * INTO v_existing
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_org_id
    AND r.profile_id = v_target_profile
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND (r.branch_id IS NOT DISTINCT FROM v_branch_id)
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.effective_from >= v_effective_from THEN
      RAISE EXCEPTION 'New rule effective_from must be after the current active rule';
    END IF;
    UPDATE public.salesman_commission_rules
    SET is_active = false,
        effective_to = v_effective_from - 1,
        updated_by = v_profile_id
    WHERE id = v_existing.id;
  END IF;

  INSERT INTO public.salesman_commission_rules (
    organization_id, branch_id, profile_id, rule_type, rate,
    is_active, effective_from, notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_target_profile, v_rule_type, v_rate,
    v_rule_type <> 'none', v_effective_from, v_notes, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_new_id;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'commission.rule.upsert', 'salesman_commission_rule', v_new_id,
    CASE WHEN v_existing.id IS NULL THEN NULL
         ELSE to_jsonb(v_existing) END,
    jsonb_build_object('rule_type', v_rule_type, 'rate', v_rate, 'effective_from', v_effective_from),
    NULL,
    jsonb_build_object('source', 'upsert_commission_rule')
  );

  RETURN jsonb_build_object('rule_id', v_new_id, 'profile_id', v_target_profile);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_commission_rule(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_commission_rule(jsonb) TO authenticated;

--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deactivate_commission_rule(p_rule_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_row public.salesman_commission_rules%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.manage') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.manage' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_commission_rules r
  WHERE r.id = p_rule_id AND r.organization_id = v_org_id AND r.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Rule not found'; END IF;

  UPDATE public.salesman_commission_rules
  SET is_active = false,
      effective_to = (timezone('utc', now()))::date,
      updated_by = v_profile_id
  WHERE id = p_rule_id;

  RETURN jsonb_build_object('rule_id', p_rule_id, 'deactivated', true);
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_commission_rule(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.deactivate_commission_rule(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Accrual: respect effective_from and store rule snapshot
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
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.salesperson_id IS NULL OR v_sale.status <> 'completed' THEN
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
    AND r.profile_id = v_sale.salesperson_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND r.rule_type <> 'none'
    AND r.rate > 0
    AND r.effective_from <= v_sale_date
    AND (r.effective_to IS NULL OR r.effective_to >= v_sale_date)
    AND (r.branch_id IS NULL OR r.branch_id = v_sale.branch_id)
  ORDER BY r.branch_id NULLS LAST, r.effective_from DESC
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
    organization_id, branch_id, profile_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    client_txn_key, rule_snapshot, created_by, updated_by
  ) VALUES (
    v_sale.organization_id, v_sale.branch_id, v_sale.salesperson_id, p_sale_id,
    v_sale.grand_total, v_cogs, v_amount, 'pending',
    v_key,
    jsonb_build_object(
      'rule_id', v_rule.id,
      'rule_type', v_rule.rule_type,
      'rate', v_rule.rate,
      'effective_from', v_rule.effective_from
    ),
    v_sale.created_by, v_sale.created_by
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_sale_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_sale_commission(uuid) TO service_role;

-- RLS: manage rules via RPC only; block direct client writes
DROP POLICY IF EXISTS salesman_commission_rules_insert ON public.salesman_commission_rules;
DROP POLICY IF EXISTS salesman_commission_rules_update ON public.salesman_commission_rules;

CREATE POLICY salesman_commission_rules_insert ON public.salesman_commission_rules
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY salesman_commission_rules_update ON public.salesman_commission_rules
  FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY salesman_commissions_insert ON public.salesman_commissions
  FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY salesman_commissions_update ON public.salesman_commissions
  FOR UPDATE TO authenticated
  USING (false);
