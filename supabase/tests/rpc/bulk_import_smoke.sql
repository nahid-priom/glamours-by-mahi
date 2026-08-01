-- Bulk import jobs + lookup RPCs smoke
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'import_jobs'
  ) THEN
    RAISE EXCEPTION 'import_jobs missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'import_job_rows'
  ) THEN
    RAISE EXCEPTION 'import_job_rows missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'lookup_products_for_import'
  ) THEN
    RAISE EXCEPTION 'lookup_products_for_import missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'lookup_customers_for_import'
  ) THEN
    RAISE EXCEPTION 'lookup_customers_for_import missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'lookup_suppliers_for_import'
  ) THEN
    RAISE EXCEPTION 'lookup_suppliers_for_import missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE key = 'customers.import' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'customers.import permission missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.permissions
    WHERE key = 'suppliers.import' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'suppliers.import permission missing';
  END IF;

  IF has_function_privilege('anon', 'public.create_import_job(text, text, text, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute create_import_job';
  END IF;

  RAISE NOTICE 'bulk_import_smoke: OK';
END $$;

SELECT 'bulk_import_smoke_passed' AS status;
