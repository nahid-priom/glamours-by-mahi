-- Migration 105: Administration RPCs + permission seeds

INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('administration.read', 'Access administration hub'),
  ('administration.users.read', 'List and view staff users'),
  ('administration.users.create', 'Invite and create staff users'),
  ('administration.users.update', 'Update staff profiles and roles'),
  ('administration.users.deactivate', 'Deactivate staff users'),
  ('administration.users.reset_password', 'Trigger password reset for staff'),
  ('administration.roles.manage', 'Manage roles and permission assignments'),
  ('administration.permissions.read', 'View permission catalog'),
  ('administration.activity.read', 'View administration activity'),
  ('settings.data_reset', 'Preview and execute org data reset (destructive)')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = x.key AND p.deleted_at IS NULL
);

-- Grant administration.* to Super Admin / Owner roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Super Admin', 'Owner')
  AND r.deleted_at IS NULL
  AND p.key LIKE 'administration.%'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.key = 'settings.data_reset'
WHERE r.name IN ('Super Admin', 'Owner')
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- list_admin_users
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_users(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_search text := nullif(btrim(payload->>'search'), '');
  v_limit int := least(greatest(coalesce((payload->>'limit')::int, 50), 1), 200);
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('administration.users.read') THEN
    RAISE EXCEPTION 'Missing permission administration.users.read' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'role_id', p.role_id,
      'role_name', r.name,
      'default_branch_id', p.default_branch_id,
      'is_active', p.is_active,
      'created_at', p.created_at
    ) ORDER BY p.full_name)
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND (
        v_search IS NULL
        OR p.full_name ILIKE '%' || v_search || '%'
        OR p.email ILIKE '%' || v_search || '%'
      )
    LIMIT v_limit
  ), '[]'::jsonb);
END;
$$;

--------------------------------------------------------------------------------
-- get_admin_user_detail
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('administration.users.read') THEN
    RAISE EXCEPTION 'Missing permission administration.users.read' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'id', p.id,
      'full_name', p.full_name,
      'email', p.email,
      'phone', p.phone,
      'role_id', p.role_id,
      'role_name', r.name,
      'default_branch_id', p.default_branch_id,
      'is_active', p.is_active,
      'branch_ids', coalesce((
        SELECT jsonb_agg(pb.branch_id)
        FROM public.profile_branches pb
        WHERE pb.profile_id = p.id AND pb.deleted_at IS NULL
      ), '[]'::jsonb),
      'created_at', p.created_at
    )
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = p_user_id
      AND p.organization_id = v_org
      AND p.deleted_at IS NULL
  );
END;
$$;

--------------------------------------------------------------------------------
-- update_admin_user
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_admin_user(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_user_id uuid := NULLIF(payload->>'user_id', '')::uuid;
BEGIN
  IF v_org IS NULL OR v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF NOT public.user_has_permission('administration.users.update') THEN
    RAISE EXCEPTION 'Missing permission administration.users.update' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles p
  SET
    full_name = coalesce(NULLIF(payload->>'full_name', ''), p.full_name),
    phone = coalesce(NULLIF(payload->>'phone', ''), p.phone),
    role_id = coalesce(NULLIF(payload->>'role_id', '')::uuid, p.role_id),
    default_branch_id = CASE
      WHEN payload ? 'default_branch_id' THEN NULLIF(payload->>'default_branch_id', '')::uuid
      ELSE p.default_branch_id
    END,
    is_active = coalesce((payload->>'is_active')::boolean, p.is_active),
    updated_by = v_actor,
    updated_at = timezone('utc', now())
  WHERE p.id = v_user_id
    AND p.organization_id = v_org
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  PERFORM public.write_audit_log(
    v_org, NULL, v_actor,
    'admin.user.update', 'profile', v_user_id,
    NULL, payload, NULL,
    jsonb_build_object('source', 'update_admin_user')
  );

  RETURN public.get_admin_user_detail(v_user_id);
END;
$$;

--------------------------------------------------------------------------------
-- list_admin_roles
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_roles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('administration.roles.manage')
    OR public.user_has_permission('administration.users.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id,
      'name', r.name,
      'description', r.description,
      'is_system', r.is_system,
      'permission_count', (
        SELECT count(*) FROM public.role_permissions rp
        WHERE rp.role_id = r.id AND rp.deleted_at IS NULL
      )
    ) ORDER BY r.name)
    FROM public.roles r
    WHERE r.organization_id = v_org AND r.deleted_at IS NULL
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_users(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_users(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_admin_user_detail(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_admin_user(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_admin_user(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.list_admin_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_admin_roles() TO authenticated, service_role;
