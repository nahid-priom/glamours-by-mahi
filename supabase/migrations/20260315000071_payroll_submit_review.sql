-- Migration 071: submit_payroll_for_review RPC

CREATE OR REPLACE FUNCTION public.submit_payroll_for_review(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_run public.payroll_runs%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('hr.payroll.review')
    OR public.user_has_permission('hr.payroll.approve')
    OR public.user_has_permission('hr.payroll.create')
  ) THEN
    RAISE EXCEPTION 'Missing permission hr.payroll.review' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_run
  FROM public.payroll_runs
  WHERE id = NULLIF(payload->>'payroll_run_id', '')::uuid
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Payroll run not found'; END IF;
  IF v_run.status NOT IN ('calculated', 'recalculation_required') THEN
    RAISE EXCEPTION 'Only calculated payroll can be submitted for review';
  END IF;

  UPDATE public.payroll_runs
  SET status = 'reviewed',
      reviewed_at = timezone('utc', now()),
      submitted_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_run.id;

  INSERT INTO public.payroll_approval_logs (
    organization_id, payroll_run_id, action, from_status, to_status,
    comments, created_by
  ) VALUES (
    v_org_id, v_run.id, 'submitted_for_review', v_run.status, 'reviewed',
    NULLIF(payload->>'comments', ''), v_profile_id
  );

  RETURN jsonb_build_object('payroll_run_id', v_run.id, 'status', 'reviewed');
END;
$$;

REVOKE ALL ON FUNCTION public.submit_payroll_for_review(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_payroll_for_review(jsonb) TO authenticated;
