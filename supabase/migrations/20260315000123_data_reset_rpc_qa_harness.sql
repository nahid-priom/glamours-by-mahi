-- Migration 123: Outcome QA for data reset RPCs (matches UI payload + catalog wipe).
-- Uses an ephemeral sandbox org so production seed / acceptance sandbox fixtures are untouched.

-- Keep Sandbox Super Admin in sync when permissions are added after initial seed.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '99999999-9999-9999-9999-999999999901'::uuid, p.id
FROM public.permissions p
WHERE p.key = 'settings.data_reset'
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = '99999999-9999-9999-9999-999999999901'::uuid
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.run_erp_qa_data_reset_rpc_match()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_branch uuid := gen_random_uuid();
  v_role uuid := gen_random_uuid();
  v_role_none uuid := gen_random_uuid();
  v_actor uuid := gen_random_uuid();
  v_actor_none uuid := gen_random_uuid();
  v_cat uuid;
  v_sub uuid;
  v_brand uuid;
  v_prod uuid;
  v_var uuid;
  v_slug text := 'qa-data-reset-' || replace(v_org::text, '-', '');
  v_preview jsonb;
  v_exec jsonb;
  v_cnt int;
  v_run_status text;
  v_blocked boolean;
BEGIN
  PERFORM public._erp_qa_require_service();

  INSERT INTO public.organizations (id, name, slug, currency, is_sandbox, settings)
  VALUES (
    v_org,
    'QA Data Reset Org',
    v_slug,
    'BDT',
    true,
    '{}'::jsonb
  );

  INSERT INTO public.branches (id, organization_id, code, name, is_central, is_active)
  VALUES (v_branch, v_org, 'QA-HQ', 'QA HQ', true, true);

  INSERT INTO public.roles (id, organization_id, name, description, is_system)
  VALUES
    (v_role, v_org, 'QA Reset Admin', 'Can run data reset', true),
    (v_role_none, v_org, 'QA Reset Denied', 'No data reset', true);

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT v_role, p.id
  FROM public.permissions p
  WHERE p.key = 'settings.data_reset'
    AND p.deleted_at IS NULL;

  -- Auth users required (profiles.id → auth.users)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES
    (
      v_actor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'qa-reset-admin+' || replace(v_actor::text, '-', '') || '@internal.invalid',
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"QA Reset Admin"}'::jsonb,
      timezone('utc', now()), timezone('utc', now()), '', '', '', ''
    ),
    (
      v_actor_none, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'qa-reset-denied+' || replace(v_actor_none::text, '-', '') || '@internal.invalid',
      extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"QA Reset Denied"}'::jsonb,
      timezone('utc', now()), timezone('utc', now()), '', '', '', ''
    );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES
    (
      v_actor, v_actor,
      jsonb_build_object('sub', v_actor::text, 'email', 'qa-reset-admin@internal.invalid', 'email_verified', true),
      'email', v_actor::text,
      timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
    ),
    (
      v_actor_none, v_actor_none,
      jsonb_build_object('sub', v_actor_none::text, 'email', 'qa-reset-denied@internal.invalid', 'email_verified', true),
      'email', v_actor_none::text,
      timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
    );

  INSERT INTO public.profiles (
    id, organization_id, full_name, email, role_id, default_branch_id, is_active
  ) VALUES
    (
      v_actor, v_org, 'QA Reset Admin',
      'qa-reset-admin+' || replace(v_actor::text, '-', '') || '@internal.invalid',
      v_role, v_branch, true
    ),
    (
      v_actor_none, v_org, 'QA Reset Denied',
      'qa-reset-denied+' || replace(v_actor_none::text, '-', '') || '@internal.invalid',
      v_role_none, v_branch, true
    );

  INSERT INTO public.categories (organization_id, name, code)
  VALUES (v_org, 'QA Reset Category', 'QA-CAT')
  RETURNING id INTO v_cat;

  INSERT INTO public.subcategories (organization_id, category_id, name, code)
  VALUES (v_org, v_cat, 'QA Reset Subcategory', 'QA-SUB')
  RETURNING id INTO v_sub;

  INSERT INTO public.brands (organization_id, name, code)
  VALUES (v_org, 'QA Reset Brand', 'QA-BRAND')
  RETURNING id INTO v_brand;

  INSERT INTO public.products (
    organization_id, category_id, subcategory_id, brand_id,
    name, base_sku, purchase_price, selling_price, is_active, track_inventory
  ) VALUES (
    v_org, v_cat, v_sub, v_brand,
    'QA Reset Product', 'QA-RESET-SKU-1', 10, 20, true, true
  )
  RETURNING id INTO v_prod;

  INSERT INTO public.product_variants (
    organization_id, product_id, sku, barcode, purchase_price, selling_price, is_active
  ) VALUES (
    v_org, v_prod, 'QA-RESET-VAR-1', 'QARESETBAR1', 10, 20, true
  )
  RETURNING id INTO v_var;

  --------------------------------------------------------------------------
  -- Permission denial (exact RPC)
  --------------------------------------------------------------------------
  PERFORM public._erp_test_set_auth(v_actor_none);
  v_blocked := false;
  BEGIN
    PERFORM public.preview_data_reset(jsonb_build_object('reset_level', 'full'));
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM ILIKE '%settings.data_reset%';
  END;
  PERFORM public._erp_assert(v_blocked, 'preview must deny without settings.data_reset');

  --------------------------------------------------------------------------
  -- Authorized actor — UI payload shape
  --------------------------------------------------------------------------
  PERFORM public._erp_test_set_auth(v_actor);

  -- Wrong confirm token
  v_blocked := false;
  BEGIN
    PERFORM public.execute_data_reset(jsonb_build_object(
      'confirm', 'YES',
      'confirm_phrase', 'RESET full',
      'reset_level', 'full'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM ILIKE '%Confirmation required%';
  END;
  PERFORM public._erp_assert(v_blocked, 'execute must require confirm = RESET');

  -- Wrong phrase (UI shows RESET <level>)
  v_blocked := false;
  BEGIN
    PERFORM public.execute_data_reset(jsonb_build_object(
      'confirm', 'RESET',
      'confirm_phrase', 'RESET FULLY',
      'reset_level', 'full'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM ILIKE '%Typed confirmation phrase%';
  END;
  PERFORM public._erp_assert(v_blocked, 'execute must require phrase RESET <level>');

  -- Invalid level
  v_blocked := false;
  BEGIN
    PERFORM public.preview_data_reset(jsonb_build_object('reset_level', 'everything'));
  EXCEPTION WHEN OTHERS THEN
    v_blocked := SQLERRM ILIKE '%Invalid reset_level%';
  END;
  PERFORM public._erp_assert(v_blocked, 'preview must reject invalid reset_level');

  --------------------------------------------------------------------------
  -- Level transactions: catalog masters must survive
  --------------------------------------------------------------------------
  v_preview := public.preview_data_reset(jsonb_build_object('reset_level', 'transactions'));
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'categories')::int, 0) >= 1,
    'preview(transactions) must count categories'
  );
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'catalog_cleared_on_full')::boolean, true) = false,
    'preview(transactions).catalog_cleared_on_full must be false'
  );

  v_exec := public.execute_data_reset(jsonb_build_object(
    'confirm', 'RESET',
    'confirm_phrase', 'RESET transactions',
    'reset_level', 'transactions'
  ));
  PERFORM public._erp_assert(coalesce((v_exec->>'ok')::boolean, false), 'execute(transactions) must return ok');

  SELECT count(*) INTO v_cnt
  FROM public.categories
  WHERE id = v_cat AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 1, 'transactions reset must keep categories');

  SELECT count(*) INTO v_cnt
  FROM public.products
  WHERE id = v_prod AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 1, 'transactions reset must keep products');

  --------------------------------------------------------------------------
  -- Level full: UI payload + catalog wipe (categories included)
  --------------------------------------------------------------------------
  v_preview := public.preview_data_reset(jsonb_build_object('reset_level', 'full'));
  PERFORM public._erp_assert(v_preview ? 'run_id', 'preview(full) must return run_id');
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'products')::int, 0) >= 1,
    'preview(full) must count products'
  );
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'categories')::int, 0) >= 1,
    'preview(full) must count categories'
  );
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'subcategories')::int, 0) >= 1,
    'preview(full) must count subcategories'
  );
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'brands')::int, 0) >= 1,
    'preview(full) must count brands'
  );
  PERFORM public._erp_assert(
    coalesce((v_preview->'summary'->>'catalog_cleared_on_full')::boolean, false) = true,
    'preview(full).catalog_cleared_on_full must be true'
  );

  -- Exact shape used by DataResetSettingsPage / executeDataReset
  v_exec := public.execute_data_reset(jsonb_build_object(
    'confirm', 'RESET',
    'confirm_phrase', 'RESET full',
    'reset_level', 'full'
  ));

  PERFORM public._erp_assert(coalesce((v_exec->>'ok')::boolean, false), 'execute(full) must return ok');
  PERFORM public._erp_assert(v_exec ? 'run_id', 'execute(full) must return run_id');
  PERFORM public._erp_assert(
    coalesce((v_exec->'summary'->'catalog_soft_deleted'->>'categories')::int, 0) >= 1,
    'execute(full) summary must report categories soft-deleted'
  );
  PERFORM public._erp_assert(
    coalesce((v_exec->'summary'->'catalog_soft_deleted'->>'products')::int, 0) >= 1,
    'execute(full) summary must report products soft-deleted'
  );

  SELECT count(*) INTO v_cnt
  FROM public.categories
  WHERE organization_id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 0, 'full reset must soft-delete all categories');

  SELECT count(*) INTO v_cnt
  FROM public.subcategories
  WHERE organization_id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 0, 'full reset must soft-delete all subcategories');

  SELECT count(*) INTO v_cnt
  FROM public.brands
  WHERE organization_id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 0, 'full reset must soft-delete all brands');

  SELECT count(*) INTO v_cnt
  FROM public.products
  WHERE organization_id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 0, 'full reset must soft-delete all products');

  SELECT count(*) INTO v_cnt
  FROM public.product_variants
  WHERE organization_id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 0, 'full reset must soft-delete all variants');

  -- Org / users / roles preserved
  SELECT count(*) INTO v_cnt
  FROM public.organizations
  WHERE id = v_org AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 1, 'full reset must preserve organization');

  SELECT count(*) INTO v_cnt
  FROM public.profiles
  WHERE id = v_actor AND deleted_at IS NULL AND is_active = true;
  PERFORM public._erp_assert(v_cnt = 1, 'full reset must preserve admin profile');

  SELECT count(*) INTO v_cnt
  FROM public.roles
  WHERE id = v_role AND deleted_at IS NULL;
  PERFORM public._erp_assert(v_cnt = 1, 'full reset must preserve roles');

  SELECT status INTO v_run_status
  FROM public.data_reset_runs
  WHERE id = (v_exec->>'run_id')::uuid;

  PERFORM public._erp_assert(v_run_status = 'completed', 'data_reset_runs status must be completed');

  SELECT count(*) INTO v_cnt
  FROM public.audit_logs
  WHERE organization_id = v_org
    AND action = 'settings.data_reset.execute'
    AND entity_id = (v_exec->>'run_id')::uuid;
  PERFORM public._erp_assert(v_cnt >= 1, 'execute must write audit log');

  -- Soft-delete ephemeral org marker (keep rows for post-mortem if needed)
  UPDATE public.organizations
  SET deleted_at = timezone('utc', now()),
      name = 'QA Data Reset Org (completed)'
  WHERE id = v_org;

  RETURN jsonb_build_object(
    'scenario', 'data_reset_rpc_match',
    'status', 'PASS',
    'org_id', v_org,
    'execute_run_id', v_exec->>'run_id',
    'catalog_soft_deleted', v_exec->'summary'->'catalog_soft_deleted'
  );
END;
$$;

COMMENT ON FUNCTION public.run_erp_qa_data_reset_rpc_match() IS
  'Outcome QA: calls preview_data_reset/execute_data_reset with UI payload; asserts full clears categories.';

REVOKE ALL ON FUNCTION public.run_erp_qa_data_reset_rpc_match() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_qa_data_reset_rpc_match() TO service_role;
