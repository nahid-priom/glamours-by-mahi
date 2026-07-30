-- Migration 092: Hardened challenge + submit (attestation HMAC, no client biometric trust, overnight work_date)
-- REVOKE submit from authenticated — service_role / Edge only.

--------------------------------------------------------------------------------
-- Overnight-aware work date
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._attendance_work_date(
  p_server_now timestamptz,
  p_shift public.work_shifts
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_local timestamp;
  v_date date;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  v_local := timezone(p_shift.timezone, p_server_now);
  v_date := v_local::date;

  IF NOT p_shift.is_overnight THEN
    RETURN v_date;
  END IF;

  -- Overnight: if local time is before shift end and after midnight, belong to previous calendar day
  v_start := (v_date + p_shift.start_time) AT TIME ZONE p_shift.timezone;
  v_end := ((v_date + 1) + p_shift.end_time) AT TIME ZONE p_shift.timezone;

  IF p_server_now < v_start AND p_server_now <= ((v_date + p_shift.end_time) AT TIME ZONE p_shift.timezone) THEN
    -- early morning checkout of overnight shift that started previous evening
    RETURN (v_date - 1);
  END IF;

  RETURN v_date;
END;
$$;

--------------------------------------------------------------------------------
-- create_attendance_challenge (90s, bound shift/location)
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
  v_shift public.work_shifts%ROWTYPE;
  v_loc public.attendance_locations%ROWTYPE;
  v_event_type text := lower(coalesce(payload->>'event_type', ''));
  v_nonce text := encode(extensions.gen_random_bytes(24), 'hex');
  v_integrity_nonce text := encode(extensions.gen_random_bytes(16), 'hex');
  v_challenge_id uuid;
  v_expires timestamptz := timezone('utc', now()) + interval '90 seconds';
  v_work_date date;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();

  IF NOT public.user_has_permission('hr.attendance.self.submit') THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT public._attendance_rate_limit(v_org, 'challenge:' || v_actor::text, 20, 60) THEN
    RAISE EXCEPTION 'Too many challenge requests';
  END IF;

  IF v_event_type NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'event_type must be check_in or check_out';
  END IF;

  v_emp := public._mobile_attendance_employee();
  IF v_emp.status <> 'active' THEN
    RAISE EXCEPTION 'Employee inactive';
  END IF;

  SELECT * INTO v_device
  FROM public.employee_attendance_devices d
  WHERE d.id = NULLIF(payload->>'device_id', '')::uuid
    AND d.employee_id = v_emp.id
    AND d.organization_id = v_org
    AND d.status = 'approved'
    AND d.is_active
    AND d.revoked_at IS NULL
    AND d.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approved device required';
  END IF;

  v_work_date := (timezone('Asia/Dhaka', timezone('utc', now())))::date;
  v_shift := public._employee_active_shift(v_emp.id, v_work_date);
  v_work_date := public._attendance_work_date(timezone('utc', now()), v_shift);

  SELECT * INTO v_loc
  FROM public.attendance_locations al
  WHERE al.organization_id = v_org
    AND al.branch_id = coalesce(v_emp.branch_id, al.branch_id)
    AND al.deleted_at IS NULL
    AND al.is_active
  ORDER BY al.created_at ASC
  LIMIT 1;

  INSERT INTO public.attendance_challenges (
    organization_id, employee_id, device_id, event_type, branch_id,
    shift_id, location_id, qr_required, integrity_nonce_hash,
    nonce_hash, expires_at, canonical_context
  ) VALUES (
    v_org, v_emp.id, v_device.id, v_event_type, v_emp.branch_id,
    v_shift.id, v_loc.id, coalesce(v_loc.requires_qr, false),
    encode(extensions.digest(v_integrity_nonce, 'sha256'), 'hex'),
    encode(extensions.digest(v_nonce, 'sha256'), 'hex'),
    v_expires,
    jsonb_build_object(
      'employee_id', v_emp.id,
      'organization_id', v_org,
      'branch_id', v_emp.branch_id,
      'shift_id', v_shift.id,
      'location_id', v_loc.id,
      'work_date', v_work_date,
      'auth_user_id', v_actor
    )
  )
  RETURNING id INTO v_challenge_id;

  RETURN jsonb_build_object(
    'challenge_id', v_challenge_id,
    'nonce', v_nonce,
    'integrity_nonce', v_integrity_nonce,
    'event_type', v_event_type,
    'expires_at', v_expires,
    'server_now', timezone('utc', now()),
    'employee_id', v_emp.id,
    'organization_id', v_org,
    'branch_id', v_emp.branch_id,
    'shift_id', v_shift.id,
    'attendance_location_id', v_loc.id,
    'attendance_date', v_work_date,
    'qr_required', coalesce(v_loc.requires_qr, false)
  );
END;
$$;

--------------------------------------------------------------------------------
-- submit_mobile_attendance — attestation required; ignore client biometric/signature booleans
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_mobile_attendance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := NULLIF(payload->>'auth_user_id', '')::uuid;
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
  v_payload_hash text := NULLIF(btrim(coalesce(payload->>'canonical_payload_hash', '')), '');
  v_attestation text := NULLIF(btrim(coalesce(payload->>'submit_attestation', '')), '');
  v_lat double precision := NULLIF(payload->>'latitude', '')::double precision;
  v_lng double precision := NULLIF(payload->>'longitude', '')::double precision;
  v_accuracy double precision := NULLIF(payload->>'accuracy', '')::double precision;
  v_captured_at timestamptz := NULLIF(payload->>'client_captured_at', '')::timestamptz;
  v_integrity_ok boolean := coalesce((payload->>'integrity_valid')::boolean, false);
  v_attestation_ok boolean := coalesce((payload->>'attestation_valid')::boolean, false);
  v_biometric_gate boolean := coalesce((payload->>'biometric_gate_used')::boolean, false);
  v_signature_verified boolean := coalesce((payload->>'edge_signature_verified')::boolean, false);
  v_qr_token text := NULLIF(payload->>'qr_token', '');
  v_nonce text := NULLIF(payload->>'nonce', '');
  v_distance numeric;
  v_risk numeric := 0;
  v_decision text := 'accepted';
  v_reason text;
  v_work_date date;
  v_server_now timestamptz := timezone('utc', now());
  v_sched_start timestamptz;
  v_sched_end timestamptz;
  v_window_open timestamptz;
  v_window_close timestamptz;
  v_late int := 0;
  v_early int := 0;
  v_working int := 0;
  v_ot int := 0;
  v_status text;
  v_existing_hash text;
  v_existing_event uuid;
  v_qr_ok boolean := true;
  v_auto_approve boolean := true;
  v_expected_attestation text;
BEGIN
  -- Only service_role path should set edge_signature_verified + attestation
  IF NOT (v_attestation_ok AND v_signature_verified AND v_attestation IS NOT NULL AND v_payload_hash IS NOT NULL) THEN
    RAISE EXCEPTION 'Submit requires Edge attestation' USING ERRCODE = '42501';
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'auth_user_id required';
  END IF;

  SELECT organization_id INTO v_org FROM public.profiles WHERE id = v_actor AND deleted_at IS NULL;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Bind attestation: HMAC(canonical_hash|challenge_id|device_id|auth_user_id)
  v_expected_attestation := public._attendance_hmac_hex(
    'attendance_submit_hmac',
    v_payload_hash || '|' || coalesce(v_challenge_id::text, '') || '|' ||
      coalesce(v_device_id::text, '') || '|' || v_actor::text
  );
  IF v_attestation IS DISTINCT FROM v_expected_attestation THEN
    RAISE EXCEPTION 'Invalid submit attestation' USING ERRCODE = '42501';
  END IF;

  IF v_idempotency IS NULL THEN
    RAISE EXCEPTION 'idempotency_key is required';
  END IF;

  SELECT payload_hash, event_id INTO v_existing_hash, v_existing_event
  FROM public.attendance_idempotency_payloads
  WHERE organization_id = v_org AND idempotency_key = v_idempotency;

  IF FOUND THEN
    IF v_existing_hash IS DISTINCT FROM v_payload_hash THEN
      RAISE EXCEPTION 'Idempotency key reused with different payload' USING ERRCODE = '23505';
    END IF;
    RETURN jsonb_build_object('ok', true, 'idempotent', true, 'event_id', v_existing_event);
  END IF;

  IF v_event_type NOT IN ('check_in', 'check_out') THEN
    RAISE EXCEPTION 'Invalid event_type';
  END IF;

  SELECT e.* INTO v_emp
  FROM public.employees e
  WHERE e.profile_id = v_actor
    AND e.organization_id = v_org
    AND e.deleted_at IS NULL
    AND e.status = 'active'
  ORDER BY e.created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active employee linked to this account';
  END IF;

  SELECT * INTO v_device
  FROM public.employee_attendance_devices
  WHERE id = v_device_id
    AND employee_id = v_emp.id
    AND organization_id = v_org
    AND status = 'approved'
    AND is_active
    AND revoked_at IS NULL
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

  IF v_decision = 'accepted' AND NOT v_biometric_gate THEN
    v_decision := 'rejected';
    v_reason := 'Fingerprint verification সম্পন্ন হয়নি।';
  END IF;

  IF v_decision = 'accepted' AND NOT v_integrity_ok THEN
    v_risk := v_risk + 90;
  END IF;

  v_shift := public._employee_active_shift(v_emp.id, coalesce(
    (v_challenge.canonical_context->>'work_date')::date,
    (timezone('Asia/Dhaka', v_server_now))::date
  ));
  v_work_date := public._attendance_work_date(v_server_now, v_shift);

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

  SELECT * INTO v_loc
  FROM public.attendance_locations al
  WHERE al.id = coalesce(v_challenge.location_id, al.id)
    AND al.organization_id = v_org
    AND al.deleted_at IS NULL
    AND al.is_active
  ORDER BY CASE WHEN al.id = v_challenge.location_id THEN 0 ELSE 1 END, al.created_at
  LIMIT 1;

  IF v_decision = 'accepted' THEN
    IF v_loc.id IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Branch attendance location is not configured';
    ELSIF v_lat IS NULL OR v_lng IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Location required';
    ELSIF v_accuracy IS NULL OR v_accuracy <= 0 OR v_accuracy > v_loc.maximum_accuracy_metres THEN
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

  IF v_decision = 'accepted' AND coalesce(v_challenge.qr_required, false) THEN
    IF v_qr_token IS NULL THEN
      v_decision := 'rejected';
      v_reason := 'Branch QR required';
      v_qr_ok := false;
    ELSE
      PERFORM 1 FROM public.attendance_branch_qr_tokens t
      WHERE t.organization_id = v_org
        AND t.branch_id = v_loc.branch_id
        AND t.expires_at >= v_server_now
        AND (t.used_at IS NULL OR t.single_use = false)
        AND (
          t.nonce_hash = encode(extensions.digest(v_qr_token, 'sha256'), 'hex')
          OR t.hmac_signature = public._attendance_hmac_hex('attendance_qr_hmac', v_qr_token)
        )
      FOR UPDATE;
      IF NOT FOUND THEN
        v_decision := 'rejected';
        v_reason := 'Branch QR-এর মেয়াদ শেষ হয়ে গেছে।';
        v_qr_ok := false;
      ELSE
        UPDATE public.attendance_branch_qr_tokens
        SET used_at = coalesce(used_at, v_server_now)
        WHERE organization_id = v_org
          AND nonce_hash = encode(extensions.digest(v_qr_token, 'sha256'), 'hex')
          AND single_use = true
          AND used_at IS NULL;
      END IF;
    END IF;
  END IF;

  IF coalesce((payload->>'is_mocked')::boolean, false) THEN v_risk := v_risk + 40; END IF;
  IF coalesce((payload->>'is_emulator')::boolean, false) THEN v_risk := v_risk + 35; END IF;
  IF NOT v_integrity_ok THEN v_risk := v_risk + 50; END IF;

  IF v_decision = 'accepted' AND v_risk >= 90 THEN
    v_decision := 'rejected';
    v_reason := 'Attendance rejected by risk policy';
  ELSIF v_decision = 'accepted' AND v_risk >= 60 THEN
    v_decision := 'pending_review';
    v_auto_approve := false;
    v_reason := 'আপনার Attendance review-এর জন্য পাঠানো হয়েছে।';
  ELSIF v_decision = 'accepted' AND v_risk >= 30 THEN
    v_auto_approve := true; -- accept and flag via requires_review
  END IF;

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
    v_distance, payload - 'submit_attestation',
    NULLIF(payload->>'ip_address', ''),
    NULLIF(payload->>'user_agent', '')
  )
  RETURNING id INTO v_attempt_id;

  IF v_decision = 'rejected' THEN
    RETURN jsonb_build_object(
      'ok', false, 'decision', v_decision, 'reason', v_reason,
      'attempt_id', v_attempt_id, 'distance_metres', v_distance
    );
  END IF;

  UPDATE public.attendance_challenges SET used_at = v_server_now WHERE id = v_challenge_id;

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
    v_status := 'present';
  END IF;

  INSERT INTO public.attendance_events (
    organization_id, attendance_record_id, employee_id, device_id, challenge_id,
    event_type, server_received_at, client_captured_at, work_date,
    latitude, longitude, accuracy, distance_metres, location_valid,
    biometric_verified, biometric_gate_used, device_signature_valid, attestation_valid,
    integrity_valid, qr_valid, shift_valid, risk_score, decision, rejection_reason,
    idempotency_key, canonical_payload_hash, ip_address, user_agent, metadata
  ) VALUES (
    v_org, v_record.id, v_emp.id, v_device.id, v_challenge_id,
    v_event_type, v_server_now, v_captured_at, v_work_date,
    v_lat, v_lng, v_accuracy, v_distance, true,
    false, v_biometric_gate, true, true,
    v_integrity_ok, v_qr_ok, true, v_risk, v_decision, v_reason,
    v_idempotency, v_payload_hash,
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
      jsonb_build_object('location_id', v_loc.id, 'shift_id', v_shift.id, 'calculation_version', '2'),
      v_risk, (v_risk >= 30 OR NOT v_auto_approve), v_actor, v_actor
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
        status = 'present',
        source = 'mobile',
        shift_id = coalesce(shift_id, v_shift.id),
        check_in_event_id = CASE WHEN v_event_type = 'check_in' THEN v_event_id ELSE check_in_event_id END,
        check_out_event_id = CASE WHEN v_event_type = 'check_out' THEN v_event_id ELSE check_out_event_id END,
        is_approved = CASE WHEN v_auto_approve AND v_decision = 'accepted' THEN true ELSE is_approved END,
        requires_review = CASE WHEN v_risk >= 30 OR NOT v_auto_approve THEN true ELSE requires_review END,
        risk_score = greatest(risk_score, v_risk),
        updated_by = v_actor
    WHERE id = v_record.id
    RETURNING * INTO v_record;
  END IF;

  UPDATE public.attendance_events SET attendance_record_id = v_record.id WHERE id = v_event_id;

  INSERT INTO public.attendance_idempotency_payloads (
    organization_id, idempotency_key, payload_hash, event_id
  ) VALUES (v_org, v_idempotency, v_payload_hash, v_event_id);

  UPDATE public.employee_attendance_devices
  SET last_used_at = v_server_now WHERE id = v_device.id;

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

REVOKE ALL ON FUNCTION public.submit_mobile_attendance(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_mobile_attendance(jsonb) TO service_role;

-- Helper for Edge to mint attestation (service_role)
CREATE OR REPLACE FUNCTION public.mint_attendance_submit_attestation(
  p_payload_hash text,
  p_challenge_id uuid,
  p_device_id uuid,
  p_auth_user_id uuid
)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public._attendance_hmac_hex(
    'attendance_submit_hmac',
    p_payload_hash || '|' || p_challenge_id::text || '|' || p_device_id::text || '|' || p_auth_user_id::text
  );
$$;

REVOKE ALL ON FUNCTION public.mint_attendance_submit_attestation(text, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mint_attendance_submit_attestation(text, uuid, uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Hardened QR issue (HMAC signed; manage permission)
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
  v_nonce text := encode(extensions.gen_random_bytes(16), 'hex');
  v_expires timestamptz := timezone('utc', now()) + interval '45 seconds';
  v_id uuid;
  v_loc_id uuid;
  v_body text;
  v_hmac text;
BEGIN
  SELECT * INTO v_actor, v_org FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('hr.attendance.manage')
    OR public.user_has_permission('hr.attendance.device.approve')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id required'; END IF;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_loc_id
  FROM public.attendance_locations
  WHERE organization_id = v_org AND branch_id = v_branch_id AND deleted_at IS NULL AND is_active
  LIMIT 1;

  v_body := jsonb_build_object(
    'version', 1,
    'organization_id', v_org,
    'branch_id', v_branch_id,
    'attendance_location_id', v_loc_id,
    'qr_nonce', v_nonce,
    'issued_at', timezone('utc', now()),
    'expires_at', v_expires
  )::text;

  v_hmac := public._attendance_hmac_hex('attendance_qr_hmac', v_body);

  INSERT INTO public.attendance_branch_qr_tokens (
    organization_id, branch_id, location_id, nonce_hash, expires_at, created_by,
    payload_hash, hmac_signature, single_use
  ) VALUES (
    v_org, v_branch_id, v_loc_id,
    encode(extensions.digest(v_nonce, 'sha256'), 'hex'),
    v_expires, v_actor,
    encode(extensions.digest(v_body, 'sha256'), 'hex'),
    v_hmac, false
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'branch_id', v_branch_id,
    'token', v_nonce,
    'payload', v_body::jsonb,
    'signature', v_hmac,
    'issued_at', timezone('utc', now()),
    'expires_at', v_expires
  );
END;
$$;
