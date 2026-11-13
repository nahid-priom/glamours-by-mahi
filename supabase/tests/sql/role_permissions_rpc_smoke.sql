-- Contract smoke for V2.3 role permission RPCs (no live auth mutation).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_role_with_permissions'
  ) THEN
    RAISE EXCEPTION 'create_role_with_permissions missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_role_with_permissions'
  ) THEN
    RAISE EXCEPTION 'update_role_with_permissions missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'bulk_approve_sales_commissions'
  ) THEN
    RAISE EXCEPTION 'bulk_approve_sales_commissions missing';
  END IF;

  RAISE NOTICE 'role_permissions_rpc_smoke: OK';
END $$;
