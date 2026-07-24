-- Extended acceptance scenarios: partial/multi settlement, reversal, branch isolation

CREATE OR REPLACE FUNCTION public._erp_qa_extended_scenarios()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_cash uuid := (v_ctx->>'cash_account_id')::uuid;
  v_company uuid := (v_ctx->>'courier_company_id')::uuid;
  v_key text;
  v_result jsonb;
  v_parcel_id uuid;
  v_parcel2_id uuid;
  v_settlement_id uuid;
  v_settlement2_id uuid;
  v_cash_before numeric(14, 2);
  v_cash_after numeric(14, 2);
  v_probe jsonb;
  v_prefix text;
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  BEGIN
    v_prefix := 'QA-PARTIAL-';
    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      v_prefix || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 1000.00, 40.00
    )
    RETURNING id INTO v_parcel_id;

    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'partial settlement test');
    SELECT id INTO v_settlement_id FROM public.courier_settlements
    WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;

    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', v_cash,
      'amount', 480.00,
      'client_txn_key', 'qa-partial-1-' || replace(gen_random_uuid()::text, '-', '')
    ));
    PERFORM public._erp_assert((v_result->>'status') = 'partially_settled', 'partial status');
    PERFORM public._erp_assert((v_result->>'remaining')::numeric = 480.00, 'remaining 480');

    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', v_cash,
      'client_txn_key', 'qa-partial-2-' || replace(gen_random_uuid()::text, '-', '')
    ));
    PERFORM public._erp_assert((v_result->>'status') = 'settled', 'final settled');

    PERFORM public._erp_qa_cleanup_tracking(v_prefix);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'partial_settlement_lifecycle', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._erp_qa_cleanup_tracking('QA-PARTIAL-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'partial_settlement_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  BEGIN
    v_prefix := 'QA-MULTI-';
    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      v_prefix || 'A-' || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 800.00, 30.00
    )
    RETURNING id INTO v_parcel_id;

    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      v_prefix || 'B-' || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 600.00, 20.00
    )
    RETURNING id INTO v_parcel2_id;

    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'multi A');
    PERFORM public.update_courier_parcel_status(v_parcel2_id, 'delivered', 'multi B');

    SELECT id INTO v_settlement_id FROM public.courier_settlements WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;
    SELECT id INTO v_settlement2_id FROM public.courier_settlements WHERE parcel_id = v_parcel2_id AND deleted_at IS NULL;

    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;

    PERFORM public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id, 'financial_account_id', v_cash,
      'client_txn_key', 'qa-multi-a-' || replace(gen_random_uuid()::text, '-', '')
    ));
    PERFORM public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement2_id, 'financial_account_id', v_cash,
      'client_txn_key', 'qa-multi-b-' || replace(gen_random_uuid()::text, '-', '')
    ));

    SELECT current_balance INTO v_cash_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_cash_after - v_cash_before = 1350.00, '770+580=1350 net');

    PERFORM public._erp_qa_cleanup_tracking(v_prefix);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'multi_parcel_settlement', 'status', 'PASS', 'net_total', 1350.00
    ));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._erp_qa_cleanup_tracking('QA-MULTI-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'multi_parcel_settlement', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  BEGIN
    v_prefix := 'QA-REV-';
    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      v_prefix || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 500.00, 25.00
    )
    RETURNING id INTO v_parcel_id;

    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'reversal test');
    SELECT id INTO v_settlement_id FROM public.courier_settlements WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;

    v_key := 'qa-rev-settle-' || replace(gen_random_uuid()::text, '-', '');
    PERFORM public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id, 'financial_account_id', v_cash, 'client_txn_key', v_key
    ));

    v_result := public.reverse_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'client_txn_key', 'qa-rev-' || replace(gen_random_uuid()::text, '-', ''),
      'reason', 'QA reversal test'
    ));
    PERFORM public._erp_assert((v_result->>'status') = 'pending', 'restored pending');

    PERFORM public._erp_qa_cleanup_tracking(v_prefix);
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_reversal', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._erp_qa_cleanup_tracking('QA-REV-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_reversal', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  BEGIN
    v_probe := public._erp_security_probe_branch_isolation();
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'branch_isolation', 'status', coalesce(v_probe->>'status', 'FAIL'), 'detail', v_probe
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'branch_isolation', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  RETURN v_results;
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_extended_scenarios() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_extended_scenarios() TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public._erp_acceptance_report_base()') IS NULL THEN
    ALTER FUNCTION public.run_erp_acceptance_report() RENAME TO _erp_acceptance_report_base;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.run_erp_acceptance_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base jsonb;
  v_ext jsonb;
  v_merged jsonb;
BEGIN
  PERFORM public._erp_qa_require_service();
  v_base := public._erp_acceptance_report_base();
  v_ext := public._erp_qa_extended_scenarios();
  v_merged := (v_base->'results') || v_ext;
  RETURN jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'sandbox_org', v_base->'sandbox_org',
    'results', v_merged,
    'pass_count', (SELECT count(*) FROM jsonb_array_elements(v_merged) e WHERE e->>'status' = 'PASS'),
    'fail_count', (SELECT count(*) FROM jsonb_array_elements(v_merged) e WHERE e->>'status' = 'FAIL'),
    'partial_count', (SELECT count(*) FROM jsonb_array_elements(v_merged) e WHERE e->>'status' = 'PARTIAL')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_acceptance_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_acceptance_report() TO service_role;
REVOKE ALL ON FUNCTION public._erp_acceptance_report_base() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_acceptance_report_base() TO service_role;
