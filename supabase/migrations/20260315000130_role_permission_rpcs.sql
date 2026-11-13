-- Atomic role + permission create/update RPCs (V2.3).
-- SECURITY DEFINER with actor/org checks; privilege subset; audit log.

CREATE OR REPLACE FUNCTION public._actor_is_owner_or_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.roles r ON r.id = pr.role_id
    WHERE pr.id = auth.uid()
      AND pr.deleted_at IS NULL
      AND pr.is_active = true
      AND r.deleted_at IS NULL
      AND lower(btrim(r.name)) IN ('owner', 'super admin')
  );
$$;

CREATE OR REPLACE FUNCTION public._sync_role_permission_keys(
  p_role_id uuid,
  p_permission_keys text[],
  p_actor_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_desired uuid[];
  v_missing text[];
BEGIN
  SELECT coalesce(array_agg(DISTINCT p.id), ARRAY[]::uuid[])
  INTO v_desired
  FROM public.permissions p
  WHERE p.deleted_at IS NULL
    AND p.key = ANY (p_permission_keys);

  SELECT coalesce(array_agg(k), ARRAY[]::text[])
  INTO v_missing
  FROM unnest(p_permission_keys) AS k
  WHERE NOT EXISTS (
    SELECT 1 FROM public.permissions p
    WHERE p.deleted_at IS NULL AND p.key = k
  );

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Unknown permission keys: %', array_to_string(v_missing[1:5], ', ');
  END IF;

  IF cardinality(v_desired) IS NULL OR cardinality(v_desired) = 0 THEN
    RAISE EXCEPTION 'Select at least one permission';
  END IF;

  -- Soft-delete active assignments not in the desired set
  UPDATE public.role_permissions rp
  SET
    deleted_at = timezone('utc', now()),
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE rp.role_id = p_role_id
    AND rp.deleted_at IS NULL
    AND NOT (rp.permission_id = ANY (v_desired));

  -- Restore previously soft-deleted desired rows
  UPDATE public.role_permissions rp
  SET
    deleted_at = NULL,
    updated_by = p_actor_id,
    updated_at = timezone('utc', now())
  WHERE rp.role_id = p_role_id
    AND rp.deleted_at IS NOT NULL
    AND rp.permission_id = ANY (v_desired);

  -- Insert missing active pairs
  INSERT INTO public.role_permissions (role_id, permission_id, created_by, updated_by)
  SELECT p_role_id, d.permission_id, p_actor_id, p_actor_id
  FROM unnest(v_desired) AS d(permission_id)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.role_id = p_role_id
      AND rp.permission_id = d.permission_id
      AND rp.deleted_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._assert_assignable_permission_keys(p_permission_keys text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_escalated text[];
BEGIN
  IF public._actor_is_owner_or_super_admin() THEN
    RETURN;
  END IF;

  SELECT coalesce(array_agg(k), ARRAY[]::text[])
  INTO v_escalated
  FROM unnest(p_permission_keys) AS k
  WHERE NOT public.user_has_permission(k);

  IF cardinality(v_escalated) > 0 THEN
    RAISE EXCEPTION 'Privilege escalation denied for: %', array_to_string(v_escalated[1:5], ', ')
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_role_with_permissions(
  p_name text,
  p_description text,
  p_permission_keys text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_role_id uuid;
  v_keys text[];
  v_before jsonb := NULL;
BEGIN
  IF v_org IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'Missing permission settings.manage' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Role name is required';
  END IF;

  IF lower(btrim(p_name)) IN ('owner', 'super admin') THEN
    RAISE EXCEPTION 'Cannot create locked system role names';
  END IF;

  SELECT coalesce(array_agg(DISTINCT btrim(k)), ARRAY[]::text[])
  INTO v_keys
  FROM unnest(coalesce(p_permission_keys, ARRAY[]::text[])) AS k
  WHERE btrim(k) <> '' AND btrim(k) <> '*';

  PERFORM public._assert_assignable_permission_keys(v_keys);

  INSERT INTO public.roles (
    organization_id, name, description, is_system, created_by, updated_by
  )
  VALUES (
    v_org,
    btrim(p_name),
    NULLIF(btrim(coalesce(p_description, '')), ''),
    false,
    v_actor,
    v_actor
  )
  RETURNING id INTO v_role_id;

  PERFORM public._sync_role_permission_keys(v_role_id, v_keys, v_actor);

  PERFORM public.write_audit_log(
    v_org, NULL, v_actor,
    'admin.role.create', 'role', v_role_id,
    v_before,
    jsonb_build_object(
      'name', btrim(p_name),
      'description', NULLIF(btrim(coalesce(p_description, '')), ''),
      'permissions', to_jsonb(v_keys)
    ),
    NULL,
    jsonb_build_object('source', 'create_role_with_permissions')
  );

  RETURN jsonb_build_object(
    'id', v_role_id,
    'name', btrim(p_name),
    'permissions', to_jsonb(v_keys)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_role_with_permissions(
  p_role_id uuid,
  p_name text,
  p_description text,
  p_permission_keys text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_role public.roles%ROWTYPE;
  v_keys text[];
  v_before_perms text[];
BEGIN
  IF v_org IS NULL OR v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'Missing permission settings.manage' USING ERRCODE = '42501';
  END IF;

  IF p_role_id IS NULL THEN
    RAISE EXCEPTION 'role_id is required';
  END IF;

  SELECT * INTO v_role
  FROM public.roles r
  WHERE r.id = p_role_id
    AND r.organization_id = v_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF lower(btrim(v_role.name)) IN ('owner', 'super admin') THEN
    RAISE EXCEPTION 'System Owner / Super Admin role permissions cannot be edited here'
      USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(array_agg(DISTINCT btrim(k)), ARRAY[]::text[])
  INTO v_keys
  FROM unnest(coalesce(p_permission_keys, ARRAY[]::text[])) AS k
  WHERE btrim(k) <> '' AND btrim(k) <> '*';

  PERFORM public._assert_assignable_permission_keys(v_keys);

  SELECT coalesce(array_agg(p.key ORDER BY p.key), ARRAY[]::text[])
  INTO v_before_perms
  FROM public.role_permissions rp
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE rp.role_id = v_role.id
    AND rp.deleted_at IS NULL
    AND p.deleted_at IS NULL;

  IF v_role.is_system IS NOT TRUE THEN
    IF p_name IS NULL OR btrim(p_name) = '' THEN
      RAISE EXCEPTION 'Role name is required';
    END IF;
    IF lower(btrim(p_name)) IN ('owner', 'super admin') THEN
      RAISE EXCEPTION 'Cannot rename role to locked system name';
    END IF;

    UPDATE public.roles
    SET
      name = btrim(p_name),
      description = NULLIF(btrim(coalesce(p_description, '')), ''),
      updated_by = v_actor,
      updated_at = timezone('utc', now())
    WHERE id = v_role.id
      AND is_system = false;
  END IF;

  PERFORM public._sync_role_permission_keys(v_role.id, v_keys, v_actor);

  PERFORM public.write_audit_log(
    v_org, NULL, v_actor,
    'admin.role.update_permissions', 'role', v_role.id,
    jsonb_build_object(
      'name', v_role.name,
      'description', v_role.description,
      'permissions', to_jsonb(v_before_perms)
    ),
    jsonb_build_object(
      'name', CASE WHEN v_role.is_system THEN v_role.name ELSE btrim(p_name) END,
      'description', CASE
        WHEN v_role.is_system THEN v_role.description
        ELSE NULLIF(btrim(coalesce(p_description, '')), '')
      END,
      'permissions', to_jsonb(v_keys)
    ),
    NULL,
    jsonb_build_object('source', 'update_role_with_permissions')
  );

  RETURN jsonb_build_object(
    'id', v_role.id,
    'name', CASE WHEN v_role.is_system THEN v_role.name ELSE btrim(p_name) END,
    'permissions', to_jsonb(v_keys)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._actor_is_owner_or_super_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_role_permission_keys(uuid, text[], uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_assignable_permission_keys(text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_role_with_permissions(text, text, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_role_with_permissions(uuid, text, text, text[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_role_with_permissions(text, text, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_role_with_permissions(uuid, text, text, text[]) TO authenticated;

COMMENT ON FUNCTION public.create_role_with_permissions(text, text, text[]) IS
  'Atomically create a non-system role and its role_permissions; requires settings.manage.';
COMMENT ON FUNCTION public.update_role_with_permissions(uuid, text, text, text[]) IS
  'Atomically update role metadata (non-system) and replace role_permissions; locks Owner/Super Admin.';
