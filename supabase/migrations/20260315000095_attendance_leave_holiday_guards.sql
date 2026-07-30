-- Migration 095: Leave/holiday alignment for monthly summary builder

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
  v_unpaid numeric;
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
    SELECT coalesce(sum(lr.days), 0) INTO v_unpaid
    FROM public.leave_requests lr
    WHERE lr.employee_id = v_emp.id
      AND lr.organization_id = v_org
      AND lr.status = 'approved'
      AND lr.leave_type IN ('unpaid', 'lwp')
      AND lr.start_date <= v_end
      AND lr.end_date >= v_start
      AND lr.deleted_at IS NULL;

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
      -- Absent only when status absent (approved leave/holiday/weekly_off excluded)
      coalesce(sum(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ar.status = 'leave' THEN 1 ELSE 0 END), 0),
      v_unpaid,
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
      unpaid_leave_days = EXCLUDED.unpaid_leave_days,
      holiday_days = EXCLUDED.holiday_days,
      weekend_days = EXCLUDED.weekend_days,
      late_days = EXCLUDED.late_days,
      late_minutes = EXCLUDED.late_minutes,
      early_leave_minutes = EXCLUDED.early_leave_minutes,
      working_minutes = EXCLUDED.working_minutes,
      overtime_minutes = EXCLUDED.overtime_minutes,
      missing_attendance_days = EXCLUDED.missing_attendance_days,
      updated_at = timezone('utc', now()),
      deleted_at = NULL,
      -- Clearing finalized_at on rebuild unless finalize is called again
      finalized_at = NULL,
      finalized_by = NULL;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'year', v_year,
    'month', v_month,
    'period_start', v_start,
    'period_end', v_end,
    'employees_processed', v_count,
    'note', 'Derived cache until finalize_attendance_period snapshots it'
  );
END;
$$;

COMMENT ON TABLE public.employee_attendance_monthly_summary IS
  'Derived attendance cache; becomes period snapshot when finalized_at is set. Payroll calculate_payroll_run still reads approved attendance_records.';
