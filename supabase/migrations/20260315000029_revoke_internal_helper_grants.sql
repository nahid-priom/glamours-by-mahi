-- Unified transaction core: revoke internal helper EXECUTE from clients
-- and seed least-privilege permissions used by the hardened public RPCs.

--------------------------------------------------------------------------------
-- Permissions (idempotent)
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('sales.update', 'Update draft/online sales fulfilment metadata'),
  ('sales.return', 'Create and approve sales returns'),
  ('purchases.pay', 'Pay supplier invoices and allocate AP'),
  ('purchases.return', 'Create and approve purchase returns'),
  ('orders.fulfil', 'Fulfil reserved online orders into completed sales'),
  ('orders.read', 'View online order queue'),
  ('orders.cancel', 'Cancel reserved online orders and release stock'),
  ('reconciliation.read', 'View finance/inventory reconciliation reports'),
  ('reconciliation.run', 'Run dry-run reconciliation diagnostics'),
  ('reconciliation.apply', 'Apply authorized reconciliation repairs'),
  ('accounting.view', 'View chart of accounts and journals'),
  ('accounting.post', 'Post journals through authorized RPCs')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = v.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Super Admin')
  AND r.deleted_at IS NULL
  AND p.key IN (
    'sales.update', 'sales.return',
    'purchases.pay', 'purchases.return',
    'orders.fulfil', 'orders.read', 'orders.cancel',
    'reconciliation.read', 'reconciliation.run', 'reconciliation.apply',
    'accounting.view', 'accounting.post',
    'customer_due.collect', 'supplier_due.pay',
    'inventory.adjust', 'inventory.transfer',
    'accounts.post', 'accounts.manage'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Revoke client access to internal helpers
--------------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND (
        p.proname LIKE '\_%'
        OR p.proname = 'adjust_financial_account_balance'
      )
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC',
      r.nspname, r.proname, r.args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM anon',
      r.nspname, r.proname, r.args
    );
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %I.%I(%s) FROM authenticated',
      r.nspname, r.proname, r.args
    );
    -- Keep service_role for edge/cron only where needed; still revoke broad PUBLIC.
    BEGIN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
        r.nspname, r.proname, r.args
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

COMMENT ON SCHEMA public IS
  'Internal underscore helpers and adjust_financial_account_balance are not client-callable; use public business RPCs only.';
