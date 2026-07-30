-- Migration 094: Correction adjustments + payroll stability (no silent finalized pay mutation)

CREATE OR REPLACE FUNCTION public.review_attendance_correction(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_req public.attendance_correction_requests%ROWTYPE;
  v_action text := lower(coalesce(payload->>'action', ''));
  v_before jsonb;
  v_after jsonb;
  v_record public.attendance_records%ROWTYPE;
  v_payroll_locked boolean := false;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.manage')
    OR public.user_has_permission('hr.attendance.review')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.attendance_correction_requests
  WHERE id = NULLIF(payload->>'id', '')::uuid
    AND organization_id = v_org
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_req.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;

  SELECT * INTO v_record
  FROM public.attendance_records
  WHERE employee_id = v_req.employee_id
    AND work_date = v_req.work_date
    AND deleted_at IS NULL
  FOR UPDATE;

  v_before := CASE WHEN v_record.id IS NULL THEN '{}'::jsonb ELSE to_jsonb(v_record) END;

  IF EXISTS (
    SELECT 1 FROM public.payroll_runs pr
    WHERE pr.organization_id = v_org
      AND pr.deleted_at IS NULL
      AND pr.status IN ('approved', 'payment_pending', 'partially_paid', 'paid', 'closed')
      AND v_req.work_date BETWEEN pr.period_start AND pr.period_end
  ) THEN
    v_payroll_locked := true;
  END IF;

  IF v_action = 'approve' THEN
    IF v_payroll_locked THEN
      -- Do not silently change pay; mark runs needing recalculation
      UPDATE public.payroll_runs
      SET status = CASE
            WHEN status IN ('approved', 'payment_pending') THEN 'recalculation_required'
            ELSE status
          END,
          updated_by = v_actor
      WHERE organization_id = v_org
        AND deleted_at IS NULL
        AND status IN ('approved', 'payment_pending')
        AND v_req.work_date BETWEEN period_start AND period_end;
    END IF;

    IF v_record.id IS NULL THEN
      INSERT INTO public.attendance_records (
        organization_id, employee_id, work_date, status,
        first_in, last_out, is_approved, source, notes, created_by, updated_by
      )
      SELECT e.organization_id, e.id, v_req.work_date, 'present',
        v_req.requested_check_in_at, v_req.requested_check_out_at,
        true, 'manual', 'Correction approved (events preserved)', v_actor, v_actor
      FROM public.employees e
      WHERE e.id = v_req.employee_id
      RETURNING * INTO v_record;
    ELSE
      UPDATE public.attendance_records
      SET first_in = coalesce(v_req.requested_check_in_at, first_in),
          last_out = coalesce(v_req.requested_check_out_at, last_out),
          status = CASE
            WHEN coalesce(v_req.requested_check_in_at, first_in) IS NOT NULL
             AND coalesce(v_req.requested_check_out_at, last_out) IS NULL
              THEN 'missing_checkout'
            WHEN coalesce(v_req.requested_check_in_at, first_in) IS NOT NULL
              THEN 'present'
            ELSE status
          END,
          is_approved = true,
          requires_review = false,
          notes = coalesce(notes || E'\n', '') || 'Correction approved: ' || v_req.reason,
          updated_by = v_actor
      WHERE id = v_record.id
      RETURNING * INTO v_record;
    END IF;

    v_after := to_jsonb(v_record);

    INSERT INTO public.attendance_adjustments (
      organization_id, employee_id, attendance_record_id, work_date,
      correction_request_id, before_values, after_values, reason, approved_by
    ) VALUES (
      v_org, v_req.employee_id, v_record.id, v_req.work_date,
      v_req.id, v_before, v_after, v_req.reason, v_actor
    );

    -- Recalculate monthly summary for affected month (derived cache)
    PERFORM public.build_monthly_attendance_summary(jsonb_build_object(
      'year', extract(year from v_req.work_date)::int,
      'month', extract(month from v_req.work_date)::int,
      'employee_id', v_req.employee_id
    ));
  END IF;

  UPDATE public.attendance_correction_requests
  SET status = CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_actor,
      reviewed_at = timezone('utc', now()),
      review_notes = NULLIF(payload->>'notes', ''),
      after_values = coalesce(v_after, after_values),
      before_values = coalesce(v_before, before_values),
      updated_by = v_actor
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'id', v_req.id,
    'status', CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    'payroll_locked', v_payroll_locked
  );
END;
$$;
