-- Fix admin user detail/update to use user_branch_access (SSOT for branch grants).
-- profile_branches was never created; get_admin_user_detail previously referenced it.

--------------------------------------------------------------------------------
-- get_admin_user_detail — read branch_ids from user_branch_access
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
        SELECT jsonb_agg(uba.branch_id ORDER BY uba.branch_id)
        FROM public.user_branch_access uba
        WHERE uba.user_id = p.id
          AND uba.organization_id = v_org
          AND uba.deleted_at IS NULL
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
-- update_admin_user — sync branch_ids into user_branch_access (replace set)
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
  v_branch_id uuid;
  v_branch_ids uuid[] := ARRAY[]::uuid[];
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
    role_id = CASE
      WHEN payload ? 'role_id' THEN NULLIF(payload->>'role_id', '')::uuid
      ELSE p.role_id
    END,
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

  IF payload ? 'branch_ids' THEN
    SELECT coalesce(array_agg(DISTINCT x::uuid), ARRAY[]::uuid[])
    INTO v_branch_ids
    FROM jsonb_array_elements_text(coalesce(payload->'branch_ids', '[]'::jsonb)) AS t(x)
    WHERE NULLIF(x, '') IS NOT NULL;

    -- Soft-delete grants no longer in the set
    UPDATE public.user_branch_access uba
    SET
      deleted_at = timezone('utc', now()),
      updated_by = v_actor,
      updated_at = timezone('utc', now())
    WHERE uba.user_id = v_user_id
      AND uba.organization_id = v_org
      AND uba.deleted_at IS NULL
      AND NOT (uba.branch_id = ANY (v_branch_ids));

    -- Upsert / revive grants in the set (partial unique index prevents ON CONFLICT)
    FOREACH v_branch_id IN ARRAY v_branch_ids
    LOOP
      IF EXISTS (
        SELECT 1
        FROM public.user_branch_access uba
        WHERE uba.user_id = v_user_id
          AND uba.branch_id = v_branch_id
          AND uba.organization_id = v_org
          AND uba.deleted_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      UPDATE public.user_branch_access uba
      SET
        deleted_at = NULL,
        updated_by = v_actor,
        updated_at = timezone('utc', now())
      WHERE uba.id = (
        SELECT uba2.id
        FROM public.user_branch_access uba2
        WHERE uba2.user_id = v_user_id
          AND uba2.branch_id = v_branch_id
          AND uba2.organization_id = v_org
          AND uba2.deleted_at IS NOT NULL
        ORDER BY uba2.updated_at DESC NULLS LAST
        LIMIT 1
      );

      IF FOUND THEN
        CONTINUE;
      END IF;

      INSERT INTO public.user_branch_access (
        organization_id, user_id, branch_id, created_by, updated_by
      )
      VALUES (v_org, v_user_id, v_branch_id, v_actor, v_actor);
    END LOOP;
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
