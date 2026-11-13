-- Bulk approve commissions with per-id results (V2.3).
-- Wraps approve_sales_commission; does not invent new status rules.
-- Semantics: processes all ids; returns per-id ok/fail (partial success allowed and reported).

CREATE OR REPLACE FUNCTION public.bulk_approve_sales_commissions(p_commission_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_one jsonb;
  v_ok int := 0;
  v_fail int := 0;
  v_err text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.commission.approve')
    OR public.user_has_permission('sales.commission.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission sales.commission.approve' USING ERRCODE = '42501';
  END IF;

  IF p_commission_ids IS NULL OR cardinality(p_commission_ids) = 0 THEN
    RAISE EXCEPTION 'commission_ids required';
  END IF;

  IF cardinality(p_commission_ids) > 200 THEN
    RAISE EXCEPTION 'Bulk approve limited to 200 commissions per request';
  END IF;

  FOREACH v_id IN ARRAY p_commission_ids
  LOOP
    BEGIN
      v_one := public.approve_sales_commission(v_id);
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'id', v_id,
          'ok', true,
          'result', v_one
        )
      );
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
      v_results := v_results || jsonb_build_array(
        jsonb_build_object(
          'id', v_id,
          'ok', false,
          'error', v_err
        )
      );
      v_fail := v_fail + 1;
    END;
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, NULL, v_profile_id,
    'sales.commission.bulk_approve', 'salesman_commission', NULL,
    NULL,
    jsonb_build_object(
      'requested', cardinality(p_commission_ids),
      'ok', v_ok,
      'fail', v_fail,
      'ids', to_jsonb(p_commission_ids)
    ),
    NULL,
    jsonb_build_object('source', 'bulk_approve_sales_commissions')
  );

  RETURN jsonb_build_object(
    'ok', v_ok,
    'fail', v_fail,
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_approve_sales_commissions(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_approve_sales_commissions(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.bulk_approve_sales_commissions(uuid[]) IS
  'Approve many salesman_commissions via approve_sales_commission; returns per-id ok/fail summary.';
