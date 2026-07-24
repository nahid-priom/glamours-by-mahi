-- Migration 070: Payroll system completion — schema extensions, supporting tables, RPCs
-- Forward-only. Does not modify prior migrations.

--------------------------------------------------------------------------------
-- Chart of accounts: salary roles
--------------------------------------------------------------------------------
ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_system_role_check;

ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_system_role_check
  CHECK (
    system_role IS NULL
    OR system_role = ANY (ARRAY[
      'cash', 'bank', 'mobile_money', 'receivable', 'payable',
      'inventory_asset', 'cogs', 'sales_revenue', 'sales_return',
      'purchase', 'tax_payable', 'tax_receivable', 'refund_payable',
      'opening_balance_equity', 'courier_receivable', 'courier_expense',
      'salary_expense', 'salary_payable'
    ])
  );

INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, system_role, is_postable, is_active)
SELECT o.id, '6150', 'Salary Expense', 'expense', 'salary_expense', true, true
FROM public.organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id AND c.system_role = 'salary_expense' AND c.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id AND c.code = '6150' AND c.deleted_at IS NULL
  );

INSERT INTO public.chart_of_accounts (organization_id, code, name, account_type, system_role, is_postable, is_active)
SELECT o.id, '2250', 'Salary Payable', 'liability', 'salary_payable', true, true
FROM public.organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id AND c.system_role = 'salary_payable' AND c.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id AND c.code = '2250' AND c.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Extend payroll_runs
--------------------------------------------------------------------------------
ALTER TABLE public.payroll_runs
  DROP CONSTRAINT IF EXISTS payroll_runs_status_check;

ALTER TABLE public.payroll_runs
  ADD CONSTRAINT payroll_runs_status_check
  CHECK (status IN (
    'draft', 'calculated', 'reviewed', 'approved', 'payment_pending',
    'partially_paid', 'paid', 'closed', 'cancelled', 'reversed', 'recalculation_required'
  ));

ALTER TABLE public.payroll_runs
  ADD COLUMN IF NOT EXISTS payment_date date,
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'organization'
    CHECK (scope_type IN ('organization', 'branch', 'department', 'selected')),
  ADD COLUMN IF NOT EXISTS employee_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS calculation_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS client_txn_key text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS calculated_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS total_paid numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS payment_journal_entry_id uuid,
  ADD COLUMN IF NOT EXISTS recalculation_required boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS payroll_runs_org_client_txn_uidx
  ON public.payroll_runs (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

--------------------------------------------------------------------------------
-- Extend payroll_items
--------------------------------------------------------------------------------
ALTER TABLE public.payroll_items
  ADD COLUMN IF NOT EXISTS paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
  ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS employee_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS attendance_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS gross_salary numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS calculation_version int NOT NULL DEFAULT 1;

--------------------------------------------------------------------------------
-- salary_structures
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  effective_from date NOT NULL,
  effective_to date,
  salary_type text NOT NULL DEFAULT 'monthly'
    CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
  basic_salary numeric(14, 2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS salary_structures_employee_effective_idx
  ON public.salary_structures (employee_id, effective_from DESC)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- salary_structure_components
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_structure_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  salary_structure_id uuid NOT NULL REFERENCES public.salary_structures (id) ON DELETE CASCADE,
  component_type text NOT NULL CHECK (component_type IN ('earning', 'deduction')),
  code text NOT NULL,
  name text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  is_taxable boolean NOT NULL DEFAULT false,
  is_recurring boolean NOT NULL DEFAULT true,
  formula text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

--------------------------------------------------------------------------------
-- payroll_item_earnings / payroll_item_deductions
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_item_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.payroll_item_deductions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items (id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  amount numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

--------------------------------------------------------------------------------
-- payroll_adjustments
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items (id) ON DELETE CASCADE,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('earning', 'deduction')),
  amount numeric(14, 2) NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles (id),
  deleted_at timestamptz
);

--------------------------------------------------------------------------------
-- payroll_payments / payroll_payment_allocations
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id),
  financial_account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'bank',
  reference text,
  notes text,
  client_txn_key text NOT NULL,
  journal_entry_id uuid,
  paid_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payroll_payments_org_client_txn_uidx
  ON public.payroll_payments (organization_id, client_txn_key)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.payroll_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_payment_id uuid NOT NULL REFERENCES public.payroll_payments (id) ON DELETE CASCADE,
  payroll_item_id uuid NOT NULL REFERENCES public.payroll_items (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (payroll_payment_id, payroll_item_id)
);

--------------------------------------------------------------------------------
-- payroll_approval_logs
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_approval_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  payroll_run_id uuid NOT NULL REFERENCES public.payroll_runs (id) ON DELETE CASCADE,
  action text NOT NULL,
  from_status text,
  to_status text,
  comments text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles (id)
);

--------------------------------------------------------------------------------
-- employee_advances / employee_loans / loan_installments
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  branch_id uuid REFERENCES public.branches (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  recovered_amount numeric(14, 2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'disbursed', 'recovering', 'settled', 'cancelled')),
  recovery_per_payroll numeric(14, 2),
  reason text,
  disbursed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id)
);

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  principal numeric(14, 2) NOT NULL CHECK (principal > 0),
  installment_amount numeric(14, 2) NOT NULL CHECK (installment_amount > 0),
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  remaining_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  start_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id)
);

CREATE TABLE IF NOT EXISTS public.loan_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  loan_id uuid NOT NULL REFERENCES public.employee_loans (id) ON DELETE CASCADE,
  payroll_item_id uuid REFERENCES public.payroll_items (id),
  due_date date NOT NULL,
  amount numeric(14, 2) NOT NULL,
  paid_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'skipped')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

--------------------------------------------------------------------------------
-- RLS for new tables
--------------------------------------------------------------------------------
ALTER TABLE public.salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_structure_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_item_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_item_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_installments ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'salary_structures', 'salary_structure_components',
    'payroll_item_earnings', 'payroll_item_deductions', 'payroll_adjustments',
    'payroll_payments', 'payroll_payment_allocations',
    'employee_advances', 'employee_loans', 'loan_installments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_org_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_org_all ON public.%I FOR ALL TO authenticated
       USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
       WITH CHECK (organization_id = public.current_organization_id())',
      t, t
    );
  END LOOP;
END $$;

-- approval_logs has no deleted_at
DROP POLICY IF EXISTS payroll_approval_logs_org_all ON public.payroll_approval_logs;
CREATE POLICY payroll_approval_logs_org_all ON public.payroll_approval_logs
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('hr.payroll.calculate', 'Calculate payroll runs'),
  ('hr.payroll.review', 'Review payroll runs'),
  ('hr.payroll.reverse', 'Reverse payroll payments'),
  ('hr.payroll.export', 'Export payroll reports'),
  ('hr.salary_structure.manage', 'Manage salary structures'),
  ('hr.employee_advance.manage', 'Manage employee advances and loans')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = x.key AND p.deleted_at IS NULL
);

--------------------------------------------------------------------------------
-- Helper: count scheduled working days (Mon–Sat) in period
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._payroll_scheduled_days(p_start date, p_end date)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT count(*)::int
  FROM generate_series(p_start, p_end, interval '1 day') AS d(day)
  WHERE extract(isodow from d.day) < 7;
$$;

--------------------------------------------------------------------------------
-- create_payroll_run
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_payroll_run(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_key text;
  v_existing uuid;
  v_run_id uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.create') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.create' USING ERRCODE = '42501';
  END IF;

  v_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  IF v_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;

  SELECT id INTO v_existing
  FROM public.payroll_runs
  WHERE organization_id = v_org_id AND client_txn_key = v_key AND deleted_at IS NULL
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('payroll_run_id', v_existing, 'idempotent', true);
  END IF;

  IF NULLIF(payload->>'period_label', '') IS NULL
     OR NULLIF(payload->>'period_start', '') IS NULL
     OR NULLIF(payload->>'period_end', '') IS NULL THEN
    RAISE EXCEPTION 'period_label, period_start and period_end are required';
  END IF;

  INSERT INTO public.payroll_runs (
    organization_id, branch_id, department, period_label, period_start, period_end,
    payment_date, scope_type, employee_ids, status, notes, client_txn_key,
    created_by, updated_by
  ) VALUES (
    v_org_id,
    NULLIF(payload->>'branch_id', '')::uuid,
    NULLIF(payload->>'department', ''),
    payload->>'period_label',
    (payload->>'period_start')::date,
    (payload->>'period_end')::date,
    NULLIF(payload->>'payment_date', '')::date,
    coalesce(NULLIF(payload->>'scope_type', ''), 'organization'),
    coalesce(payload->'employee_ids', '[]'::jsonb),
    'draft',
    NULLIF(payload->>'notes', ''),
    v_key,
    v_profile_id, v_profile_id
  )
  RETURNING id INTO v_run_id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status, created_by
  ) VALUES (v_org_id, v_run_id, 'created', NULL, 'draft', v_profile_id);

  RETURN jsonb_build_object('payroll_run_id', v_run_id);
END;
$$;

REVOKE ALL ON FUNCTION public.create_payroll_run(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payroll_run(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- calculate_payroll_run
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_payroll_run(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
  v_key text;
  v_emp public.employees%ROWTYPE;
  v_scheduled_days int;
  v_present numeric(8,2) := 0;
  v_half numeric(8,2) := 0;
  v_absent numeric(8,2) := 0;
  v_paid_leave numeric(8,2) := 0;
  v_unpaid_leave numeric(8,2) := 0;
  v_holiday numeric(8,2) := 0;
  v_weekly_off numeric(8,2) := 0;
  v_late_days int := 0;
  v_ot_minutes int := 0;
  v_daily_rate numeric(14,2);
  v_earned_basic numeric(14,2);
  v_allowances numeric(14,2);
  v_att_ded numeric(14,2);
  v_leave_ded numeric(14,2);
  v_late_ded numeric(14,2);
  v_commission numeric(14,2);
  v_advance_rec numeric(14,2);
  v_loan_rec numeric(14,2);
  v_gross numeric(14,2);
  v_net numeric(14,2);
  v_item_id uuid;
  v_count int := 0;
  v_payable_days numeric(8,2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.calculate')
     AND NOT public.user_has_permission('hr.payroll.create') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.calculate' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('draft', 'recalculation_required', 'calculated') THEN
    RAISE EXCEPTION 'Payroll run cannot be calculated in status %', v_run.status;
  END IF;

  v_key := coalesce(NULLIF(payload->>'client_txn_key', ''), 'calc:' || v_run.id::text);
  IF v_run.status = 'calculated' AND v_run.calculated_at IS NOT NULL
     AND v_run.calculation_version > 0
     AND coalesce(payload->>'force', 'false') <> 'true' THEN
    RETURN jsonb_build_object('payroll_run_id', v_run.id, 'employee_count', (
      SELECT count(*) FROM public.payroll_items WHERE payroll_run_id = v_run.id AND deleted_at IS NULL
    ), 'idempotent', true);
  END IF;

  v_scheduled_days := greatest(public._payroll_scheduled_days(v_run.period_start, v_run.period_end), 1);

  -- Soft-delete existing items for recalculation
  UPDATE public.payroll_items SET deleted_at = timezone('utc', now())
  WHERE payroll_run_id = v_run.id AND deleted_at IS NULL;

  FOR v_emp IN
    SELECT e.*
    FROM public.employees e
    WHERE e.organization_id = v_org_id
      AND e.deleted_at IS NULL
      AND e.status = 'active'
      AND (
        v_run.scope_type = 'organization'
        OR (v_run.scope_type = 'branch' AND e.branch_id = v_run.branch_id)
        OR (v_run.scope_type = 'department' AND e.department = v_run.department)
        OR (v_run.scope_type = 'selected' AND e.id IN (
          SELECT (jsonb_array_elements_text(v_run.employee_ids))::uuid
        ))
      )
  LOOP
    SELECT
      coalesce(sum(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'half_day' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'holiday' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'weekly_off' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.late_minutes > 0 THEN 1 ELSE 0 END), 0),
      coalesce(sum(ar.overtime_minutes), 0)
    INTO v_present, v_half, v_absent, v_paid_leave, v_holiday, v_weekly_off, v_late_days, v_ot_minutes
    FROM public.attendance_records ar
    WHERE ar.employee_id = v_emp.id
      AND ar.organization_id = v_org_id
      AND ar.work_date BETWEEN v_run.period_start AND v_run.period_end
      AND ar.deleted_at IS NULL
      AND ar.is_approved = true;

    SELECT coalesce(sum(lr.days), 0) INTO v_unpaid_leave
    FROM public.leave_requests lr
    WHERE lr.employee_id = v_emp.id
      AND lr.organization_id = v_org_id
      AND lr.status = 'approved'
      AND lr.leave_type IN ('unpaid', 'lwp')
      AND lr.start_date <= v_run.period_end
      AND lr.end_date >= v_run.period_start
      AND lr.deleted_at IS NULL;

    v_daily_rate := CASE
      WHEN v_emp.salary_type = 'daily' THEN v_emp.basic_salary
      WHEN v_emp.salary_type = 'hourly' THEN v_emp.basic_salary * 8
      ELSE round(v_emp.basic_salary / v_scheduled_days, 2)
    END;

    v_payable_days := v_present + v_half * 0.5 + v_paid_leave + v_holiday + v_weekly_off;

    v_earned_basic := CASE
      WHEN v_emp.salary_type = 'monthly' THEN round(v_emp.basic_salary * v_payable_days / v_scheduled_days, 2)
      WHEN v_emp.salary_type = 'daily' THEN round(v_daily_rate * v_payable_days, 2)
      ELSE round(v_emp.basic_salary * (v_payable_days * 8 + v_ot_minutes / 60.0), 2)
    END;

    v_allowances := round(coalesce((v_emp.allowances->>'total')::numeric, 0), 2);
    v_att_ded := round(v_absent * v_daily_rate, 2);
    v_leave_ded := round(v_unpaid_leave * v_daily_rate, 2);
    v_late_ded := round(v_late_days * v_daily_rate * 0.1, 2);

    SELECT coalesce(sum(sc.commission_amount), 0) INTO v_commission
    FROM public.salesman_commissions sc
    WHERE sc.employee_id = v_emp.id
      AND sc.organization_id = v_org_id
      AND sc.status = 'approved'
      AND sc.deleted_at IS NULL
      AND sc.created_at::date BETWEEN v_run.period_start AND v_run.period_end
      AND NOT EXISTS (
        SELECT 1 FROM public.payroll_commission_allocations pca
        WHERE pca.commission_id = sc.id AND pca.deleted_at IS NULL
      );

    SELECT coalesce(sum(remaining_amount), 0) INTO v_advance_rec
    FROM public.employee_advances
    WHERE employee_id = v_emp.id AND organization_id = v_org_id
      AND status IN ('disbursed', 'recovering') AND deleted_at IS NULL
    LIMIT 1;

    v_advance_rec := least(coalesce(v_advance_rec, 0), v_emp.basic_salary * 0.5);

    SELECT coalesce(installment_amount, 0) INTO v_loan_rec
    FROM public.employee_loans
    WHERE employee_id = v_emp.id AND organization_id = v_org_id
      AND status = 'active' AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 1;

    v_gross := round(v_earned_basic + v_allowances, 2);
    v_net := greatest(round(
      v_gross + round(v_ot_minutes / 60.0 * v_daily_rate * 0.5, 2) + v_commission
      - v_att_ded - v_leave_ded - v_late_ded - v_advance_rec - coalesce(v_loan_rec, 0),
    2), 0);

    INSERT INTO public.payroll_items (
      organization_id, payroll_run_id, employee_id,
      basic_salary, allowances, overtime, bonus,
      attendance_deduction, leave_deduction, other_deductions,
      net_salary, gross_salary, commission_amount,
      outstanding_amount, payment_status,
      employee_snapshot, attendance_snapshot, breakdown, calculation_version
    ) VALUES (
      v_org_id, v_run.id, v_emp.id,
      v_earned_basic, v_allowances, round(v_ot_minutes / 60.0 * v_daily_rate * 0.5, 2), 0,
      v_att_ded, v_leave_ded, v_late_ded + v_advance_rec + coalesce(v_loan_rec, 0),
      v_net, v_gross, v_commission,
      v_net, 'unpaid',
      jsonb_build_object(
        'employee_code', v_emp.employee_code,
        'full_name', v_emp.full_name,
        'designation', v_emp.designation,
        'department', v_emp.department,
        'branch_id', v_emp.branch_id
      ),
      jsonb_build_object(
        'scheduled_days', v_scheduled_days,
        'present', v_present, 'half_day', v_half, 'absent', v_absent,
        'paid_leave', v_paid_leave, 'unpaid_leave', v_unpaid_leave,
        'holiday', v_holiday, 'weekly_off', v_weekly_off,
        'late_days', v_late_days, 'overtime_minutes', v_ot_minutes,
        'payable_days', v_payable_days, 'daily_rate', v_daily_rate
      ),
      jsonb_build_object('advance_recovery', v_advance_rec, 'loan_installment', v_loan_rec),
      v_run.calculation_version + 1
    )
    RETURNING id INTO v_item_id;

    v_count := v_count + 1;
  END LOOP;

  UPDATE public.payroll_runs pr
  SET
    status = 'calculated',
    calculated_at = timezone('utc', now()),
    calculated_by = v_profile_id,
    calculation_version = pr.calculation_version + 1,
    recalculation_required = false,
    total_gross = sub.gross,
    total_deductions = sub.ded,
    total_net = sub.net,
    outstanding = sub.net,
    updated_by = v_profile_id
  FROM (
    SELECT
      coalesce(sum(basic_salary + allowances + overtime + bonus + commission_amount), 0) AS gross,
      coalesce(sum(attendance_deduction + leave_deduction + other_deductions), 0) AS ded,
      coalesce(sum(net_salary), 0) AS net
    FROM public.payroll_items
    WHERE payroll_run_id = v_run.id AND deleted_at IS NULL
  ) sub
  WHERE pr.id = v_run.id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status, created_by
  ) VALUES (v_org_id, v_run.id, 'calculated', v_run.status, 'calculated', v_profile_id);

  RETURN jsonb_build_object('payroll_run_id', v_run.id, 'employee_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.calculate_payroll_run(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calculate_payroll_run(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- approve_payroll_run
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payroll_run(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
  v_journal_id uuid;
  v_salary_expense uuid;
  v_salary_payable uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.approve') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.approve' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('calculated', 'reviewed') THEN
    RAISE EXCEPTION 'Payroll run must be calculated or reviewed before approval';
  END IF;
  IF v_run.calculated_by = v_profile_id AND NOT public.user_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'Maker-checker: calculator cannot approve this payroll run';
  END IF;

  v_salary_expense := public._coa_by_role(v_org_id, 'salary_expense');
  v_salary_payable := public._coa_by_role(v_org_id, 'salary_payable');

  IF v_salary_expense IS NOT NULL AND v_salary_payable IS NOT NULL AND v_run.total_net > 0 THEN
    v_journal_id := public._post_journal(
      v_org_id, v_run.branch_id,
      'PAY-' || left(v_run.id::text, 8),
      'payroll_accrual', v_run.id,
      'Payroll accrual ' || v_run.period_label,
      jsonb_build_array(
        jsonb_build_object('chart_account_id', v_salary_expense, 'debit', v_run.total_net, 'credit', 0,
          'description', 'Salary expense'),
        jsonb_build_object('chart_account_id', v_salary_payable, 'debit', 0, 'credit', v_run.total_net,
          'description', 'Salary payable')
      ),
      v_profile_id
    );
  END IF;

  UPDATE public.payroll_runs
  SET status = 'approved',
      approved_at = timezone('utc', now()),
      approved_by = v_profile_id,
      journal_entry_id = coalesce(v_journal_id, journal_entry_id),
      outstanding = total_net - total_paid,
      updated_by = v_profile_id
  WHERE id = v_run.id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status, comments, created_by
  ) VALUES (
    v_org_id, v_run.id, 'approved', v_run.status, 'approved',
    NULLIF(payload->>'comments', ''), v_profile_id
  );

  RETURN jsonb_build_object(
    'payroll_run_id', v_run.id,
    'journal_entry_id', v_journal_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payroll_run(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_payroll_run(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- reject_payroll_run
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_payroll_run(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.approve') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.approve' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('calculated', 'reviewed') THEN
    RAISE EXCEPTION 'Only calculated or reviewed runs can be rejected';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'draft', rejected_reason = NULLIF(payload->>'reason', ''), updated_by = v_profile_id
  WHERE id = v_run.id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status, comments, created_by
  ) VALUES (
    v_org_id, v_run.id, 'rejected', v_run.status, 'draft', NULLIF(payload->>'reason', ''), v_profile_id
  );

  RETURN jsonb_build_object('payroll_run_id', v_run.id);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_payroll_run(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_payroll_run(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- pay_payroll_items
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_payroll_items(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
  v_key text;
  v_existing uuid;
  v_fa public.financial_accounts%ROWTYPE;
  v_amount numeric(14,2);
  v_payment_id uuid;
  v_journal_id uuid;
  v_salary_payable uuid;
  v_item public.payroll_items%ROWTYPE;
  v_apply numeric(14,2);
  v_remaining numeric(14,2);
  v_run_paid numeric(14,2);
  v_run_outstanding numeric(14,2);
  v_new_status text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.payroll.pay') THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.pay' USING ERRCODE = '42501';
  END IF;

  v_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  IF v_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;

  SELECT id INTO v_existing
  FROM public.payroll_payments
  WHERE organization_id = v_org_id AND client_txn_key = v_key AND deleted_at IS NULL
  LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('idempotent', true, 'payroll_payment_id', v_existing);
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('approved', 'payment_pending', 'partially_paid') THEN
    RAISE EXCEPTION 'Payroll run is not ready for payment (status: %)', v_run.status;
  END IF;

  SELECT * INTO v_fa
  FROM public.financial_accounts
  WHERE id = NULLIF(payload->>'financial_account_id', '')::uuid
    AND organization_id = v_org_id AND deleted_at IS NULL AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Financial account not found'; END IF;

  v_amount := coalesce((payload->>'amount')::numeric, v_run.outstanding);
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be positive'; END IF;
  IF v_fa.current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance in selected account';
  END IF;

  INSERT INTO public.payroll_payments (
    organization_id, branch_id, payroll_run_id, financial_account_id,
    amount, method, reference, notes, client_txn_key, created_by
  ) VALUES (
    v_org_id, v_run.branch_id, v_run.id, v_fa.id,
    v_amount, coalesce(NULLIF(payload->>'method', ''), 'bank'),
    NULLIF(payload->>'reference', ''), NULLIF(payload->>'notes', ''),
    v_key, v_profile_id
  )
  RETURNING id INTO v_payment_id;

  v_remaining := v_amount;

  FOR v_item IN
    SELECT pi.*
    FROM public.payroll_items pi
    WHERE pi.payroll_run_id = v_run.id
      AND pi.deleted_at IS NULL
      AND pi.excluded = false
      AND pi.outstanding_amount > 0
      AND (
        payload->'payroll_item_ids' IS NULL
        OR jsonb_array_length(payload->'payroll_item_ids') = 0
        OR pi.id IN (SELECT (jsonb_array_elements_text(payload->'payroll_item_ids'))::uuid)
      )
    ORDER BY pi.net_salary DESC
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_apply := least(v_item.outstanding_amount, v_remaining);

    UPDATE public.payroll_items
    SET paid_amount = paid_amount + v_apply,
        outstanding_amount = greatest(outstanding_amount - v_apply, 0),
        payment_status = CASE
          WHEN greatest(outstanding_amount - v_apply, 0) = 0 THEN 'paid'
          ELSE 'partial'
        END,
        updated_at = timezone('utc', now())
    WHERE id = v_item.id;

    INSERT INTO public.payroll_payment_allocations (
      organization_id, payroll_payment_id, payroll_item_id, amount
    ) VALUES (v_org_id, v_payment_id, v_item.id, v_apply);

    v_remaining := v_remaining - v_apply;
  END LOOP;

  UPDATE public.financial_accounts
  SET current_balance = current_balance - v_amount, updated_by = v_profile_id
  WHERE id = v_fa.id;

  v_salary_payable := public._coa_by_role(v_org_id, 'salary_payable');
  IF v_salary_payable IS NOT NULL AND v_fa.chart_account_id IS NOT NULL THEN
    v_journal_id := public._post_journal(
      v_org_id, coalesce(v_run.branch_id, v_fa.branch_id),
      'PAYP-' || left(v_payment_id::text, 8),
      'payroll_payment', v_payment_id,
      'Payroll payment ' || v_run.period_label,
      jsonb_build_array(
        jsonb_build_object('chart_account_id', v_salary_payable, 'debit', v_amount, 'credit', 0,
          'description', 'Salary payable'),
        jsonb_build_object('chart_account_id', v_fa.chart_account_id, 'debit', 0, 'credit', v_amount,
          'description', 'Payroll disbursement', 'financial_account_id', v_fa.id)
      ),
      v_profile_id
    );
    UPDATE public.payroll_payments SET journal_entry_id = v_journal_id WHERE id = v_payment_id;
  END IF;

  SELECT coalesce(sum(paid_amount), 0), coalesce(sum(outstanding_amount), 0)
  INTO v_run_paid, v_run_outstanding
  FROM public.payroll_items
  WHERE payroll_run_id = v_run.id AND deleted_at IS NULL AND excluded = false;

  v_new_status := CASE
    WHEN v_run_outstanding <= 0 THEN 'paid'
    WHEN v_run_paid > 0 THEN 'partially_paid'
    ELSE 'payment_pending'
  END;

  UPDATE public.payroll_runs
  SET total_paid = v_run_paid,
      outstanding = v_run_outstanding,
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN timezone('utc', now()) ELSE paid_at END,
      paid_by = CASE WHEN v_new_status IN ('paid', 'partially_paid') THEN v_profile_id ELSE paid_by END,
      payment_journal_entry_id = coalesce(v_journal_id, payment_journal_entry_id),
      updated_by = v_profile_id
  WHERE id = v_run.id;

  RETURN jsonb_build_object(
    'payroll_run_id', v_run.id,
    'payroll_payment_id', v_payment_id,
    'amount_paid', v_amount,
    'status', v_new_status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_payroll_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_payroll_items(jsonb) TO authenticated;
