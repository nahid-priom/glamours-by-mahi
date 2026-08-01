-- RLS matrix smoke: critical tables have RLS enabled; anon lacks table privileges.
-- Run: npm run db:test:rls

DO $$
DECLARE
  v_table text;
  v_tables text[] := ARRAY[
    'profiles',
    'roles',
    'permissions',
    'user_branch_access',
    'products',
    'product_variants',
    'inventory_balances',
    'stock_ledger',
    'sales',
    'sale_items',
    'purchases',
    'customers',
    'suppliers',
    'journal_entries',
    'courier_parcels',
    'salesman_commission_rules',
    'salesman_commissions',
    'audit_logs',
    'exchanges',
    'data_reset_runs'
  ];
  v_rls boolean;
  v_missing text[] := '{}';
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table;

    IF v_rls IS DISTINCT FROM true THEN
      -- Tolerate tables that may not exist yet in older DBs
      IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = v_table
      ) THEN
        v_missing := array_append(v_missing, v_table || '(rls_off)');
      END IF;
    END IF;
  END LOOP;

  IF array_length(v_missing, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled: %', array_to_string(v_missing, ', ');
  END IF;

  -- anon should not have SELECT on sales / audit_logs
  IF has_table_privilege('anon', 'public.sales', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not SELECT sales';
  END IF;
  IF has_table_privilege('anon', 'public.audit_logs', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not SELECT audit_logs';
  END IF;
  IF has_table_privilege('anon', 'public.salesman_commissions', 'SELECT') THEN
    RAISE EXCEPTION 'anon must not SELECT salesman_commissions';
  END IF;

  -- audit_logs must remain immutable for authenticated (no UPDATE/DELETE)
  IF has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE') THEN
    RAISE EXCEPTION 'authenticated must not UPDATE audit_logs';
  END IF;
  IF has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated must not DELETE audit_logs';
  END IF;

  RAISE NOTICE 'rls_matrix_smoke: OK';
END $$;

SELECT 'rls_matrix_smoke_passed' AS status;
