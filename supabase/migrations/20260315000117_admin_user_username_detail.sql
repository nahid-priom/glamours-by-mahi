-- Migration 117: Admin user detail includes username + linked employee (after 112 branch fix)

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
      'username', p.username,
      'phone', p.phone,
      'role_id', p.role_id,
      'role_name', r.name,
      'default_branch_id', p.default_branch_id,
      'is_active', p.is_active,
      'employee_id', e.id,
      'employee_name', e.full_name,
      'employee_code', e.employee_code,
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
    LEFT JOIN public.employees e
      ON e.profile_id = p.id
     AND e.organization_id = v_org
     AND e.deleted_at IS NULL
    WHERE p.id = p_user_id
      AND p.organization_id = v_org
      AND p.deleted_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_user_detail(uuid) TO authenticated, service_role;
