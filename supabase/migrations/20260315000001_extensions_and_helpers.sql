-- Glamourous by Mahi · Retail ERP
-- Migration 001: Extensions and security/helper functions
-- Helpers resolve profiles / permissions at runtime (tables created in 002).

--------------------------------------------------------------------------------
-- Extensions
--------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- Ensure gen_random_uuid is available in public search path contexts
COMMENT ON EXTENSION pgcrypto IS 'Cryptographic functions and gen_random_uuid()';
COMMENT ON EXTENSION "uuid-ossp" IS 'UUID generation helpers (uuid_generate_v4)';

--------------------------------------------------------------------------------
-- updated_at trigger helper
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'BEFORE UPDATE trigger: sets NEW.updated_at to UTC now().';

--------------------------------------------------------------------------------
-- Soft-delete helpers
-- Convention: rows with deleted_at IS NOT NULL are soft-deleted.
-- Prefer filtering with NOT soft_deleted(deleted_at) or deleted_at IS NULL.
-- Unique business keys should use partial indexes WHERE deleted_at IS NULL.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.soft_deleted(p_deleted_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT p_deleted_at IS NOT NULL;
$$;

COMMENT ON FUNCTION public.soft_deleted(timestamptz) IS
  'Returns true when the row is soft-deleted (deleted_at is set). '
  'Use: WHERE NOT soft_deleted(deleted_at) or WHERE deleted_at IS NULL. '
  'Never hard-delete business rows unless wiping an organization.';

--------------------------------------------------------------------------------
-- Auth / tenancy helpers (SECURITY DEFINER, fixed search_path)
-- Depend on: profiles, roles, permissions, role_permissions, user_branch_access
--------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT p.id
  INTO v_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = true;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.current_profile_id() IS
  'Active profile id for auth.uid(), or NULL if missing/inactive/deleted.';

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
BEGIN
  SELECT p.organization_id
  INTO v_org_id
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.deleted_at IS NULL
    AND p.is_active = true;

  RETURN v_org_id;
END;
$$;

COMMENT ON FUNCTION public.current_organization_id() IS
  'Organization id for the current active profile.';

CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR p_permission_key IS NULL OR btrim(p_permission_key) = '' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.role_permissions rp ON rp.role_id = pr.role_id
    JOIN public.permissions perm ON perm.id = rp.permission_id
    WHERE pr.id = auth.uid()
      AND pr.deleted_at IS NULL
      AND pr.is_active = true
      AND pr.role_id IS NOT NULL
      AND perm.key = p_permission_key
      AND perm.deleted_at IS NULL
  )
  INTO v_allowed;

  RETURN coalesce(v_allowed, false);
END;
$$;

COMMENT ON FUNCTION public.user_has_permission(text) IS
  'True if current profile role grants the permission key '
  '(profiles → role_permissions → permissions).';

CREATE OR REPLACE FUNCTION public.user_has_branch_access(p_branch_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL OR p_branch_id IS NULL THEN
    RETURN false;
  END IF;

  -- settings.manage may access all branches in the organization
  IF public.user_has_permission('settings.manage') THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.branches b
      WHERE b.id = p_branch_id
        AND b.organization_id = public.current_organization_id()
        AND b.deleted_at IS NULL
    )
    INTO v_allowed;
    RETURN coalesce(v_allowed, false);
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_branch_access uba
    JOIN public.branches b ON b.id = uba.branch_id
    JOIN public.profiles pr ON pr.id = uba.user_id
    WHERE uba.user_id = auth.uid()
      AND uba.branch_id = p_branch_id
      AND uba.deleted_at IS NULL
      AND b.deleted_at IS NULL
      AND b.is_active = true
      AND b.organization_id = pr.organization_id
      AND pr.deleted_at IS NULL
      AND pr.is_active = true
  )
  INTO v_allowed;

  RETURN coalesce(v_allowed, false);
END;
$$;

COMMENT ON FUNCTION public.user_has_branch_access(uuid) IS
  'True if the current user may access the branch (explicit grant or settings.manage).';

-- Restrict execute to authenticated; revokes public default where present
REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_organization_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_has_branch_access(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_branch_access(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_deleted(timestamptz) TO authenticated;
