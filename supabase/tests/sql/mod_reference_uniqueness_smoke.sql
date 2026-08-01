-- Online order / MOD reference uniqueness: client_txn_key + invoice uniqueness indexes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND indexdef ILIKE '%client_txn_key%'
  ) THEN
    RAISE EXCEPTION 'sales client_txn_key uniqueness index missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND indexdef ILIKE '%invoice_no%'
  ) THEN
    RAISE EXCEPTION 'sales invoice_no uniqueness index missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_staff_online_order'
  ) THEN
    RAISE EXCEPTION 'create_staff_online_order missing';
  END IF;

  RAISE NOTICE 'mod_reference_uniqueness_smoke: OK';
END $$;

SELECT 'mod_reference_uniqueness_smoke_passed' AS status;
