-- Migration 116: Staff username auth — profiles.username, login resolve, list fields
-- Note: get_admin_user_detail / update_admin_user branch sync lives in 112; username
-- fields on detail are added in 117 so order stays correct.

--------------------------------------------------------------------------------
-- profiles.username
--------------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_username_format_chk'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_format_chk
      CHECK (
        username IS NULL
        OR username ~ '^[a-zA-Z0-9._-]{3,40}$'
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_org_username_active_uidx
  ON public.profiles (organization_id, lower(username))
  WHERE deleted_at IS NULL AND username IS NOT NULL;

--------------------------------------------------------------------------------
-- resolve_staff_login_email — username or email → Auth email
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_staff_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text := lower(btrim(coalesce(p_identifier, '')));
  v_email text;
  v_count int;
BEGIN
  IF v_id = '' THEN
    RETURN NULL;
  END IF;

  IF position('@' IN v_id) > 0 THEN
    RETURN v_id;
  END IF;

  SELECT count(*), min(p.email)
  INTO v_count, v_email
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
    AND p.is_active = true
    AND p.username IS NOT NULL
    AND lower(p.username) = v_id
    AND p.email IS NOT NULL
    AND btrim(p.email) <> '';

  IF v_count = 1 AND v_email IS NOT NULL THEN
    RETURN lower(btrim(v_email));
  END IF;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_staff_login_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_staff_login_email(text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- list_admin_users — include username + employee
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
      'username', p.username,
      'phone', p.phone,
      'role_id', p.role_id,
      'role_name', r.name,
      'default_branch_id', p.default_branch_id,
      'is_active', p.is_active,
      'employee_id', e.id,
      'employee_name', e.full_name,
      'employee_code', e.employee_code,
      'created_at', p.created_at
    ) ORDER BY p.full_name)
    FROM public.profiles p
    LEFT JOIN public.roles r ON r.id = p.role_id
    LEFT JOIN public.employees e
      ON e.profile_id = p.id
     AND e.organization_id = v_org
     AND e.deleted_at IS NULL
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND (
        v_search IS NULL
        OR p.full_name ILIKE '%' || v_search || '%'
        OR coalesce(p.email, '') ILIKE '%' || v_search || '%'
        OR coalesce(p.username, '') ILIKE '%' || v_search || '%'
        OR coalesce(e.employee_code, '') ILIKE '%' || v_search || '%'
      )
    LIMIT v_limit
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_admin_users(jsonb) TO authenticated, service_role;
