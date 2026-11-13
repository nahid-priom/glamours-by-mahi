-- Secure create / approve / disburse employee advances (payroll recovers disbursed/recovering).

CREATE OR REPLACE FUNCTION public.create_employee_advance(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_employee uuid := NULLIF(payload->>'employee_id', '')::uuid;
  v_amount numeric := coalesce((payload->>'amount')::numeric, 0);
  v_recovery numeric := NULLIF(payload->>'recovery_per_payroll', '')::numeric;
  v_reason text := nullif(btrim(payload->>'reason'), '');
  v_branch uuid;
  v_id uuid;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('hr.employee_advance.manage')
    OR public.user_has_permission('hr.payroll.create')
    OR public.user_has_permission('hr.payroll.approve')
    OR public.user_has_permission('settings.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;
  IF v_employee IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'employee_id and positive amount required';
  END IF;

  SELECT branch_id INTO v_branch FROM public.employees
  WHERE id = v_employee AND organization_id = v_org AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found'; END IF;

  INSERT INTO public.employee_advances (
    organization_id, employee_id, branch_id, amount, remaining_amount,
    status, recovery_per_payroll, reason, created_by
  ) VALUES (
    v_org, v_employee, v_branch, v_amount, v_amount,
    'pending', v_recovery, v_reason, v_actor
  )
  RETURNING id INTO v_id;

  PERFORM public.write_audit_log(
    v_org, v_branch, v_actor,
    'hr.advance.create', 'employee_advance', v_id,
    NULL,
    jsonb_build_object('employee_id', v_employee, 'amount', v_amount),
    NULL,
    jsonb_build_object('source', 'create_employee_advance')
  );

  RETURN jsonb_build_object('id', v_id, 'status', 'pending');
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_employee_advance(p_advance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_row public.employee_advances%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('hr.employee_advance.manage')
    OR public.user_has_permission('hr.payroll.approve')
    OR public.user_has_permission('settings.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.employee_advances
  WHERE id = p_advance_id AND organization_id = v_org AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Advance not found'; END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending advances can be approved';
  END IF;

  UPDATE public.employee_advances SET status = 'approved', updated_at = timezone('utc', now())
  WHERE id = p_advance_id;

  PERFORM public.write_audit_log(
    v_org, v_row.branch_id, v_actor,
    'hr.advance.approve', 'employee_advance', p_advance_id,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', 'approved'),
    NULL,
    jsonb_build_object('source', 'approve_employee_advance')
  );

  RETURN jsonb_build_object('id', p_advance_id, 'status', 'approved');
END;
$$;

CREATE OR REPLACE FUNCTION public.disburse_employee_advance(p_advance_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_row public.employee_advances%ROWTYPE;
BEGIN
  IF v_org IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (
    public.user_has_permission('hr.employee_advance.manage')
    OR public.user_has_permission('hr.payroll.pay')
    OR public.user_has_permission('settings.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.employee_advances
  WHERE id = p_advance_id AND organization_id = v_org AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Advance not found'; END IF;
  IF v_row.status NOT IN ('approved', 'pending') THEN
    RAISE EXCEPTION 'Advance cannot be disbursed from status %', v_row.status;
  END IF;

  UPDATE public.employee_advances
  SET status = 'disbursed',
      disbursed_at = timezone('utc', now()),
      remaining_amount = amount - coalesce(recovered_amount, 0),
      updated_at = timezone('utc', now())
  WHERE id = p_advance_id;

  PERFORM public.write_audit_log(
    v_org, v_row.branch_id, v_actor,
    'hr.advance.disburse', 'employee_advance', p_advance_id,
    jsonb_build_object('status', v_row.status),
    jsonb_build_object('status', 'disbursed'),
    NULL,
    jsonb_build_object('source', 'disburse_employee_advance')
  );

  RETURN jsonb_build_object('id', p_advance_id, 'status', 'disbursed');
END;
$$;

REVOKE ALL ON FUNCTION public.create_employee_advance(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_employee_advance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.disburse_employee_advance(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_employee_advance(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_employee_advance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disburse_employee_advance(uuid) TO authenticated;
