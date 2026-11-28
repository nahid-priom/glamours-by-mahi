-- V7 FIX-04: dependency-preserving employee archive via SECURITY DEFINER RPC.
-- Soft-deletes the employee row; payroll/attendance/commission history remain.
-- Linked profile revocation is handled by employees_revoke_ineligible_profile (00163).

CREATE OR REPLACE FUNCTION public.archive_employee(p_employee_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_emp public.employees%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('hr.employee.update')
    OR public.user_has_permission('hr.employee.create')
    OR public.user_has_permission('settings.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to archive employee' USING ERRCODE = '42501';
  END IF;

  IF p_employee_id IS NULL THEN
    RAISE EXCEPTION 'employee_id is required';
  END IF;

  SELECT * INTO v_emp
  FROM public.employees e
  WHERE e.id = p_employee_id
    AND e.organization_id = v_org_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_emp.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'employee_id', v_emp.id,
      'idempotent', true,
      'status', v_emp.status,
      'deleted_at', v_emp.deleted_at
    );
  END IF;

  UPDATE public.employees
  SET
    deleted_at = timezone('utc', now()),
    status = CASE
      WHEN status = 'terminated' THEN status
      ELSE 'inactive'
    END,
    updated_by = v_profile_id,
    updated_at = timezone('utc', now())
  WHERE id = v_emp.id
  RETURNING * INTO v_emp;

  RETURN jsonb_build_object(
    'employee_id', v_emp.id,
    'idempotent', false,
    'status', v_emp.status,
    'deleted_at', v_emp.deleted_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.archive_employee(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_employee(uuid) TO authenticated;

COMMENT ON FUNCTION public.archive_employee(uuid) IS
  'Soft-archive employee for operational lists; preserves payroll/attendance/commission history.';
