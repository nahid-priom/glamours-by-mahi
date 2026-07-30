-- Migration 089: Mobile attendance permissions, Haversine, RPCs, self-scope RLS
-- Edge Functions call these SECURITY DEFINER RPCs with the user JWT (or service role after auth).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

--------------------------------------------------------------------------------
-- Permissions (hr.* namespace — no second role system)
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('hr.attendance.self.read', 'Employee: read own attendance'),
  ('hr.attendance.self.submit', 'Employee: submit mobile attendance'),
  ('hr.attendance.device.request', 'Employee: request device registration/change'),
  ('hr.attendance.correction.request', 'Employee: request attendance correction'),
  ('hr.attendance.review', 'Admin: review suspicious attempts'),
  ('hr.attendance.finalize', 'Admin: finalize attendance period'),
  ('hr.attendance.device.approve', 'Admin: approve/reject/revoke mobile devices'),
  ('hr.attendance.location.manage', 'Admin: manage attendance geo locations')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = v.key AND p.deleted_at IS NULL
);

-- Grant self permissions to any role that already has hr.read (employees typically inherit via custom role)
-- Also grant admin mobile device approve to roles with hr.device.manage / hr.attendance.manage
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.key IN (
  'hr.attendance.self.read',
  'hr.attendance.self.submit',
  'hr.attendance.device.request',
  'hr.attendance.correction.request'
)
AND r.name IN ('Super Admin', 'Owner', 'Admin', 'Manager', 'Cashier', 'Salesman', 'Moderator', 'Tele Salesman')
AND coalesce(p.deleted_at, null) IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE p.key IN (
  'hr.attendance.review',
  'hr.attendance.finalize',
  'hr.attendance.device.approve',
  'hr.attendance.location.manage'
)
AND r.name IN ('Super Admin', 'Owner', 'Admin', 'Manager')
AND coalesce(p.deleted_at, null) IS NULL
AND NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
);

--------------------------------------------------------------------------------
-- Haversine distance (metres)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._haversine_metres(
  p_lat1 double precision,
  p_lng1 double precision,
  p_lat2 double precision,
  p_lng2 double precision
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN NULL
    ELSE round((
      2 * 6371000 * asin(sqrt(
        power(sin(radians(p_lat2 - p_lat1) / 2), 2) +
        cos(radians(p_lat1)) * cos(radians(p_lat2)) *
        power(sin(radians(p_lng2 - p_lng1) / 2), 2)
      ))
    )::numeric, 2)
  END;
$$;

REVOKE ALL ON FUNCTION public._haversine_metres(double precision, double precision, double precision, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._haversine_metres(double precision, double precision, double precision, double precision)
  TO service_role;

--------------------------------------------------------------------------------
-- Resolve active employee for current profile (mobile identity gate)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mobile_attendance_employee()
RETURNS public.employees
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_profile_id uuid := public.current_profile_id();
BEGIN
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT e.* INTO v_emp
  FROM public.employees e
  WHERE e.profile_id = v_profile_id
    AND e.organization_id = public.current_organization_id()
    AND e.deleted_at IS NULL
    AND e.status = 'active'
  ORDER BY e.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active employee linked to this account';
  END IF;

  RETURN v_emp;
END;
$$;

REVOKE ALL ON FUNCTION public._mobile_attendance_employee() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._mobile_attendance_employee() TO authenticated, service_role;

--------------------------------------------------------------------------------
-- Active shift for employee on a date
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._employee_active_shift(p_employee_id uuid, p_work_date date)
RETURNS public.work_shifts
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shift public.work_shifts%ROWTYPE;
  v_org uuid := public.current_organization_id();
BEGIN
  SELECT ws.* INTO v_shift
  FROM public.employee_shift_assignments esa
  JOIN public.work_shifts ws ON ws.id = esa.shift_id AND ws.deleted_at IS NULL AND ws.is_active
  WHERE esa.employee_id = p_employee_id
    AND esa.organization_id = v_org
    AND esa.deleted_at IS NULL
    AND esa.effective_from <= p_work_date
    AND (esa.effective_to IS NULL OR esa.effective_to >= p_work_date)
  ORDER BY esa.is_primary DESC, esa.effective_from DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_shift;
  END IF;

  SELECT ws.* INTO v_shift
  FROM public.work_shifts ws
  WHERE ws.organization_id = v_org
    AND ws.code = 'DEFAULT'
    AND ws.deleted_at IS NULL
    AND ws.is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No shift assigned for employee';
  END IF;

  RETURN v_shift;
END;
$$;

REVOKE ALL ON FUNCTION public._employee_active_shift(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._employee_active_shift(uuid, date) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- get_mobile_attendance_context (home screen)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_mobile_attendance_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_emp public.employees%ROWTYPE;
  v_shift public.work_shifts%ROWTYPE;
  v_device public.employee_attendance_devices%ROWTYPE;
  v_today date;
  v_record public.attendance_records%ROWTYPE;
  v_loc public.attendance_locations%ROWTYPE;
BEGIN
  IF NOT (
    public.user_has_permission('hr.attendance.self.read')
    OR public.user_has_permission('hr.attendance.self.submit')
    OR public.user_has_permission('hr.attendance.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  v_emp := public._mobile_attendance_employee();
  v_today := (timezone('Asia/Dhaka', now()))::date;
  v_shift := public._employee_active_shift(v_emp.id, v_today);

  SELECT * INTO v_device
  FROM public.employee_attendance_devices d
  WHERE d.employee_id = v_emp.id
    AND d.deleted_at IS NULL
    AND d.is_active = true
  ORDER BY
    CASE d.status WHEN 'approved' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    d.created_at DESC
  LIMIT 1;

  SELECT * INTO v_record
  FROM public.attendance_records ar
  WHERE ar.employee_id = v_emp.id
    AND ar.work_date = v_today
    AND ar.deleted_at IS NULL;

  SELECT * INTO v_loc
  FROM public.attendance_locations al
  WHERE al.organization_id = v_emp.organization_id
    AND al.branch_id = coalesce(v_emp.branch_id, al.branch_id)
    AND al.deleted_at IS NULL
    AND al.is_active
  ORDER BY al.created_at ASC
  LIMIT 1;

  RETURN jsonb_build_object(
    'server_now', timezone('utc', now()),
    'work_date', v_today,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'employee_code', v_emp.employee_code,
      'full_name', v_emp.full_name,
      'branch_id', v_emp.branch_id,
      'status', v_emp.status
    ),
    'shift', CASE WHEN v_shift.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_shift.id,
      'name', v_shift.name,
      'start_time', v_shift.start_time,
      'end_time', v_shift.end_time,
      'timezone', v_shift.timezone,
      'is_overnight', v_shift.is_overnight
    ) END,
    'device', CASE WHEN v_device.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_device.id,
      'status', v_device.status,
      'platform', v_device.platform,
      'device_name', v_device.device_name,
      'is_active', v_device.is_active
    ) END,
    'today', CASE WHEN v_record.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_record.id,
      'status', v_record.status,
      'first_in', v_record.first_in,
      'last_out', v_record.last_out,
      'late_minutes', v_record.late_minutes,
      'is_approved', v_record.is_approved,
      'requires_review', v_record.requires_review
    ) END,
    'location', CASE WHEN v_loc.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_loc.id,
      'name', v_loc.name,
      'branch_id', v_loc.branch_id,
      'allowed_radius_metres', v_loc.allowed_radius_metres,
      'maximum_accuracy_metres', v_loc.maximum_accuracy_metres,
      'requires_qr', v_loc.requires_qr
    ) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_mobile_attendance_context() TO authenticated;

--------------------------------------------------------------------------------
-- register_attendance_device
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_attendance_device(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_emp public.employees%ROWTYPE;
  v_existing public.employee_attendance_devices%ROWTYPE;
  v_device_id uuid;
  v_request_id uuid;
  v_installation text := NULLIF(btrim(coalesce(payload->>'installation_id', '')), '');
  v_public_key text := NULLIF(btrim(coalesce(payload->>'public_key', '')), '');
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT public.user_has_permission('hr.attendance.device.request') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_installation IS NULL OR v_public_key IS NULL THEN
    RAISE EXCEPTION 'installation_id and public_key are required';
  END IF;

  v_emp := public._mobile_attendance_employee();

  SELECT * INTO v_existing
  FROM public.employee_attendance_devices d
  WHERE d.employee_id = v_emp.id
    AND d.status = 'approved'
    AND d.is_active
    AND d.deleted_at IS NULL;

  IF FOUND THEN
    RAISE EXCEPTION 'An approved device already exists. Submit a device change request.';
  END IF;

  -- Upsert pending device row for this installation
  SELECT id INTO v_device_id
  FROM public.employee_attendance_devices
  WHERE organization_id = v_org
    AND installation_id = v_installation
    AND deleted_at IS NULL;

  IF v_device_id IS NULL THEN
    INSERT INTO public.employee_attendance_devices (
      organization_id, employee_id, auth_user_id, installation_id, platform,
      device_name, device_model, operating_system, os_version, app_version,
      public_key, biometric_supported, biometric_type,
      registration_latitude, registration_longitude, registration_accuracy,
      status, is_active, created_by, updated_by
    ) VALUES (
      v_org, v_emp.id, v_actor, v_installation,
      coalesce(NULLIF(payload->>'platform', ''), 'android'),
      NULLIF(payload->>'device_name', ''),
      NULLIF(payload->>'device_model', ''),
      NULLIF(payload->>'operating_system', ''),
      NULLIF(payload->>'os_version', ''),
      NULLIF(payload->>'app_version', ''),
      v_public_key,
      coalesce((payload->>'biometric_supported')::boolean, false),
      NULLIF(payload->>'biometric_type', ''),
      NULLIF(payload->>'latitude', '')::double precision,
      NULLIF(payload->>'longitude', '')::double precision,
      NULLIF(payload->>'accuracy', '')::double precision,
      'pending', true, v_actor, v_actor
    )
    RETURNING id INTO v_device_id;
  ELSE
    UPDATE public.employee_attendance_devices
    SET public_key = v_public_key,
        employee_id = v_emp.id,
        auth_user_id = v_actor,
        status = 'pending',
        is_active = true,
        device_name = coalesce(NULLIF(payload->>'device_name', ''), device_name),
        biometric_supported = coalesce((payload->>'biometric_supported')::boolean, biometric_supported),
        updated_by = v_actor
    WHERE id = v_device_id;
  END IF;

  INSERT INTO public.attendance_device_requests (
    organization_id, employee_id, auth_user_id, request_type,
    device_payload, public_key, installation_id, status,
    resulting_device_id, created_by, updated_by
  ) VALUES (
    v_org, v_emp.id, v_actor, 'register',
    coalesce(payload, '{}'::jsonb), v_public_key, v_installation, 'pending',
    v_device_id, v_actor, v_actor
  )
  RETURNING id INTO v_request_id;

  INSERT INTO public.attendance_device_audit_logs (
    organization_id, employee_id, device_id, actor_user_id, action, new_values
  ) VALUES (
    v_org, v_emp.id, v_device_id, v_actor, 'device.register_requested',
    jsonb_build_object('request_id', v_request_id, 'installation_id', v_installation)
  );

  RETURN jsonb_build_object(
    'device_id', v_device_id,
    'request_id', v_request_id,
    'status', 'pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_attendance_device(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- approve_attendance_device
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_attendance_device(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_device_id uuid := NULLIF(payload->>'device_id', '')::uuid;
  v_action text := lower(coalesce(payload->>'action', 'approve'));
  v_device public.employee_attendance_devices%ROWTYPE;
  v_new_status text;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('hr.attendance.device.approve')
    OR public.user_has_permission('hr.device.manage')
    OR public.user_has_permission('hr.attendance.manage')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_device
  FROM public.employee_attendance_devices
  WHERE id = v_device_id
    AND organization_id = v_org
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Device not found'; END IF;

  v_new_status := CASE v_action
    WHEN 'approve' THEN 'approved'
    WHEN 'reject' THEN 'rejected'
    WHEN 'revoke' THEN 'revoked'
    WHEN 'block' THEN 'blocked'
    ELSE NULL
  END;

  IF v_new_status IS NULL THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  IF v_new_status = 'approved' THEN
    -- Revoke any other approved device for this employee first
    UPDATE public.employee_attendance_devices
    SET status = 'revoked',
        is_active = false,
        revoked_by = v_actor,
        revoked_at = timezone('utc', now()),
        revoke_reason = 'Superseded by new approved device',
        updated_by = v_actor
    WHERE employee_id = v_device.employee_id
      AND id <> v_device.id
      AND status = 'approved'
      AND deleted_at IS NULL;
  END IF;

  UPDATE public.employee_attendance_devices
  SET status = v_new_status,
      is_active = (v_new_status = 'approved'),
      approved_by = CASE WHEN v_new_status = 'approved' THEN v_actor ELSE approved_by END,
      approved_at = CASE WHEN v_new_status = 'approved' THEN timezone('utc', now()) ELSE approved_at END,
      revoked_by = CASE WHEN v_new_status IN ('revoked', 'blocked', 'rejected') THEN v_actor ELSE revoked_by END,
      revoked_at = CASE WHEN v_new_status IN ('revoked', 'blocked', 'rejected') THEN timezone('utc', now()) ELSE revoked_at END,
      revoke_reason = NULLIF(payload->>'reason', ''),
      updated_by = v_actor
  WHERE id = v_device.id;

  UPDATE public.attendance_device_requests
  SET status = CASE WHEN v_new_status = 'approved' THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_actor,
      reviewed_at = timezone('utc', now()),
      review_notes = NULLIF(payload->>'reason', ''),
      updated_by = v_actor
  WHERE resulting_device_id = v_device.id
    AND status = 'pending'
    AND deleted_at IS NULL;

  INSERT INTO public.attendance_device_audit_logs (
    organization_id, employee_id, device_id, actor_user_id, action,
    old_values, new_values, reason
  ) VALUES (
    v_org, v_device.employee_id, v_device.id, v_actor,
    'device.' || v_action,
    jsonb_build_object('status', v_device.status),
    jsonb_build_object('status', v_new_status),
    NULLIF(payload->>'reason', '')
  );

  RETURN jsonb_build_object('device_id', v_device.id, 'status', v_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_attendance_device(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- create_attendance_challenge
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_attendance_challenge(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_emp public.employees%ROWTYPE;
  v_device public.employee_attendance_devices%ROWTYPE;
  v_event_type text := lower(coalesce(payload->>'event_type', ''));
  v_nonce text := encode(gen_random_bytes(24), 'hex');
  v_challenge_id uuid;
  v_expires timestamptz := timezone('utc', now()) + interval '2 minutes';
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT public.user_has_permission('hr.attendance.self.submit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_event_type NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'event_type must be check_in or check_out';
  END IF;

  v_emp := public._mobile_attendance_employee();

  SELECT * INTO v_device
  FROM public.employee_attendance_devices d
  WHERE d.id = NULLIF(payload->>'device_id', '')::uuid
    AND d.employee_id = v_emp.id
    AND d.organization_id = v_org
    AND d.status = 'approved'
    AND d.is_active
    AND d.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved device required';
  END IF;

  INSERT INTO public.attendance_challenges (
    organization_id, employee_id, device_id, event_type, branch_id,
    nonce_hash, expires_at
  ) VALUES (
    v_org, v_emp.id, v_device.id, v_event_type, v_emp.branch_id,
    encode(extensions.digest(v_nonce, 'sha256'), 'hex'),
    v_expires
  )
  RETURNING id INTO v_challenge_id;

  RETURN jsonb_build_object(
    'challenge_id', v_challenge_id,
    'nonce', v_nonce,
    'event_type', v_event_type,
    'expires_at', v_expires,
    'server_now', timezone('utc', now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_attendance_challenge(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- submit_mobile_attendance (authoritative commit)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_mobile_attendance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_emp public.employees%ROWTYPE;
  v_device public.employee_attendance_devices%ROWTYPE;
  v_challenge public.attendance_challenges%ROWTYPE;
  v_shift public.work_shifts%ROWTYPE;
  v_loc public.attendance_locations%ROWTYPE;
  v_record public.attendance_records%ROWTYPE;
  v_event_id uuid;
  v_attempt_id uuid;
  v_event_type text := lower(coalesce(payload->>'event_type', ''));
  v_challenge_id uuid := NULLIF(payload->>'challenge_id', '')::uuid;
  v_device_id uuid := NULLIF(payload->>'device_id', '')::uuid;
  v_idempotency text := NULLIF(btrim(coalesce(payload->>'idempotency_key', '')), '');
  v_lat double precision := NULLIF(payload->>'latitude', '')::double precision;
  v_lng double precision := NULLIF(payload->>'longitude', '')::double precision;
  v_accuracy double precision := NULLIF(payload->>'accuracy', '')::double precision;
  v_captured_at timestamptz := NULLIF(payload->>'client_captured_at', '')::timestamptz;
  v_biometric boolean := coalesce((payload->>'biometric_verified')::boolean, false);
  v_signature_ok boolean := coalesce((payload->>'device_signature_valid')::boolean, false);
  v_integrity_ok boolean := coalesce((payload->>'integrity_valid')::boolean, false);
  v_qr_token text := NULLIF(payload->>'qr_token', '');
  v_nonce text := NULLIF(payload->>'nonce', '');
  v_distance numeric;
  v_risk numeric := 0;
  v_decision text := 'accepted';
  v_reason text;
  v_work_date date;
  v_server_now timestamptz := timezone('utc', now());
  v_local_now timestamp;
  v_sched_start timestamptz;
  v_sched_end timestamptz;
  v_window_open timestamptz;
  v_window_close timestamptz;
  v_late int := 0;
  v_early int := 0;
  v_working int := 0;
  v_ot int := 0;
  v_status text;
  v_existing_event uuid;
  v_qr_ok boolean := true;
  v_auto_approve boolean := true;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT public.user_has_permission('hr.attendance.self.submit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_idempotency IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  -- Idempotent replay
  SELECT id INTO v_existing_event
  FROM public.attendance_events
  WHERE organization_id = v_org AND idempotency_key = v_idempotency;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'event_id', v_existing_event);
  END IF;

  IF v_event_type NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid event_type';
  END IF;

  v_emp := public._mobile_attendance_employee();

  SELECT * INTO v_device
  FROM public.employee_attendance_devices
  WHERE id = v_device_id
    AND employee_id = v_emp.id
    AND organization_id = v_org
    AND status = 'approved'
    AND is_active
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    v_decision := 'rejected';
    v_reason := 'এই ডিভাইসটি এখনো অনুমোদিত নয়।';
  END IF;

  IF v_decision = 'accepted' THEN
    SELECT * INTO v_challenge
    FROM public.attendance_challenges
    WHERE id = v_challenge_id
      AND organization_id = v_org
      AND employee_id = v_emp.id
      AND device_id = v_device.id
      AND event_type = v_event_type
    FOR UPDATE;

    IF NOT FOUND THEN
      v_decision := 'rejected';
      v_reason := 'Invalid challenge';
    ELSIF v_challenge.used_at IS NOT NULL THEN
      v_decision := 'rejected';
      v_reason := 'Challenge already used';
    ELSIF v_challenge.expires_at < v_server_now THEN
      v_decision := 'rejected';
      v_reason := 'Challenge expired';
    ELSIF v_nonce IS NULL
      OR encode(extensions.digest(v_nonce, 'sha256'), 'hex') <> v_challenge.nonce_hash THEN
      v_decision := 'rejected';
      v_reason := 'Challenge nonce mismatch';
    END IF;
  END IF;

  IF v_decision = 'accepted' AND NOT v_biometric THEN
    v_decision := 'rejected';
    v_reason := 'Fingerprint verification সম্পন্ন হয়নি।';
  END IF;

  IF v_decision = 'accepted' AND NOT v_signature_ok THEN
    v_decision := 'rejected';
    v_reason := 'Device signature invalid';
    v_risk := v_risk + 40;
  END IF;

  v_work_date := (timezone('Asia/Dhaka', v_server_now))::date;
  v_shift := public._employee_active_shift(v_emp.id, v_work_date);
  v_local_now := timezone(v_shift.timezone, v_server_now);

  v_sched_start := (v_work_date + v_shift.start_time) AT TIME ZONE v_shift.timezone;
  IF v_shift.is_overnight THEN
    v_sched_end := ((v_work_date + 1) + v_shift.end_time) AT TIME ZONE v_shift.timezone;
  ELSE
    v_sched_end := (v_work_date + v_shift.end_time) AT TIME ZONE v_shift.timezone;
  END IF;

  IF v_event_type = 'check_in' THEN
    v_window_open := v_sched_start - make_interval(mins => v_shift.check_in_opens_minutes_before);
    v_window_close := v_sched_start + make_interval(mins => v_shift.check_in_closes_minutes_after);
  ELSE
    v_window_open := v_sched_end - make_interval(mins => v_shift.check_out_opens_minutes_before);
    v_window_close := v_sched_end + make_interval(mins => v_shift.check_out_closes_minutes_after);
  END IF;

  IF v_decision = 'accepted' AND (v_server_now < v_window_open OR v_server_now > v_window_close) THEN
    v_decision := 'rejected';
    v_reason := CASE WHEN v_event_type = 'check_in'
      THEN 'Check-in সময় শেষ হয়ে গেছে।'
      ELSE 'Check-out সময়ের বাইরে।'
    END;
  END IF;

  -- Location
  SELECT * INTO v_loc
  FROM public.attendance_locations al
  WHERE al.organization_id = v_org
    AND al.branch_id = coalesce(v_emp.branch_id, al.branch_id)
    AND al.deleted_at IS NULL
    AND al.is_active
  ORDER BY al.created_at ASC
  LIMIT 1;

  IF v_decision = 'accepted' THEN
    IF v_loc.id IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Branch attendance location is not configured';
    ELSIF v_lat IS NULL OR v_lng IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Location required';
    ELSIF v_accuracy IS NULL OR v_accuracy > v_loc.maximum_accuracy_metres THEN
      v_decision := 'rejected';
      v_reason := 'আপনার লোকেশনের নির্ভুলতা যথেষ্ট নয়।';
    ELSIF v_captured_at IS NOT NULL
      AND abs(extract(epoch FROM (v_server_now - v_captured_at))) > v_loc.maximum_location_age_seconds THEN
      v_decision := 'rejected';
      v_reason := 'Location sample is stale';
    ELSE
      v_distance := public._haversine_metres(v_lat, v_lng, v_loc.latitude, v_loc.longitude);
      IF v_distance > v_loc.allowed_radius_metres THEN
        v_decision := 'rejected';
        v_reason := format('আপনি অফিস লোকেশন থেকে %s মিটার দূরে আছেন।', v_distance);
      END IF;
    END IF;
  END IF;

  -- Optional QR
  IF v_decision = 'accepted' AND coalesce(v_loc.requires_qr, false) THEN
    IF v_qr_token IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Branch QR required';
      v_qr_ok := false;
    ELSIF NOT EXISTS (
      SELECT 1 FROM public.attendance_branch_qr_tokens t
      WHERE t.organization_id = v_org
        AND t.branch_id = v_loc.branch_id
        AND t.nonce_hash = encode(extensions.digest(v_qr_token, 'sha256'), 'hex')
        AND t.used_at IS NULL
        AND t.expires_at >= v_server_now
    ) THEN
      v_decision := 'rejected';
      v_reason := 'Branch QR-এর মেয়াদ শেষ হয়ে গেছে।';
      v_qr_ok := false;
    ELSE
      UPDATE public.attendance_branch_qr_tokens
      SET used_at = v_server_now
      WHERE organization_id = v_org
        AND nonce_hash = encode(extensions.digest(v_qr_token, 'sha256'), 'hex')
        AND used_at IS NULL;
    END IF;
  END IF;

  IF coalesce((payload->>'is_mocked')::boolean, false) THEN
    v_risk := v_risk + 25;
  END IF;
  IF NOT v_integrity_ok THEN
    v_risk := v_risk + 15;
  END IF;

  IF v_decision = 'accepted' AND v_risk >= 40 THEN
    v_decision := 'pending_review';
    v_auto_approve := false;
    v_reason := 'আপনার Attendance review-এর জন্য পাঠানো হয়েছে।';
  END IF;

  -- Duplicate check against daily record
  SELECT * INTO v_record
  FROM public.attendance_records
  WHERE employee_id = v_emp.id
    AND work_date = v_work_date
    AND deleted_at IS NULL
  FOR UPDATE;

  IF v_decision IN ('accepted', 'pending_review') AND v_event_type = 'check_in' AND v_record.first_in IS NOT NULL THEN
    v_decision := 'rejected';
    v_reason := 'আজকের Check-in ইতোমধ্যে সম্পন্ন হয়েছে।';
  END IF;

  IF v_decision IN ('accepted', 'pending_review') AND v_event_type = 'check_out' THEN
    IF v_record.id IS NULL OR v_record.first_in IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Check-out without check-in is not allowed';
    ELSIF v_record.last_out IS NOT NULL THEN
      v_decision := 'rejected';
      v_reason := 'Check-out already completed';
    END IF;
  END IF;

  INSERT INTO public.attendance_attempts (
    organization_id, employee_id, device_id, challenge_id, event_type,
    decision, rejection_reason, risk_score, latitude, longitude, accuracy,
    distance_metres, payload, ip_address, user_agent
  ) VALUES (
    v_org, v_emp.id, v_device_id, v_challenge_id, v_event_type,
    v_decision, v_reason, v_risk, v_lat, v_lng, v_accuracy,
    v_distance, payload,
    NULLIF(payload->>'ip_address', ''),
    NULLIF(payload->>'user_agent', '')
  )
  RETURNING id INTO v_attempt_id;

  IF v_decision = 'rejected' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'decision', v_decision,
      'reason', v_reason,
      'attempt_id', v_attempt_id,
      'distance_metres', v_distance
    );
  END IF;

  -- Consume challenge
  UPDATE public.attendance_challenges
  SET used_at = v_server_now
  WHERE id = v_challenge_id;

  -- Late / early / working calc
  IF v_event_type = 'check_in' THEN
    v_late := greatest(0, floor(extract(epoch FROM (v_server_now - v_sched_start)) / 60
      - v_shift.on_time_until_minutes)::int);
    v_status := 'present';
  ELSE
    v_early := greatest(0, floor(extract(epoch FROM (v_sched_end - v_server_now)) / 60
      - v_shift.early_leave_grace_minutes)::int);
    v_working := greatest(0, floor(extract(epoch FROM (v_server_now - v_record.first_in)) / 60)::int);
    v_ot := greatest(0, v_working - floor(extract(epoch FROM (v_sched_end - v_sched_start)) / 60)::int
      - v_shift.overtime_after_minutes);
    v_status := CASE
      WHEN v_record.last_out IS NULL AND v_record.first_in IS NOT NULL THEN 'present'
      ELSE coalesce(v_record.status, 'present')
    END;
  END IF;

  INSERT INTO public.attendance_events (
    organization_id, attendance_record_id, employee_id, device_id, challenge_id,
    event_type, server_received_at, client_captured_at, work_date,
    latitude, longitude, accuracy,
    altitude, heading, speed,
    distance_metres, location_valid, biometric_verified, device_signature_valid,
    integrity_valid, qr_valid, shift_valid, risk_score, decision, rejection_reason,
    idempotency_key, ip_address, user_agent, metadata
  ) VALUES (
    v_org, v_record.id, v_emp.id, v_device.id, v_challenge_id,
    v_event_type, v_server_now, v_captured_at, v_work_date,
    v_lat, v_lng, v_accuracy,
    NULLIF(payload->>'altitude', '')::double precision,
    NULLIF(payload->>'heading', '')::double precision,
    NULLIF(payload->>'speed', '')::double precision,
    v_distance, true, v_biometric, v_signature_ok,
    v_integrity_ok, v_qr_ok, true, v_risk, v_decision, v_reason,
    v_idempotency,
    NULLIF(payload->>'ip_address', ''),
    NULLIF(payload->>'user_agent', ''),
    jsonb_build_object('attempt_id', v_attempt_id)
  )
  RETURNING id INTO v_event_id;

  IF v_record.id IS NULL THEN
    INSERT INTO public.attendance_records (
      organization_id, employee_id, branch_id, work_date, status,
      first_in, last_out, late_minutes, early_leave_minutes,
      working_minutes, overtime_minutes, is_approved,
      source, shift_id, scheduled_start_at, scheduled_end_at,
      check_in_event_id, check_out_event_id, policy_snapshot,
      risk_score, requires_review, created_by, updated_by
    ) VALUES (
      v_org, v_emp.id, v_emp.branch_id, v_work_date, v_status,
      CASE WHEN v_event_type = 'check_in' THEN v_server_now ELSE NULL END,
      CASE WHEN v_event_type = 'check_out' THEN v_server_now ELSE NULL END,
      CASE WHEN v_event_type = 'check_in' THEN v_late ELSE 0 END,
      CASE WHEN v_event_type = 'check_out' THEN v_early ELSE 0 END,
      CASE WHEN v_event_type = 'check_out' THEN v_working ELSE 0 END,
      CASE WHEN v_event_type = 'check_out' THEN v_ot ELSE 0 END,
      v_auto_approve AND v_decision = 'accepted',
      'mobile', v_shift.id, v_sched_start, v_sched_end,
      CASE WHEN v_event_type = 'check_in' THEN v_event_id ELSE NULL END,
      CASE WHEN v_event_type = 'check_out' THEN v_event_id ELSE NULL END,
      jsonb_build_object(
        'location_id', v_loc.id,
        'allowed_radius_metres', v_loc.allowed_radius_metres,
        'shift_id', v_shift.id,
        'calculation_version', '1'
      ),
      v_risk,
      NOT v_auto_approve,
      v_actor, v_actor
    )
    RETURNING * INTO v_record;
  ELSE
    UPDATE public.attendance_records
    SET first_in = CASE WHEN v_event_type = 'check_in' THEN coalesce(first_in, v_server_now) ELSE first_in END,
        last_out = CASE WHEN v_event_type = 'check_out' THEN v_server_now ELSE last_out END,
        late_minutes = CASE WHEN v_event_type = 'check_in' THEN v_late ELSE late_minutes END,
        early_leave_minutes = CASE WHEN v_event_type = 'check_out' THEN v_early ELSE early_leave_minutes END,
        working_minutes = CASE WHEN v_event_type = 'check_out' THEN v_working ELSE working_minutes END,
        overtime_minutes = CASE WHEN v_event_type = 'check_out' THEN v_ot ELSE overtime_minutes END,
        status = CASE
          WHEN v_event_type = 'check_in' AND last_out IS NULL THEN 'present'
          WHEN v_event_type = 'check_out' THEN 'present'
          ELSE status
        END,
        source = 'mobile',
        shift_id = coalesce(shift_id, v_shift.id),
        scheduled_start_at = coalesce(scheduled_start_at, v_sched_start),
        scheduled_end_at = coalesce(scheduled_end_at, v_sched_end),
        check_in_event_id = CASE WHEN v_event_type = 'check_in' THEN v_event_id ELSE check_in_event_id END,
        check_out_event_id = CASE WHEN v_event_type = 'check_out' THEN v_event_id ELSE check_out_event_id END,
        is_approved = CASE WHEN v_auto_approve AND v_decision = 'accepted' THEN true ELSE is_approved END,
        requires_review = CASE WHEN NOT v_auto_approve THEN true ELSE requires_review END,
        risk_score = greatest(risk_score, v_risk),
        updated_by = v_actor
    WHERE id = v_record.id
    RETURNING * INTO v_record;
  END IF;

  UPDATE public.attendance_events
  SET attendance_record_id = v_record.id
  WHERE id = v_event_id;

  -- Mirror into raw logs for hardware-compatible audit trail
  INSERT INTO public.attendance_raw_logs (
    organization_id, device_user_id, employee_id, punched_at, punch_type,
    external_event_id, raw_payload, processing_status, processed_at
  ) VALUES (
    v_org, v_emp.employee_code, v_emp.id, v_server_now,
    CASE WHEN v_event_type = 'check_in' THEN 'in' ELSE 'out' END,
    v_idempotency,
    jsonb_build_object('source', 'mobile', 'event_id', v_event_id),
    'processed', v_server_now
  );

  UPDATE public.employee_attendance_devices
  SET last_used_at = v_server_now, updated_by = v_actor
  WHERE id = v_device.id;

  RETURN jsonb_build_object(
    'ok', true,
    'decision', v_decision,
    'reason', v_reason,
    'event_id', v_event_id,
    'attempt_id', v_attempt_id,
    'attendance_record_id', v_record.id,
    'work_date', v_work_date,
    'first_in', v_record.first_in,
    'last_out', v_record.last_out,
    'late_minutes', v_record.late_minutes,
    'is_approved', v_record.is_approved,
    'distance_metres', v_distance,
    'server_now', v_server_now
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_mobile_attendance(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Correction request + admin review
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_attendance_correction(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_emp public.employees%ROWTYPE;
  v_id uuid;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT public.user_has_permission('hr.attendance.correction.request') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;
  v_emp := public._mobile_attendance_employee();

  INSERT INTO public.attendance_correction_requests (
    organization_id, employee_id, attendance_record_id, work_date,
    request_type, reason, requested_check_in_at, requested_check_out_at,
    created_by, updated_by
  ) VALUES (
    v_org, v_emp.id,
    NULLIF(payload->>'attendance_record_id', '')::uuid,
    coalesce(NULLIF(payload->>'work_date', '')::date, (timezone('Asia/Dhaka', now()))::date),
    coalesce(NULLIF(payload->>'request_type', ''), 'correction'),
    coalesce(NULLIF(payload->>'reason', ''), 'Correction requested'),
    NULLIF(payload->>'requested_check_in_at', '')::timestamptz,
    NULLIF(payload->>'requested_check_out_at', '')::timestamptz,
    v_actor, v_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_attendance_correction(jsonb) TO authenticated;

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

  IF v_action = 'approve' THEN
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
    WHERE employee_id = v_req.employee_id
      AND work_date = v_req.work_date
      AND deleted_at IS NULL;

    IF NOT FOUND THEN
      INSERT INTO public.attendance_records (
        organization_id, employee_id, work_date, status,
        first_in, last_out, is_approved, source, notes, created_by, updated_by
      )
      SELECT e.organization_id, e.id, v_req.work_date, 'present',
        v_req.requested_check_in_at, v_req.requested_check_out_at,
        true, 'manual', 'Correction approved', v_actor, v_actor
      FROM public.employees e
      WHERE e.id = v_req.employee_id;
    END IF;
  END IF;

  UPDATE public.attendance_correction_requests
  SET status = CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END,
      reviewed_by = v_actor,
      reviewed_at = timezone('utc', now()),
      review_notes = NULLIF(payload->>'notes', ''),
      updated_by = v_actor
  WHERE id = v_req.id;

  RETURN jsonb_build_object('id', v_req.id, 'status', CASE WHEN v_action = 'approve' THEN 'approved' ELSE 'rejected' END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_attendance_correction(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Issue rotating branch QR (ERP)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_attendance_branch_qr(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid;
  v_org uuid;
  v_branch_id uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_nonce text := encode(gen_random_bytes(16), 'hex');
  v_expires timestamptz := timezone('utc', now()) + interval '45 seconds';
  v_id uuid;
  v_loc_id uuid;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.manage')
    OR public.user_has_permission('hr.attendance.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id required';
  END IF;

  SELECT id INTO v_loc_id
  FROM public.attendance_locations
  WHERE organization_id = v_org AND branch_id = v_branch_id AND deleted_at IS NULL AND is_active
  LIMIT 1;

  INSERT INTO public.attendance_branch_qr_tokens (
    organization_id, branch_id, location_id, nonce_hash, expires_at, created_by
  ) VALUES (
    v_org, v_branch_id, v_loc_id,
    encode(extensions.digest(v_nonce, 'sha256'), 'hex'),
    v_expires, v_actor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'branch_id', v_branch_id,
    'token', v_nonce,
    'issued_at', timezone('utc', now()),
    'expires_at', v_expires
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_attendance_branch_qr(jsonb) TO authenticated;
