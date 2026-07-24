-- Employee-based retail commission bridge
-- Links HR employees ↔ commission rules ↔ POS salesperson attribution ↔ payroll allocations.
-- Forward-only, idempotent, preserves profile_id-based historical data.

--------------------------------------------------------------------------------
-- Employee commission fields
--------------------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS commission_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_payment_mode text NOT NULL DEFAULT 'select_at_approval',
  ADD COLUMN IF NOT EXISTS include_commission_in_payroll boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_sales_branch_id uuid REFERENCES public.branches (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employees_commission_payment_mode_chk'
  ) THEN
    ALTER TABLE public.employees
      ADD CONSTRAINT employees_commission_payment_mode_chk
      CHECK (commission_payment_mode IN ('payroll', 'direct', 'select_at_approval'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employees_org_profile_active_uidx
  ON public.employees (organization_id, profile_id)
  WHERE deleted_at IS NULL
    AND profile_id IS NOT NULL
    AND status <> 'terminated';

--------------------------------------------------------------------------------
-- Sale attribution: employee + profile (cashier stays created_by)
--------------------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS salesperson_employee_id uuid REFERENCES public.employees (id);

CREATE INDEX IF NOT EXISTS sales_salesperson_employee_id_idx
  ON public.sales (salesperson_employee_id)
  WHERE deleted_at IS NULL AND salesperson_employee_id IS NOT NULL;

--------------------------------------------------------------------------------
-- Commission tables: employee_id (profile_id retained for compatibility)
--------------------------------------------------------------------------------
ALTER TABLE public.salesman_commission_rules
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees (id);

ALTER TABLE public.salesman_commissions
  ADD COLUMN IF NOT EXISTS employee_id uuid REFERENCES public.employees (id),
  ADD COLUMN IF NOT EXISTS needs_employee_link boolean NOT NULL DEFAULT false;

ALTER TABLE public.salesman_commission_rules
  ALTER COLUMN profile_id DROP NOT NULL;

ALTER TABLE public.salesman_commissions
  ALTER COLUMN profile_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS salesman_commission_rules_employee_idx
  ON public.salesman_commission_rules (organization_id, employee_id)
  WHERE deleted_at IS NULL AND employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS salesman_commissions_employee_idx
  ON public.salesman_commissions (organization_id, employee_id, status)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS salesman_commission_rules_org_employee_branch_active_uidx
  ON public.salesman_commission_rules (
    organization_id,
    employee_id,
    COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL AND is_active = true AND employee_id IS NOT NULL;

--------------------------------------------------------------------------------
-- Payroll commission component
--------------------------------------------------------------------------------
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS commission_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_adjustment numeric(14, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.payroll_commission_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  payroll_item_id uuid REFERENCES public.payroll_items (id) ON DELETE SET NULL,
  commission_id uuid NOT NULL REFERENCES public.salesman_commissions (id),
  included_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (included_amount >= 0),
  adjustment_amount numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_commission_allocations_commission_uidx
  ON public.payroll_commission_allocations (commission_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payroll_commission_allocations_run_idx
  ON public.payroll_commission_allocations (payroll_run_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.payroll_commission_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payroll_commission_allocations_org_all ON public.payroll_commission_allocations;
CREATE POLICY payroll_commission_allocations_org_all ON public.payroll_commission_allocations
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- Backfill employee_id from profile_id (exact match only)
--------------------------------------------------------------------------------
UPDATE public.employees e
SET commission_eligible = true
WHERE e.deleted_at IS NULL
  AND e.profile_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.salesman_commission_rules r
    WHERE r.profile_id = e.profile_id
      AND r.organization_id = e.organization_id
      AND r.deleted_at IS NULL
  );

UPDATE public.salesman_commission_rules r
SET employee_id = e.id
FROM public.employees e
WHERE r.employee_id IS NULL
  AND e.profile_id = r.profile_id
  AND e.organization_id = r.organization_id
  AND e.deleted_at IS NULL
  AND e.status <> 'terminated';

UPDATE public.salesman_commissions c
SET employee_id = e.id,
    needs_employee_link = false
FROM public.employees e
WHERE c.employee_id IS NULL
  AND e.profile_id = c.profile_id
  AND e.organization_id = c.organization_id
  AND e.deleted_at IS NULL
  AND e.status <> 'terminated';

UPDATE public.salesman_commissions c
SET needs_employee_link = true
WHERE c.employee_id IS NULL
  AND c.profile_id IS NOT NULL
  AND c.deleted_at IS NULL;

UPDATE public.sales s
SET salesperson_employee_id = e.id
FROM public.employees e
WHERE s.salesperson_employee_id IS NULL
  AND s.salesperson_id IS NOT NULL
  AND e.profile_id = s.salesperson_id
  AND e.organization_id = s.organization_id
  AND e.deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Resolution helpers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._resolve_employee_for_profile(p_profile_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.id
  FROM public.employees e
  WHERE e.profile_id = p_profile_id
    AND e.organization_id = public.current_organization_id()
    AND e.deleted_at IS NULL
    AND e.status <> 'terminated'
  ORDER BY e.created_at ASC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public._resolve_employee_for_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._resolve_employee_for_profile(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._resolve_profile_for_employee(p_employee_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT e.profile_id
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.organization_id = public.current_organization_id()
    AND e.deleted_at IS NULL
    AND e.status <> 'terminated';
$$;

REVOKE ALL ON FUNCTION public._resolve_profile_for_employee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._resolve_profile_for_employee(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._resolve_pos_salesperson(
  p_payload jsonb,
  p_branch_id uuid
)
RETURNS TABLE (
  employee_id uuid,
  profile_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_cashier_profile uuid := public.current_profile_id();
  v_employee uuid;
  v_profile uuid;
BEGIN
  v_employee := NULLIF(p_payload->>'salesperson_employee_id', '')::uuid;
  v_profile := NULLIF(p_payload->>'salesperson_id', '')::uuid;

  IF v_employee IS NOT NULL THEN
    SELECT e.id, e.profile_id
    INTO v_employee, v_profile
    FROM public.employees e
    WHERE e.id = v_employee
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.status = 'active'
      AND e.commission_eligible = true
      AND (e.branch_id IS NULL OR e.branch_id = p_branch_id)
      AND public.user_has_branch_access(p_branch_id);

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or unauthorized salesperson employee';
    END IF;

    employee_id := v_employee;
    profile_id := v_profile;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_profile IS NOT NULL THEN
    SELECT e.id, v_profile
    INTO v_employee, v_profile
    FROM public.employees e
    WHERE e.profile_id = v_profile
      AND e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.status = 'active'
    LIMIT 1;

    employee_id := v_employee;
    profile_id := v_profile;
    RETURN NEXT;
    RETURN;
  END IF;

  v_employee := public._resolve_employee_for_profile(v_cashier_profile);
  v_profile := v_cashier_profile;

  IF v_employee IS NOT NULL THEN
    employee_id := v_employee;
    profile_id := v_profile;
    RETURN NEXT;
    RETURN;
  END IF;

  employee_id := NULL;
  profile_id := v_cashier_profile;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._resolve_pos_salesperson(jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._resolve_pos_salesperson(jsonb, uuid) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- Employee search for commission settings / POS
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_commission_employees(
  p_query text DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_commission_only boolean DEFAULT true
)
RETURNS TABLE (
  id uuid,
  employee_code text,
  full_name text,
  designation text,
  branch_name text,
  profile_id uuid,
  profile_name text,
  commission_eligible boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_q text := NULLIF(btrim(p_query), '');
BEGIN
  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('sales.commission.manage')
    OR public.user_has_permission('pos.create')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.employee_code,
    e.full_name,
    coalesce(e.designation, ''),
    b.name,
    e.profile_id,
    p.full_name,
    e.commission_eligible
  FROM public.employees e
  LEFT JOIN public.branches b ON b.id = e.branch_id
  LEFT JOIN public.profiles p ON p.id = e.profile_id AND p.deleted_at IS NULL
  WHERE e.organization_id = v_org
    AND e.deleted_at IS NULL
    AND e.status = 'active'
    AND (NOT p_commission_only OR e.commission_eligible = true)
    AND (p_branch_id IS NULL OR e.branch_id IS NULL OR e.branch_id = p_branch_id)
    AND (
      v_q IS NULL
      OR e.full_name ILIKE '%' || v_q || '%'
      OR e.employee_code ILIKE '%' || v_q || '%'
      OR coalesce(e.phone, '') ILIKE '%' || v_q || '%'
      OR coalesce(e.designation, '') ILIKE '%' || v_q || '%'
    )
  ORDER BY e.full_name
  LIMIT 30;
END;
$$;

REVOKE ALL ON FUNCTION public.search_commission_employees(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_commission_employees(text, uuid, boolean) TO authenticated;

--------------------------------------------------------------------------------
-- Rule upsert: accept employee_id (derive profile when linked)
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
  v_target_employee uuid;
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

  v_target_employee := NULLIF(payload->>'employee_id', '')::uuid;
  v_target_profile := NULLIF(payload->>'profile_id', '')::uuid;
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_rule_type := lower(btrim(coalesce(payload->>'rule_type', 'none')));
  v_rate := coalesce((payload->>'rate')::numeric, 0);
  v_effective_from := coalesce((payload->>'effective_from')::date, (timezone('utc', now()))::date);
  v_notes := NULLIF(payload->>'notes', '');

  IF v_target_employee IS NOT NULL THEN
    SELECT e.profile_id INTO v_target_profile
    FROM public.employees e
    WHERE e.id = v_target_employee
      AND e.organization_id = v_org_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid employee';
    END IF;

    UPDATE public.employees
    SET commission_eligible = true,
        updated_at = timezone('utc', now())
    WHERE id = v_target_employee;
  ELSIF v_target_profile IS NOT NULL THEN
    SELECT e.id INTO v_target_employee
    FROM public.employees e
    WHERE e.profile_id = v_target_profile
      AND e.organization_id = v_org_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated'
    ORDER BY e.created_at ASC
    LIMIT 1;
  ELSE
    RAISE EXCEPTION 'employee_id or profile_id is required';
  END IF;

  IF v_rule_type NOT IN ('fixed', 'percent_sale', 'percent_profit', 'none') THEN
    RAISE EXCEPTION 'Invalid rule_type';
  END IF;
  IF v_rate < 0 THEN RAISE EXCEPTION 'rate cannot be negative'; END IF;

  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_target_profile IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_target_profile AND p.organization_id = v_org_id AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid salesperson profile';
  END IF;

  SELECT * INTO v_existing
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = v_org_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND (r.branch_id IS NOT DISTINCT FROM v_branch_id)
    AND (
      (v_target_employee IS NOT NULL AND r.employee_id = v_target_employee)
      OR (v_target_employee IS NULL AND r.profile_id = v_target_profile)
    )
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
    organization_id, branch_id, profile_id, employee_id, rule_type, rate,
    is_active, effective_from, notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_target_profile, v_target_employee, v_rule_type, v_rate,
    v_rule_type <> 'none', v_effective_from, v_notes, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_new_id;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'commission.rule.upsert', 'salesman_commission_rule', v_new_id,
    CASE WHEN v_existing.id IS NULL THEN NULL ELSE to_jsonb(v_existing) END,
    jsonb_build_object('rule_type', v_rule_type, 'rate', v_rate, 'employee_id', v_target_employee),
    NULL,
    jsonb_build_object('source', 'upsert_commission_rule')
  );

  RETURN jsonb_build_object(
    'rule_id', v_new_id,
    'profile_id', v_target_profile,
    'employee_id', v_target_employee
  );
END;
$$;

--------------------------------------------------------------------------------
-- Accrual: resolve employee + rule by employee_id first, then profile_id
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
    client_txn_key, rule_snapshot, needs_employee_link, created_by, updated_by
  ) VALUES (
    v_sale.organization_id, v_sale.branch_id, v_profile_id, v_employee_id, p_sale_id,
    v_sale.grand_total, v_cogs, v_amount, 'pending',
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
-- POS wrapper: attribute salesperson before commission accrual
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

  PERFORM public._accrue_sale_commission(v_sale_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Link employee profile (admin workflow)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_employee_profile(
  p_employee_id uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_emp public.employees%ROWTYPE;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT public.user_has_permission('hr.employee.update') THEN
    RAISE EXCEPTION 'Missing permission hr.employee.update' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.organization_id = v_org
    AND e.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  IF p_profile_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_profile_id AND p.organization_id = v_org AND p.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid profile';
  END IF;

  IF p_profile_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.employees e
    WHERE e.organization_id = v_org
      AND e.profile_id = p_profile_id
      AND e.id <> p_employee_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated'
  ) THEN
    RAISE EXCEPTION 'Profile already linked to another active employee';
  END IF;

  UPDATE public.employees
  SET profile_id = p_profile_id,
      updated_by = v_actor,
      updated_at = timezone('utc', now())
  WHERE id = p_employee_id;

  UPDATE public.salesman_commission_rules r
  SET employee_id = p_employee_id,
      profile_id = coalesce(p_profile_id, r.profile_id)
  WHERE r.organization_id = v_org
    AND r.profile_id = v_emp.profile_id
    AND r.employee_id IS NULL
    AND r.deleted_at IS NULL;

  UPDATE public.salesman_commissions c
  SET employee_id = p_employee_id,
      needs_employee_link = false
  WHERE c.organization_id = v_org
    AND c.profile_id = v_emp.profile_id
    AND c.employee_id IS NULL
    AND c.deleted_at IS NULL;

  RETURN jsonb_build_object('employee_id', p_employee_id, 'profile_id', p_profile_id);
END;
$$;

REVOKE ALL ON FUNCTION public.link_employee_profile(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_employee_profile(uuid, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Demo: mark seeded HR employees commission-eligible with sample rules
--------------------------------------------------------------------------------
UPDATE public.employees
SET commission_eligible = true
WHERE id IN (
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000007',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000008',
  '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000010'
)
AND deleted_at IS NULL;

INSERT INTO public.salesman_commission_rules (
  id, organization_id, branch_id, profile_id, employee_id, rule_type, rate,
  is_active, effective_from, notes
)
VALUES
  ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7900001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, NULL, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000001', 'percent_sale', 2.5000, true, '2026-01-01', 'Store manager default'),
  ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7900002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', NULL, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000002', 'percent_sale', 2.0000, true, '2026-01-01', 'Bashundhara floor supervisor'),
  ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7900003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', NULL, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000003', 'percent_sale', 1.5000, true, '2026-01-01', 'Sales associate'),
  ('77a7a7a7-a7a7-47a7-8a7a-a7a7a7900004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', NULL, '77e7e7e7-e7e7-47e7-8e7e-e7e7e7000004', 'fixed', 150.0000, true, '2026-01-01', 'Fixed per sale — Jamuna')
ON CONFLICT (id) DO NOTHING;
