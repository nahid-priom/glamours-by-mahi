-- Commission Engine V4 integrity smoke (function presence + schema)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salesman_commissions'
      AND column_name = 'recoverable_amount'
  ) THEN
    RAISE EXCEPTION 'recoverable_amount missing on salesman_commissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commission_attribution_exceptions'
  ) THEN
    RAISE EXCEPTION 'commission_attribution_exceptions missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_reverse_remaining_sale_commissions'
  ) THEN
    RAISE EXCEPTION '_reverse_remaining_sale_commissions missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_sale_commission_audit'
  ) THEN
    RAISE EXCEPTION 'get_sale_commission_audit missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'summarize_sales_commissions'
  ) THEN
    RAISE EXCEPTION 'summarize_sales_commissions missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'audit_commission_discrepancies'
  ) THEN
    RAISE EXCEPTION 'audit_commission_discrepancies missing';
  END IF;

  IF NOT public._commission_is_fixed_per_sale(
    jsonb_build_object('structure_mode', 'per_sale', 'rule_type', 'fixed')
  ) THEN
    RAISE EXCEPTION 'fixed per-sale detector failed';
  END IF;

  IF public._commission_is_fixed_per_sale(
    jsonb_build_object('structure_mode', 'per_sale', 'rule_type', 'percent')
  ) THEN
    RAISE EXCEPTION 'percent rule incorrectly flagged fixed';
  END IF;

  RAISE NOTICE 'commission_engine_v4_smoke: OK';
END $$;
