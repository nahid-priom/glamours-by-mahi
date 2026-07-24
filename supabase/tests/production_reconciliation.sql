-- Read-only production reconciliation (non-sandbox orgs only)
-- Run: npm run db:test:recon

BEGIN;

DO $$
DECLARE
  v_report jsonb;
  v_row jsonb;
  v_fail int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_erp_production_reconciliation_report') THEN
    RAISE EXCEPTION 'Migration 058 not applied: run_erp_production_reconciliation_report missing';
  END IF;

  v_report := public.run_erp_production_reconciliation_report();

  RAISE NOTICE 'Production reconciliation generated_at=% pass=% fail=%',
    v_report->>'generated_at', v_report->>'pass_count', v_report->>'fail_count';

  FOR v_row IN SELECT * FROM jsonb_array_elements(v_report->'organizations')
  LOOP
    RAISE NOTICE 'Org % (%) pass=% inv_mismatch=% cod_missing=% cust_due=% sup_due=%',
      v_row->>'name', v_row->>'slug', v_row->>'pass',
      v_row->>'inventory_ledger_mismatches',
      v_row->>'delivered_cod_missing_journal',
      v_row->>'customer_due_delta_sum',
      v_row->>'supplier_due_delta_sum';
    IF NOT (v_row->>'pass')::boolean THEN
      v_fail := v_fail + 1;
      RAISE WARNING 'Production org failed reconciliation: %', v_row;
    END IF;
  END LOOP;

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Production reconciliation: % org(s) failed', v_fail;
  END IF;
END $$;

ROLLBACK;
