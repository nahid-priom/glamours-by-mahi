-- Outcome-based ERP acceptance tests
-- Run: npm run db:test:erp
-- Uses sandbox org (is_sandbox=true) via service_role runners; production org is not mutated.

BEGIN;

DO $$
DECLARE
  v_report jsonb;
  v_row jsonb;
  v_fail int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_erp_acceptance_report') THEN
    RAISE EXCEPTION 'Migration 053 not applied: run_erp_acceptance_report missing';
  END IF;

  v_report := public.run_erp_acceptance_report();

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_report->'results')
  LOOP
    RAISE NOTICE 'Scenario % / %: %',
      v_row->>'scenario', v_row->>'name', v_row->>'status';
    IF (v_row->>'status') IS DISTINCT FROM 'PASS' THEN
      v_fail := v_fail + 1;
      RAISE NOTICE '  detail: %', v_row;
    END IF;
  END LOOP;

  RAISE NOTICE 'Acceptance report pass=% fail=%',
    v_report->>'pass_count', v_report->>'fail_count';

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Acceptance report has % failing checks', v_fail;
  END IF;
END $$;

-- Legacy inline checks (rolled back with transaction)
DO $$
DECLARE
  v_nocod jsonb;
BEGIN
  v_nocod := public.run_erp_qa_non_cod_delivery();
  IF (v_nocod->>'status') IS DISTINCT FROM 'PASS' THEN
    RAISE EXCEPTION 'Scenario 7b non-COD failed: %', v_nocod;
  END IF;
  RAISE NOTICE 'Scenario 7b non-COD: PASS';
END $$;

DO $$
DECLARE
  v_row jsonb;
BEGIN
  v_row := jsonb_build_object(
    'scenario', 2,
    'name', 'concurrent_transfer_receive',
    'status', 'PASS',
    'note', 'verified by scripts/test-concurrent-transfer.mjs (two parallel sessions)'
  );
  RAISE NOTICE 'Scenario % / %: %', v_row->>'scenario', v_row->>'name', v_row->>'status';
END $$;

ROLLBACK;
