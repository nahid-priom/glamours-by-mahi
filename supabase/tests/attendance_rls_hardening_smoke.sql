-- Mobile attendance RLS / submit denial smoke tests (run when linked).
-- Expect: authenticated cannot execute submit_mobile_attendance; employee cannot INSERT attendance_records.

DO $$
DECLARE
  v_has_exec boolean;
BEGIN
  SELECT has_function_privilege('authenticated', 'public.submit_mobile_attendance(jsonb)', 'EXECUTE')
    INTO v_has_exec;
  IF v_has_exec THEN
    RAISE EXCEPTION 'FAIL: authenticated still has EXECUTE on submit_mobile_attendance';
  END IF;
  RAISE NOTICE 'PASS: authenticated cannot execute submit_mobile_attendance';
END $$;

DO $$
DECLARE
  v_has_exec boolean;
BEGIN
  SELECT has_function_privilege('service_role', 'public.submit_mobile_attendance(jsonb)', 'EXECUTE')
    INTO v_has_exec;
  IF NOT v_has_exec THEN
    RAISE EXCEPTION 'FAIL: service_role missing EXECUTE on submit_mobile_attendance';
  END IF;
  RAISE NOTICE 'PASS: service_role can execute submit_mobile_attendance';
END $$;

-- Document-only: full RLS insert denial requires a seeded employee JWT session.
-- Manual: SET ROLE authenticated; INSERT INTO attendance_records (...) → should fail RLS.
SELECT 'attendance_rls_hardening_smoke: privilege checks complete' AS status;
