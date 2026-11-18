-- Supplier 360 smoke checks (run in QA harness / local supabase)
-- Expects authenticated org context with suppliers.read / accounts.manage as needed.

-- Directory summary shape
SELECT
  (public.get_supplier_directory_summary(NULL) ? 'total_suppliers') AS has_total_suppliers,
  (public.get_supplier_directory_summary(NULL) ? 'current_due') AS has_current_due;

-- Cards page shape
SELECT
  (public.get_supplier_directory_cards(NULL, NULL, false, NULL, NULL, NULL, 'name', 'asc', 1, 5) ? 'items') AS has_items;

-- Ledger statement for first supplier (if any)
DO $$
DECLARE
  v_sid uuid;
  v_stmt jsonb;
BEGIN
  SELECT id INTO v_sid FROM public.suppliers WHERE deleted_at IS NULL LIMIT 1;
  IF v_sid IS NULL THEN
    RAISE NOTICE 'No suppliers — skip statement smoke';
    RETURN;
  END IF;
  v_stmt := public.get_supplier_ledger_statement(v_sid, NULL, NULL, NULL, NULL, NULL, 1, 10);
  IF NOT (v_stmt ? 'opening_balance' AND v_stmt ? 'closing_due' AND v_stmt ? 'lines') THEN
    RAISE EXCEPTION 'Ledger statement missing required keys';
  END IF;
END $$;

-- Financial dry-run (accounts.manage)
-- SELECT public.recon_supplier_financial_dry_run('{}'::jsonb);
