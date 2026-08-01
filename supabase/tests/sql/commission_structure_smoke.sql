-- Commission structure post-097: columns + accrue RPC + subject search.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salesman_commission_rules'
      AND column_name = 'structure_mode'
  ) THEN
    RAISE EXCEPTION 'structure_mode missing on salesman_commission_rules';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'salesman_commission_rules'
      AND column_name = 'subject_type'
  ) THEN
    RAISE EXCEPTION 'subject_type missing on salesman_commission_rules';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_accrue_sale_commission'
  ) THEN
    RAISE EXCEPTION '_accrue_sale_commission missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'search_commission_subjects'
  ) THEN
    RAISE EXCEPTION 'search_commission_subjects missing';
  END IF;

  RAISE NOTICE 'commission_structure_smoke: OK';
END $$;

SELECT 'commission_structure_smoke_passed' AS status;
