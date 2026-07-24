-- Acceptance suite infrastructure: sandbox org isolation, QA cleanup, outcome report runner

--------------------------------------------------------------------------------
-- Sandbox organization (excluded from operational reconciliation via is_sandbox)
--------------------------------------------------------------------------------
INSERT INTO public.organizations (id, name, slug, currency, is_sandbox, settings)
VALUES (
  '99999999-9999-9999-9999-999999999999',
  'ERP Acceptance Sandbox',
  'erp-acceptance-sandbox',
  'BDT',
  true,
  '{"fiscal_year_start_month": 7}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  is_sandbox = true,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  deleted_at = NULL;

INSERT INTO public.branches (id, organization_id, code, name, is_central, is_active)
VALUES
  ('99999999-9999-9999-9999-999999999991', '99999999-9999-9999-9999-999999999999', 'SBX-HQ', 'Sandbox HQ', true, true),
  ('99999999-9999-9999-9999-999999999992', '99999999-9999-9999-9999-999999999999', 'SBX-B2', 'Sandbox Branch B', false, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.roles (id, organization_id, name, description, is_system)
VALUES (
  '99999999-9999-9999-9999-999999999901',
  '99999999-9999-9999-9999-999999999999',
  'Sandbox Super Admin',
  'Acceptance test role',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '99999999-9999-9999-9999-999999999901', p.id
FROM public.permissions p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = '99999999-9999-9999-9999-999999999901'
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );

-- QA auth user (service_role impersonation only; not for human login)
DO $$
DECLARE
  v_user_id uuid := '99999999-9999-9999-9999-999999999902';
  v_email text := 'erp-qa-sandbox@internal.invalid';
  v_org_id uuid := '99999999-9999-9999-9999-999999999999';
  v_role_id uuid := '99999999-9999-9999-9999-999999999901';
  v_branch_id uuid := '99999999-9999-9999-9999-999999999991';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"ERP QA Sandbox"}'::jsonb,
      timezone('utc', now()), timezone('utc', now()), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text,
      timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
    );
  END IF;

  INSERT INTO public.profiles (
    id, organization_id, full_name, email, role_id, default_branch_id, is_active
  ) VALUES (
    v_user_id, v_org_id, 'ERP QA Sandbox', v_email, v_role_id, v_branch_id, true
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    role_id = EXCLUDED.role_id,
    default_branch_id = EXCLUDED.default_branch_id,
    is_active = true,
    deleted_at = NULL;

  INSERT INTO public.user_branch_access (organization_id, user_id, branch_id)
  SELECT v_org_id, v_user_id, b.id
  FROM public.branches b
  WHERE b.organization_id = v_org_id AND b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_branch_access uba
      WHERE uba.user_id = v_user_id AND uba.branch_id = b.id AND uba.deleted_at IS NULL
    );
END $$;

--------------------------------------------------------------------------------
-- Minimal sandbox accounting + inventory fixtures
--------------------------------------------------------------------------------
DO $$
DECLARE
  v_org uuid := '99999999-9999-9999-9999-999999999999';
  v_branch uuid := '99999999-9999-9999-9999-999999999991';
  v_assets uuid := '99999999-9999-9999-9999-999999999911';
  v_liab uuid := '99999999-9999-9999-9999-999999999912';
  v_rev uuid := '99999999-9999-9999-9999-999999999913';
  v_exp uuid := '99999999-9999-9999-9999-999999999914';
  v_loc uuid;
BEGIN
  INSERT INTO public.account_groups (id, organization_id, name, account_class, sort_order)
  VALUES
    (v_assets, v_org, 'Assets', 'asset', 10),
    (v_liab, v_org, 'Liabilities', 'liability', 20),
    (v_rev, v_org, 'Revenue', 'revenue', 40),
    (v_exp, v_org, 'Expenses', 'expense', 50)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.chart_of_accounts (id, organization_id, group_id, code, name, account_type, system_role, is_postable, is_active)
  VALUES
    ('99999999-9999-9999-9999-999999999921', v_org, v_assets, '1000', 'Cash', 'asset', 'cash', true, true),
    ('99999999-9999-9999-9999-999999999922', v_org, v_assets, '1010', 'Bank', 'asset', 'bank', true, true),
    ('99999999-9999-9999-9999-999999999923', v_org, v_assets, '1020', 'bKash', 'asset', 'mobile_money', true, true),
    ('99999999-9999-9999-9999-999999999924', v_org, v_assets, '1100', 'Receivable', 'asset', 'receivable', true, true),
    ('99999999-9999-9999-9999-999999999925', v_org, v_assets, '1200', 'Inventory', 'asset', 'inventory_asset', true, true),
    ('99999999-9999-9999-9999-999999999926', v_org, v_liab, '2000', 'Payable', 'liability', 'payable', true, true),
    ('99999999-9999-9999-9999-999999999927', v_org, v_rev, '4000', 'Sales', 'revenue', 'sales_revenue', true, true),
    ('99999999-9999-9999-9999-999999999928', v_org, v_exp, '5000', 'COGS', 'expense', 'cogs', true, true),
    ('99999999-9999-9999-9999-999999999929', v_org, v_assets, '1250', 'Courier Receivable', 'asset', 'courier_receivable', true, true),
    ('99999999-9999-9999-9999-99999999992a', v_org, v_exp, '6100', 'Courier Expense', 'expense', 'courier_expense', true, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.financial_accounts (
    id, organization_id, branch_id, chart_account_id, name, account_kind,
    currency, opening_balance, current_balance, is_default, is_active
  ) VALUES
    ('99999999-9999-9999-9999-999999999931', v_org, v_branch, '99999999-9999-9999-9999-999999999921', 'Sandbox Cash', 'cash', 'BDT', 100000, 100000, true, true),
    ('99999999-9999-9999-9999-999999999932', v_org, v_branch, '99999999-9999-9999-9999-999999999922', 'Sandbox Bank', 'bank', 'BDT', 100000, 100000, false, true),
    ('99999999-9999-9999-9999-999999999933', v_org, v_branch, '99999999-9999-9999-9999-999999999923', 'Sandbox bKash', 'mobile_money', 'BDT', 50000, 50000, false, true)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.payment_methods (
    organization_id, code, name, financial_account_id, is_due, sort_order, is_active
  )
  SELECT v_org, x.code, x.name, x.fa, x.is_due, x.ord, true
  FROM (VALUES
    ('cash', 'Cash', '99999999-9999-9999-9999-999999999931'::uuid, false, 1),
    ('bank', 'Bank', '99999999-9999-9999-9999-999999999932'::uuid, false, 2),
    ('bkash', 'bKash', '99999999-9999-9999-9999-999999999933'::uuid, false, 3),
    ('due', 'Due', NULL::uuid, true, 4)
  ) AS x(code, name, fa, is_due, ord)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.payment_methods pm
    WHERE pm.organization_id = v_org AND lower(pm.code) = x.code AND pm.deleted_at IS NULL
  );

  INSERT INTO public.courier_companies (id, organization_id, name, code, status, connection_status)
  VALUES (
    '99999999-9999-9999-9999-999999999941',
    v_org, 'Sandbox Courier', 'SBX-CC', 'active', 'disconnected'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
  SELECT v_org, b.id, b.code || ' Saleable Floor', 'saleable', true, true
  FROM public.branches b
  WHERE b.organization_id = v_org AND b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.stock_locations sl
      WHERE sl.branch_id = b.id AND sl.location_type = 'saleable' AND sl.deleted_at IS NULL
    );

  INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
  SELECT v_org, b.id, b.code || ' Damaged Bin', 'damaged', true, true
  FROM public.branches b
  WHERE b.organization_id = v_org AND b.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.stock_locations sl
      WHERE sl.branch_id = b.id AND sl.location_type = 'damaged' AND sl.deleted_at IS NULL
    );

  INSERT INTO public.products (id, organization_id, name, base_sku, is_active, track_inventory)
  VALUES (
    '99999999-9999-9999-9999-999999999951',
    v_org, 'Sandbox Test Product', 'SBX-SKU-001', true, true
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.product_variants (
    id, organization_id, product_id, sku, barcode,
    purchase_price, selling_price, is_active
  ) VALUES (
    '99999999-9999-9999-9999-999999999952',
    v_org, '99999999-9999-9999-9999-999999999951',
    'SBX-VAR-001', 'SBXBAR001', 100.00, 200.00, true
  )
  ON CONFLICT (id) DO NOTHING;

  v_loc := public._saleable_location(v_org, v_branch);
  IF v_loc IS NOT NULL THEN
    PERFORM public._adjust_inventory(
      v_org, v_branch, '99999999-9999-9999-9999-999999999952', v_loc,
      500, 100.00, 'opening', 'qa_fixture', NULL,
      '99999999-9999-9999-9999-999999999902',
      'Sandbox opening stock'
    );
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Remove production QA courier fixture when safely unused
--------------------------------------------------------------------------------
UPDATE public.courier_companies
SET deleted_at = timezone('utc', now())
WHERE organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  AND code = 'QA-ERP-CC'
  AND deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.courier_parcels cp
    WHERE cp.courier_company_id = courier_companies.id
      AND cp.deleted_at IS NULL
      AND cp.status NOT IN ('cancelled', 'returned')
  );

--------------------------------------------------------------------------------
-- QA context helpers (service_role only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_qa_context()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'org_id', '99999999-9999-9999-9999-999999999999'::uuid,
    'branch_id', '99999999-9999-9999-9999-999999999991'::uuid,
    'branch_b_id', '99999999-9999-9999-9999-999999999992'::uuid,
    'actor_id', '99999999-9999-9999-9999-999999999902'::uuid,
    'variant_id', '99999999-9999-9999-9999-999999999952'::uuid,
    'cash_account_id', '99999999-9999-9999-9999-999999999931'::uuid,
    'courier_company_id', '99999999-9999-9999-9999-999999999941'::uuid
  );
$$;

REVOKE ALL ON FUNCTION public._erp_qa_context() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_context() TO service_role;

CREATE OR REPLACE FUNCTION public._erp_qa_require_service()
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_require_service() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_require_service() TO service_role;

CREATE OR REPLACE FUNCTION public._erp_qa_set_sandbox_auth()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_test_set_auth('99999999-9999-9999-9999-999999999902'::uuid);
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_set_sandbox_auth() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_set_sandbox_auth() TO service_role;

--------------------------------------------------------------------------------
-- QA cleanup: soft-delete sandbox artifacts created during a run
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_qa_cleanup_tracking(p_tracking_prefix text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := (public._erp_qa_context()->>'org_id')::uuid;
  r record;
BEGIN
  PERFORM public._erp_qa_require_service();

  FOR r IN
    SELECT cp.id AS parcel_id
    FROM public.courier_parcels cp
    WHERE cp.organization_id = v_org
      AND cp.tracking_no LIKE p_tracking_prefix || '%'
      AND cp.deleted_at IS NULL
  LOOP
    PERFORM public._reverse_courier_cod_accounting(r.parcel_id, NULL, 'QA cleanup');
    UPDATE public.courier_settlements SET deleted_at = timezone('utc', now())
    WHERE parcel_id = r.parcel_id AND deleted_at IS NULL;
    UPDATE public.journal_entries SET deleted_at = timezone('utc', now())
    WHERE organization_id = v_org
      AND source_id = r.parcel_id
      AND source_type IN ('courier_cod', 'courier_cod_reversal', 'courier_settlement')
      AND deleted_at IS NULL;
    UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = r.parcel_id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_cleanup_tracking(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_cleanup_tracking(text) TO service_role;

--------------------------------------------------------------------------------
-- QA COD delivery (sandbox org, canonical RPC, full cleanup)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_erp_qa_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_company uuid := (v_ctx->>'courier_company_id')::uuid;
  v_parcel_id uuid;
  v_jcount int;
  v_prefix text := 'QA-ERP-COD-';
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge,
    customer_name, customer_phone
  ) VALUES (
    v_org, v_branch, v_company,
    v_prefix || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 1500.00, 50.00,
    'QA Customer', '01700000000'
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA COD delivery');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'COD journal must be posted exactly once on delivery');

  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA duplicate');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'duplicate delivered must not duplicate COD journal');

  SELECT count(*) INTO v_jcount
  FROM public.courier_settlements cs
  WHERE cs.parcel_id = v_parcel_id AND cs.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'settlement row must exist for COD parcel');

  PERFORM public._erp_qa_cleanup_tracking(v_prefix);

  RETURN jsonb_build_object('scenario', 7, 'parcel_id', v_parcel_id, 'status', 'PASS');
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_qa_cod_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_qa_cod_delivery() TO service_role;

CREATE OR REPLACE FUNCTION public.run_erp_qa_non_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_company uuid := (v_ctx->>'courier_company_id')::uuid;
  v_parcel_id uuid;
  v_jcount int;
  v_prefix text := 'QA-ERP-NOCOD-';
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch, v_company,
    v_prefix || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 0, 30.00
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA non-COD');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.source_type = 'courier_cod' AND je.source_id = v_parcel_id AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 0, 'non-COD parcel must not post courier receivable');

  PERFORM public._erp_qa_cleanup_tracking(v_prefix);

  RETURN jsonb_build_object('scenario', '7b', 'parcel_id', v_parcel_id, 'status', 'PASS');
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_qa_non_cod_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_qa_non_cod_delivery() TO service_role;

--------------------------------------------------------------------------------
-- Outcome report runner (service_role only, sandbox org, cleans up artifacts)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_erp_acceptance_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_actor uuid := (v_ctx->>'actor_id')::uuid;
  v_variant uuid := (v_ctx->>'variant_id')::uuid;
  v_cash uuid := (v_ctx->>'cash_account_id')::uuid;
  v_company uuid := (v_ctx->>'courier_company_id')::uuid;
  v_status text;
  v_detail jsonb;
  v_probe jsonb;
  v_cod jsonb;
  v_parcel_id uuid;
  v_settlement_id uuid;
  v_fin_before numeric(14, 2);
  v_fin_after numeric(14, 2);
  v_key text;
  v_result jsonb;
  v_jcount int;
  v_loc uuid;
  v_qty_before numeric(14, 3);
  v_qty_after numeric(14, 3);
  v_sale_result jsonb;
  v_sale_id uuid;
  v_comm_id uuid;
  v_can_anon boolean;
  v_can_auth boolean;
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  -- Security probe
  BEGIN
    v_probe := public._erp_security_probe_parcel_status();
    v_status := coalesce(v_probe->>'status', 'FAIL');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'parcel_guc_bypass', 'status', v_status, 'detail', v_probe
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'parcel_guc_bypass', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- QA grant isolation
  SELECT has_function_privilege('anon', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_anon;
  SELECT has_function_privilege('authenticated', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_auth;
  v_status := CASE WHEN NOT v_can_anon AND NOT v_can_auth THEN 'PASS' ELSE 'FAIL' END;
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'scenario', 13, 'name', 'qa_grant_isolation', 'status', v_status,
    'anon_can_execute', v_can_anon, 'auth_can_execute', v_can_auth
  ));

  -- Scenario 7 COD subset
  BEGIN
    v_cod := public.run_erp_qa_cod_delivery();
    v_status := coalesce(v_cod->>'status', 'FAIL');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'cod_delivery_idempotent', 'status', v_status, 'detail', v_cod
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'cod_delivery_idempotent', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 7 settlement lifecycle
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      'QA-SETTLE-' || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 2000.00, 80.00
    )
    RETURNING id INTO v_parcel_id;

    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'settlement test');

    SELECT id INTO v_settlement_id FROM public.courier_settlements
    WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;

    PERFORM public._erp_assert(v_settlement_id IS NOT NULL, 'settlement row required');

    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;

    v_key := 'qa-settle-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', v_cash,
      'client_txn_key', v_key
    ));

    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;

    PERFORM public._erp_assert((v_result->>'idempotent')::boolean = false, 'first settlement must post');
    PERFORM public._erp_assert(v_fin_after - v_fin_before = 1920.00, 'cash must increase by net 1920');
    PERFORM public._erp_assert(
      (SELECT status FROM public.courier_settlements WHERE id = v_settlement_id) = 'settled',
      'settlement status must be settled'
    );

    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', v_cash,
      'client_txn_key', v_key
    ));
    PERFORM public._erp_assert((v_result->>'idempotent')::boolean = true, 'duplicate key idempotent');

    SELECT count(*) INTO v_jcount FROM public.journal_entries
    WHERE source_type = 'courier_settlement' AND source_id = v_settlement_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_jcount = 1, 'exactly one settlement journal');

    PERFORM public._erp_qa_cleanup_tracking('QA-SETTLE-');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_lifecycle', 'status', 'PASS',
      'net_received', 1920.00
    ));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._erp_qa_cleanup_tracking('QA-SETTLE-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 3: POS cash sale
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT quantity INTO v_qty_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;

    v_key := 'qa-pos-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch,
      'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant, 'qty', 2, 'unit_price', 200.00
      )),
      'payments', jsonb_build_array(jsonb_build_object(
        'method', 'cash', 'amount', 400.00, 'financial_account_id', v_cash
      ))
    ));

    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    PERFORM public._erp_assert(v_sale_id IS NOT NULL, 'sale_id required');

    SELECT quantity INTO v_qty_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;

    PERFORM public._erp_assert(v_qty_before - v_qty_after = 2, 'stock must decrease by 2');

    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch,
      'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant, 'qty', 2, 'unit_price', 200.00
      )),
      'payments', jsonb_build_array(jsonb_build_object(
        'method', 'cash', 'amount', 400.00, 'financial_account_id', v_cash
      ))
    ));
    PERFORM public._erp_assert(coalesce((v_sale_result->>'idempotent')::boolean, false), 'retry must be idempotent');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'PASS',
      'sale_id', v_sale_id, 'qty_delta', 2
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 12: commission accrual + approve + pay
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();

    PERFORM public.upsert_commission_rule(jsonb_build_object(
      'profile_id', v_actor,
      'rule_type', 'percent_sale',
      'rate', 5,
      'effective_from', (timezone('utc', now()) - interval '1 day')::date
    ));

    v_key := 'qa-comm-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch,
      'client_txn_key', v_key,
      'salesperson_id', v_actor,
      'items', jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant, 'qty', 1, 'unit_price', 200.00
      )),
      'payments', jsonb_build_array(jsonb_build_object(
        'method', 'cash', 'amount', 200.00, 'financial_account_id', v_cash
      ))
    ));

    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT id INTO v_comm_id FROM public.salesman_commissions
    WHERE sale_id = v_sale_id AND deleted_at IS NULL;

    PERFORM public._erp_assert(v_comm_id IS NOT NULL, 'commission must accrue');
    PERFORM public._erp_assert(
      (SELECT commission_amount FROM public.salesman_commissions WHERE id = v_comm_id) = 10.00,
      '5% of 200 = 10'
    );
    PERFORM public._erp_assert(
      (SELECT rule_snapshot IS NOT NULL FROM public.salesman_commissions WHERE id = v_comm_id),
      'rule snapshot required'
    );

    PERFORM public.approve_sales_commission(v_comm_id);
    PERFORM public._erp_assert(
      (SELECT status FROM public.salesman_commissions WHERE id = v_comm_id) = 'approved',
      'must be approved'
    );

    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;

    PERFORM public.pay_sales_commission(jsonb_build_object(
      'commission_id', v_comm_id,
      'financial_account_id', v_cash,
      'client_txn_key', 'pay-' || v_key
    ));

    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_fin_before - v_fin_after = 10.00, 'cash decreases by commission');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'PASS',
      'commission_amount', 10.00
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Reconciliation smoke (sandbox excluded from views)
  BEGIN
    SELECT count(*) INTO v_jcount FROM public.v_recon_inventory_ledger_qty
    WHERE organization_id = v_org;
    v_status := CASE WHEN v_jcount = 0 THEN 'PASS' ELSE 'FAIL' END;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_excluded_from_recon_views', 'status', v_status,
      'sandbox_mismatches_in_view', v_jcount
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_excluded', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  RETURN jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'sandbox_org', v_org,
    'results', v_results,
    'pass_count', (
      SELECT count(*) FROM jsonb_array_elements(v_results) e
      WHERE e->>'status' = 'PASS'
    ),
    'fail_count', (
      SELECT count(*) FROM jsonb_array_elements(v_results) e
      WHERE e->>'status' = 'FAIL'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_acceptance_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_acceptance_report() TO service_role;

-- Security probe must use sandbox org for parcel fixtures
CREATE OR REPLACE FUNCTION public._erp_security_probe_parcel_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := (public._erp_qa_context()->>'org_id')::uuid;
  v_branch uuid := (public._erp_qa_context()->>'branch_id')::uuid;
  v_company uuid := (public._erp_qa_context()->>'courier_company_id')::uuid;
  v_parcel_id uuid;
  v_guc_blocked boolean := false;
  v_direct_blocked boolean := false;
BEGIN
  PERFORM public._erp_qa_require_service();

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch, v_company,
    'SBX-PROBE-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 100.00, 10.00
  )
  RETURNING id INTO v_parcel_id;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('app.allow_parcel_status', '1', true);
    UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;
  EXCEPTION WHEN OTHERS THEN
    v_guc_blocked := true;
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;
  EXCEPTION WHEN OTHERS THEN
    v_direct_blocked := true;
  END;

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object(
    'guc_bypass_blocked', v_guc_blocked,
    'direct_update_blocked', v_direct_blocked,
    'status', CASE WHEN v_guc_blocked AND v_direct_blocked THEN 'PASS' ELSE 'FAIL' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_security_probe_parcel_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_security_probe_parcel_status() TO service_role;
