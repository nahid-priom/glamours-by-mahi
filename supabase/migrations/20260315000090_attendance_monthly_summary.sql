-- Migration 090: Monthly attendance summary for payroll reports (does not change calculate_payroll_run)

CREATE TABLE IF NOT EXISTS public.employee_attendance_monthly_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  employee_id uuid NOT NULL REFERENCES public.employees (id),
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_start date NOT NULL,
  period_end date NOT NULL,
  payroll_period_id uuid,
  scheduled_days int NOT NULL DEFAULT 0,
  present_days numeric(8, 2) NOT NULL DEFAULT 0,
  absent_days numeric(8, 2) NOT NULL DEFAULT 0,
  paid_leave_days numeric(8, 2) NOT NULL DEFAULT 0,
  unpaid_leave_days numeric(8, 2) NOT NULL DEFAULT 0,
  holiday_days numeric(8, 2) NOT NULL DEFAULT 0,
  weekend_days numeric(8, 2) NOT NULL DEFAULT 0,
  late_days int NOT NULL DEFAULT 0,
  late_minutes int NOT NULL DEFAULT 0,
  early_leave_minutes int NOT NULL DEFAULT 0,
  working_minutes int NOT NULL DEFAULT 0,
  overtime_minutes int NOT NULL DEFAULT 0,
  missing_attendance_days int NOT NULL DEFAULT 0,
  finalized_at timestamptz,
  finalized_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (organization_id, employee_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS employee_attendance_monthly_summary_period_idx
  ON public.employee_attendance_monthly_summary (organization_id, period_year, period_month)
  WHERE deleted_at IS NULL;

CREATE TRIGGER employee_attendance_monthly_summary_set_updated_at
  BEFORE UPDATE ON public.employee_attendance_monthly_summary
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_attendance_monthly_summary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_attendance_monthly_summary_org_all ON public.employee_attendance_monthly_summary;
CREATE POLICY employee_attendance_monthly_summary_org_all ON public.employee_attendance_monthly_summary
  FOR ALL TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL)
  WITH CHECK (organization_id = public.current_organization_id());

CREATE OR REPLACE FUNCTION public.build_monthly_attendance_summary(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_year int := coalesce((payload->>'year')::int, extract(year from timezone('Asia/Dhaka', now()))::int);
  v_month int := coalesce((payload->>'month')::int, extract(month from timezone('Asia/Dhaka', now()))::int);
  v_start date;
  v_end date;
  v_emp record;
  v_count int := 0;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.finalize')
    OR public.user_has_permission('hr.attendance.manage')
    OR public.user_has_permission('hr.payroll.calculate')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_start := make_date(v_year, v_month, 1);
  v_end := (v_start + interval '1 month' - interval '1 day')::date;

  FOR v_emp IN
    SELECT e.id
    FROM public.employees e
    WHERE e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.status = 'active'
      AND (
        NULLIF(payload->>'employee_id', '') IS NULL
        OR e.id = (payload->>'employee_id')::uuid
      )
  LOOP
    INSERT INTO public.employee_attendance_monthly_summary AS s (
      organization_id, employee_id, period_year, period_month,
      period_start, period_end,
      scheduled_days, present_days, absent_days, paid_leave_days,
      unpaid_leave_days, holiday_days, weekend_days,
      late_days, late_minutes, early_leave_minutes,
      working_minutes, overtime_minutes, missing_attendance_days,
      updated_at
    )
    SELECT
      v_org, v_emp.id, v_year, v_month, v_start, v_end,
      public._payroll_scheduled_days(v_start, v_end),
      coalesce(sum(CASE WHEN ar.status = 'present' THEN 1 WHEN ar.status = 'half_day' THEN 0.5 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END), 0),
      0,
      coalesce(sum(CASE WHEN ar.status = 'holiday' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'weekly_off' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.late_minutes > 0 THEN 1 ELSE 0 END), 0)::int,
      coalesce(sum(ar.late_minutes), 0)::int,
      coalesce(sum(ar.early_leave_minutes), 0)::int,
      coalesce(sum(ar.working_minutes), 0)::int,
      coalesce(sum(ar.overtime_minutes), 0)::int,
      coalesce(sum(CASE WHEN ar.status = 'missing_checkout' THEN 1 ELSE 0 END), 0)::int,
      timezone('utc', now())
    FROM public.attendance_records ar
    WHERE ar.employee_id = v_emp.id
      AND ar.organization_id = v_org
      AND ar.work_date BETWEEN v_start AND v_end
      AND ar.deleted_at IS NULL
      AND ar.is_approved = true
    ON CONFLICT (organization_id, employee_id, period_year, period_month)
    DO UPDATE SET
      scheduled_days = EXCLUDED.scheduled_days,
      present_days = EXCLUDED.present_days,
      absent_days = EXCLUDED.absent_days,
      paid_leave_days = EXCLUDED.paid_leave_days,
      holiday_days = EXCLUDED.holiday_days,
      weekend_days = EXCLUDED.weekend_days,
      late_days = EXCLUDED.late_days,
      late_minutes = EXCLUDED.late_minutes,
      early_leave_minutes = EXCLUDED.early_leave_minutes,
      working_minutes = EXCLUDED.working_minutes,
      overtime_minutes = EXCLUDED.overtime_minutes,
      missing_attendance_days = EXCLUDED.missing_attendance_days,
      updated_at = timezone('utc', now()),
      deleted_at = NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'year', v_year,
    'month', v_month,
    'period_start', v_start,
    'period_end', v_end,
    'employees_processed', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_monthly_attendance_summary(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.finalize_attendance_period(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_year int := (payload->>'year')::int;
  v_month int := (payload->>'month')::int;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.finalize')
    OR public.user_has_permission('hr.attendance.manage')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_result := public.build_monthly_attendance_summary(payload);

  UPDATE public.employee_attendance_monthly_summary
  SET finalized_at = timezone('utc', now()),
      finalized_by = v_actor
  WHERE organization_id = v_org
    AND period_year = v_year
    AND period_month = v_month
    AND deleted_at IS NULL;

  RETURN v_result || jsonb_build_object('finalized', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_attendance_period(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.recalculate_employee_attendance_range(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_employee_id uuid := NULLIF(payload->>'employee_id', '')::uuid;
  v_from date := NULLIF(payload->>'from', '')::date;
  v_to date := NULLIF(payload->>'to', '')::date;
  v_months int := 0;
  v_cursor date;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.manage')
    OR public.user_has_permission('hr.attendance.finalize')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_employee_id IS NULL OR v_from IS NULL OR v_to IS NULL THEN
    RAISE EXCEPTION 'employee_id, from, and to are required';
  END IF;

  v_cursor := date_trunc('month', v_from::timestamp)::date;
  WHILE v_cursor <= v_to LOOP
    PERFORM public.build_monthly_attendance_summary(jsonb_build_object(
      'year', extract(year from v_cursor)::int,
      'month', extract(month from v_cursor)::int,
      'employee_id', v_employee_id
    ));
    v_months := v_months + 1;
    v_cursor := (v_cursor + interval '1 month')::date;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'months_rebuilt', v_months);
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_employee_attendance_range(jsonb) TO authenticated;
