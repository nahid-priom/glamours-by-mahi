-- Outcome smoke: preview_data_reset / execute_data_reset must match UI RPC contract.
-- Calls run_erp_qa_data_reset_rpc_match() (ephemeral sandbox org; seed org untouched).
-- Run: npm run db:test:p0  (requires local Supabase)

DO $$
DECLARE
  v_oid oid;
  v_result jsonb;
BEGIN
  -- Contract: RPCs exist with authenticated execute, anon denied
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'preview_data_reset'
    AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'preview_data_reset(payload jsonb) missing';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute preview_data_reset';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute preview_data_reset';
  END IF;

  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'execute_data_reset'
    AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'execute_data_reset(payload jsonb) missing';
  END IF;
  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute execute_data_reset';
  END IF;
  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute execute_data_reset';
  END IF;

  -- Body contract aligned with UI
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'execute_data_reset'
      AND pg_get_functiondef(p.oid) ILIKE '%confirm_phrase%'
      AND pg_get_functiondef(p.oid) ILIKE '%settings.data_reset%'
      AND pg_get_functiondef(p.oid) ILIKE '%UPDATE public.categories%'
  ) THEN
    RAISE EXCEPTION 'execute_data_reset body must enforce phrase + permission + category wipe';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'run_erp_qa_data_reset_rpc_match'
  ) THEN
    RAISE EXCEPTION 'Migration 123 missing: run_erp_qa_data_reset_rpc_match';
  END IF;

  v_result := public.run_erp_qa_data_reset_rpc_match();

  IF coalesce(v_result->>'status', '') IS DISTINCT FROM 'PASS' THEN
    RAISE EXCEPTION 'data_reset RPC outcome failed: %', v_result;
  END IF;

  IF coalesce((v_result->'catalog_soft_deleted'->>'categories')::int, 0) < 1 THEN
    RAISE EXCEPTION 'expected categories soft-deleted in harness result: %', v_result;
  END IF;

  RAISE NOTICE 'data_reset_rpc_outcome_smoke: OK %', v_result;
END $$;

SELECT 'data_reset_rpc_outcome_smoke_passed' AS status;
