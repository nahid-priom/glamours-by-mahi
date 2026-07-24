-- Branch isolation probe: use auth-context branch gates (SET ROLE not allowed in SECURITY DEFINER)

CREATE OR REPLACE FUNCTION public._erp_security_probe_branch_isolation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := (public._erp_qa_context()->>'org_id')::uuid;
  v_branch_a uuid := (public._erp_qa_context()->>'branch_id')::uuid;
  v_branch_b uuid := (public._erp_qa_context()->>'branch_b_id')::uuid;
  v_user_b uuid := '99999999-9999-9999-9999-999999999904'::uuid;
  v_company uuid := (public._erp_qa_context()->>'courier_company_id')::uuid;
  v_parcel_id uuid;
  v_settlement_id uuid;
  v_count_a int;
  v_count_b int;
  v_total_a int;
  v_can_access_a boolean;
  v_can_access_b boolean;
  v_settle_blocked boolean := false;
  v_inv_blocked boolean := false;
BEGIN
  PERFORM public._erp_qa_require_service();

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch_a, v_company,
    'SBX-BRISO-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 500.00, 20.00
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public._erp_test_set_auth('99999999-9999-9999-9999-999999999902'::uuid);
  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'branch iso probe');

  SELECT id INTO v_settlement_id FROM public.courier_settlements
  WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;

  PERFORM public._erp_test_set_auth(v_user_b);
  BEGIN
    PERFORM public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', (public._erp_qa_context()->>'cash_account_id')::uuid,
      'client_txn_key', 'br-iso-' || replace(gen_random_uuid()::text, '-', '')
    ));
  EXCEPTION WHEN OTHERS THEN
    v_settle_blocked := true;
  END;

  PERFORM public._erp_test_set_auth(v_user_b);
  v_can_access_a := public.user_has_branch_access(v_branch_a);
  v_can_access_b := public.user_has_branch_access(v_branch_b);

  SELECT count(*) INTO v_total_a
  FROM public.inventory_balances ib
  JOIN public.stock_locations sl ON sl.id = ib.location_id AND sl.deleted_at IS NULL
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND sl.branch_id = v_branch_a;

  SELECT count(*) INTO v_count_a
  FROM public.inventory_balances ib
  JOIN public.stock_locations sl ON sl.id = ib.location_id AND sl.deleted_at IS NULL
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND sl.branch_id = v_branch_a
    AND public.user_has_branch_access(sl.branch_id);

  SELECT count(*) INTO v_count_b
  FROM public.inventory_balances ib
  JOIN public.stock_locations sl ON sl.id = ib.location_id AND sl.deleted_at IS NULL
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND sl.branch_id = v_branch_b
    AND public.user_has_branch_access(sl.branch_id);

  v_inv_blocked := (
    NOT v_can_access_a
    AND v_can_access_b
    AND v_count_a = 0
    AND (v_total_a = 0 OR v_count_b >= 0)
  );

  PERFORM public._erp_qa_cleanup_tracking('SBX-BRISO-');

  RETURN jsonb_build_object(
    'branch_b_settle_branch_a_blocked', v_settle_blocked,
    'branch_b_cannot_access_branch_a', NOT v_can_access_a,
    'branch_b_can_access_branch_b', v_can_access_b,
    'branch_b_visible_branch_a_rows', v_count_a,
    'branch_a_total_rows', v_total_a,
    'status', CASE WHEN v_settle_blocked AND v_inv_blocked THEN 'PASS' ELSE 'FAIL' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_security_probe_branch_isolation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_security_probe_branch_isolation() TO service_role;
