-- P0 delivery smoke: critical RPCs exist, grants locked down, reset safety shape.
-- Run: npx supabase db query --linked --file supabase/tests/rpc/p0_delivery_smoke.sql

DO $$
DECLARE
  v_missing text[];
  v_fn text;
  v_required text[] := ARRAY[
    'complete_product_exchange',
    'preview_data_reset',
    'execute_data_reset',
    'list_activity_feed',
    'upsert_commission_rule',
    'search_commission_subjects',
    '_accrue_sale_commission',
    'run_erp_acceptance_report',
    'create_staff_online_order',
    'place_online_order'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_required LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = v_fn
    ) THEN
      v_missing := array_append(coalesce(v_missing, '{}'::text[]), v_fn);
    END IF;
  END LOOP;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing critical functions: %', array_to_string(v_missing, ', ');
  END IF;

  -- Acceptance harness must not be executable by anon/authenticated
  IF has_function_privilege('anon', 'public.run_erp_acceptance_report()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute run_erp_acceptance_report';
  END IF;
  IF has_function_privilege('authenticated', 'public.run_erp_acceptance_report()', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must not execute run_erp_acceptance_report';
  END IF;

  -- Reset RPCs must not be granted to anon
  IF has_function_privilege('anon', 'public.execute_data_reset(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute execute_data_reset';
  END IF;
  IF has_function_privilege('anon', 'public.preview_data_reset(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute preview_data_reset';
  END IF;

  -- Exchange uniqueness indexes
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'exchanges_org_client_txn_key_active_uidx'
  ) THEN
    RAISE EXCEPTION 'Missing exchanges client_txn uniqueness index';
  END IF;

  -- Commission structure columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salesman_commission_rules'
      AND column_name = 'structure_mode'
  ) THEN
    RAISE EXCEPTION 'Commission structure_mode column missing';
  END IF;

  RAISE NOTICE 'p0_delivery_smoke: OK';
END $$;

SELECT 'p0_delivery_smoke_passed' AS status;
