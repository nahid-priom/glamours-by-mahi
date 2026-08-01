-- Exchange + reset contract: signatures, grants, and privilege denials.
-- Complements p0_delivery_smoke.sql with focused exchange/reset assertions.

DO $$
DECLARE
  v_oid oid;
BEGIN
  SELECT p.oid INTO v_oid
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'complete_product_exchange'
    AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  IF v_oid IS NULL THEN
    RAISE EXCEPTION 'complete_product_exchange(payload jsonb) missing';
  END IF;

  IF NOT has_function_privilege('authenticated', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute complete_product_exchange';
  END IF;

  IF has_function_privilege('anon', v_oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon must not execute complete_product_exchange';
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

  -- Body must enforce settings.data_reset permission
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'execute_data_reset'
      AND pg_get_functiondef(p.oid) ILIKE '%settings.data_reset%'
  ) THEN
    RAISE EXCEPTION 'execute_data_reset must enforce settings.data_reset permission';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'exchanges'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'exchanges'
  ) THEN
    RAISE EXCEPTION 'exchanges table missing RLS policies';
  END IF;

  RAISE NOTICE 'exchange_and_reset_contract_smoke: OK';
END $$;

SELECT 'exchange_and_reset_contract_smoke_passed' AS status;
