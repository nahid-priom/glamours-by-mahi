-- Tighten employees SELECT: org members no longer read all salary/bank fields by default.
-- HR/admin retain full access; staff can read their own linked employee row.

DROP POLICY IF EXISTS employees_org_all ON public.employees;
DROP POLICY IF EXISTS employees_select_self_or_hr ON public.employees;
DROP POLICY IF EXISTS employees_insert_hr ON public.employees;
DROP POLICY IF EXISTS employees_update_hr ON public.employees;

CREATE POLICY employees_select_self_or_hr ON public.employees
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      profile_id = auth.uid()
      OR public.user_has_permission('hr.read')
      OR public.user_has_permission('hr.employee.create')
      OR public.user_has_permission('hr.employee.update')
      OR public.user_has_permission('hr.payroll.read')
      OR public.user_has_permission('administration.users.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

CREATE POLICY employees_insert_hr ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.employee.create')
      OR public.user_has_permission('hr.employee.update')
      OR public.user_has_permission('settings.manage')
    )
  );

CREATE POLICY employees_update_hr ON public.employees
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.employee.update')
      OR public.user_has_permission('hr.employee.create')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('hr.employee.update')
      OR public.user_has_permission('hr.employee.create')
      OR public.user_has_permission('settings.manage')
    )
  );

COMMENT ON POLICY employees_select_self_or_hr ON public.employees IS
  'Self or HR/admin may select employees; blocks casual org-wide salary browsing.';
