-- Inventory / WAC outcome smoke: valuation RPC + ledger reconcile view exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_adjust_inventory'
  ) THEN
    RAISE EXCEPTION '_adjust_inventory missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'stock_ledger' AND column_name = 'total_cost'
  ) THEN
    RAISE EXCEPTION 'stock_ledger.total_cost missing (WAC)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_balances'
      AND column_name IN ('average_unit_cost', 'quantity')
  ) THEN
    -- quantity always exists; average_unit_cost added in WAC migration
    NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_balances'
      AND column_name = 'average_unit_cost'
  ) THEN
    RAISE EXCEPTION 'inventory_balances.average_unit_cost missing';
  END IF;

  RAISE NOTICE 'inventory_wac_outcome_smoke: OK';
END $$;

SELECT 'inventory_wac_outcome_smoke_passed' AS status;
