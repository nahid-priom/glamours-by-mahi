-- Migration 093: RLS lockdown — no employee direct writes to attendance truth
-- Drop org-wide FOR ALL write; self SELECT + permission-gated admin.

--------------------------------------------------------------------------------
-- attendance_records
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_records_org_all ON public.attendance_records;

CREATE POLICY attendance_records_select_self_or_hr ON public.attendance_records
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.read')
      OR public.user_has_permission('hr.attendance.manage')
      OR public.user_has_permission('hr.attendance.review')
      OR public.user_has_permission('hr.payroll.read')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

-- No INSERT/UPDATE/DELETE for authenticated — RPC / service_role only
CREATE POLICY attendance_records_admin_update ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.manage')
      OR public.user_has_permission('hr.attendance.review')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- attendance_raw_logs — read for HR; no client insert
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_raw_logs_org_all ON public.attendance_raw_logs;
CREATE POLICY attendance_raw_logs_select_hr ON public.attendance_raw_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.attendance.read')
      OR public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- employee_attendance_devices
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_attendance_devices_org_all ON public.employee_attendance_devices;

CREATE POLICY employee_attendance_devices_select ON public.employee_attendance_devices
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.device.approve')
      OR public.user_has_permission('hr.device.manage')
      OR public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

-- Employees may insert only pending own device rows via RPC; block direct status=approved
-- No general INSERT policy for authenticated

--------------------------------------------------------------------------------
-- attendance_device_requests
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_device_requests_org_all ON public.attendance_device_requests;
CREATE POLICY attendance_device_requests_select ON public.attendance_device_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.device.approve')
      OR public.user_has_permission('hr.device.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- attendance_events / attempts / challenges — select scoped
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_events_org_select ON public.attendance_events;
CREATE POLICY attendance_events_select ON public.attendance_events
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.attendance.read')
      OR public.user_has_permission('hr.attendance.review')
      OR public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

DROP POLICY IF EXISTS attendance_attempts_org_select ON public.attendance_attempts;
CREATE POLICY attendance_attempts_select ON public.attendance_attempts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.attendance.review')
      OR public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

DROP POLICY IF EXISTS attendance_challenges_org_select ON public.attendance_challenges;
CREATE POLICY attendance_challenges_select ON public.attendance_challenges
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- corrections
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_correction_requests_org_all ON public.attendance_correction_requests;
CREATE POLICY attendance_correction_requests_select ON public.attendance_correction_requests
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.manage')
      OR public.user_has_permission('hr.attendance.review')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- locations / shifts — HR manage write; employees read assigned
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS attendance_locations_org_all ON public.attendance_locations;
CREATE POLICY attendance_locations_select ON public.attendance_locations
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.read')
      OR public.user_has_permission('hr.attendance.location.manage')
      OR public.user_has_permission('hr.attendance.self.read')
      OR public.user_has_permission('hr.attendance.self.submit')
    )
  );
CREATE POLICY attendance_locations_manage ON public.attendance_locations
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('hr.attendance.location.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('hr.attendance.location.manage')
  );

DROP POLICY IF EXISTS work_shifts_org_all ON public.work_shifts;
CREATE POLICY work_shifts_select ON public.work_shifts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_organization_id() AND deleted_at IS NULL);
CREATE POLICY work_shifts_manage ON public.work_shifts
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('hr.attendance.manage')
  )
  WITH CHECK (organization_id = public.current_organization_id());

DROP POLICY IF EXISTS employee_shift_assignments_org_all ON public.employee_shift_assignments;
CREATE POLICY employee_shift_assignments_select ON public.employee_shift_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.manage')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- monthly summary
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS employee_attendance_monthly_summary_org_all ON public.employee_attendance_monthly_summary;
CREATE POLICY employee_attendance_monthly_summary_select ON public.employee_attendance_monthly_summary
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      public.user_has_permission('hr.attendance.read')
      OR public.user_has_permission('hr.payroll.read')
      OR public.user_has_permission('hr.attendance.finalize')
      OR employee_id = public._resolve_employee_for_profile(public.current_profile_id())
    )
  );

--------------------------------------------------------------------------------
-- Harden link_employee_profile audit (additive wrap)
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
  v_profile_org uuid;
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

  IF p_profile_id IS NOT NULL THEN
    SELECT organization_id INTO v_profile_org
    FROM public.profiles WHERE id = p_profile_id AND deleted_at IS NULL;
    IF v_profile_org IS NULL OR v_profile_org IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'Cross-organization profile link forbidden';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.employees e2
      WHERE e2.organization_id = v_org
        AND e2.profile_id = p_profile_id
        AND e2.id <> p_employee_id
        AND e2.deleted_at IS NULL
        AND e2.status <> 'terminated'
    ) THEN
      RAISE EXCEPTION 'Profile already linked to another active employee';
    END IF;
  END IF;

  UPDATE public.employees
  SET profile_id = p_profile_id,
      updated_by = v_actor,
      updated_at = timezone('utc', now())
  WHERE id = p_employee_id;

  INSERT INTO public.attendance_device_audit_logs (
    organization_id, employee_id, actor_user_id, action, new_values, reason
  ) VALUES (
    v_org, p_employee_id, v_actor, 'employee.profile_link',
    jsonb_build_object('profile_id', p_profile_id),
    'link_employee_profile'
  );

  RETURN jsonb_build_object('employee_id', p_employee_id, 'profile_id', p_profile_id);
END;
$$;
