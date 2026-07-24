-- Two-session concurrent stock transfer receive probe (service_role harness)

CREATE OR REPLACE FUNCTION public._erp_qa_prepare_concurrent_transfer()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_branch_b uuid := (v_ctx->>'branch_b_id')::uuid;
  v_actor uuid := (v_ctx->>'actor_id')::uuid;
  v_variant uuid := (v_ctx->>'variant_id')::uuid;
  v_from_loc uuid;
  v_to_loc uuid;
  v_transfer_id uuid;
  v_sti_id uuid;
  v_key text := 'QA-CONC-' || replace(gen_random_uuid()::text, '-', '');
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  v_from_loc := public._saleable_location(v_org, v_branch);
  v_to_loc := public._saleable_location(v_org, v_branch_b);

  INSERT INTO public.stock_transfers (
    id, organization_id, transfer_no, from_branch_id, to_branch_id,
    from_location_id, to_location_id, status, created_by, updated_by
  ) VALUES (
    gen_random_uuid(), v_org, v_key, v_branch, v_branch_b,
    v_from_loc, v_to_loc, 'draft', v_actor, v_actor
  )
  RETURNING id INTO v_transfer_id;

  INSERT INTO public.stock_transfer_items (
    organization_id, transfer_id, variant_id, quantity_sent, unit_cost, created_by, updated_by
  ) VALUES (v_org, v_transfer_id, v_variant, 10, 100.00, v_actor, v_actor)
  RETURNING id INTO v_sti_id;

  PERFORM public.dispatch_stock_transfer(v_transfer_id);

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_item_id', v_sti_id,
    'quantity_sent', 10,
    'tracking_prefix', 'QA-CONC-'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public._erp_qa_receive_transfer_probe(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transfer_id uuid;
  v_sti_id uuid;
  v_qty numeric(14, 3);
  v_result jsonb;
  v_err text;
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  v_transfer_id := NULLIF(payload->>'transfer_id', '')::uuid;
  v_sti_id := NULLIF(payload->>'transfer_item_id', '')::uuid;
  v_qty := coalesce((payload->>'quantity_received')::numeric, 0);

  IF v_transfer_id IS NULL OR v_sti_id IS NULL THEN
    RAISE EXCEPTION 'transfer_id and transfer_item_id are required';
  END IF;
  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'quantity_received must be positive';
  END IF;

  BEGIN
    v_result := public.receive_stock_transfer(
      v_transfer_id,
      jsonb_build_array(jsonb_build_object('id', v_sti_id, 'quantity_received', v_qty)),
      false
    );
    RETURN jsonb_build_object(
      'ok', true,
      'probe_key', payload->>'probe_key',
      'result', v_result
    );
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    RETURN jsonb_build_object(
      'ok', false,
      'probe_key', payload->>'probe_key',
      'error', v_err
    );
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public._erp_qa_finalize_concurrent_transfer_probe(p_transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sti record;
  v_ledger numeric(14, 3);
BEGIN
  PERFORM public._erp_qa_require_service();

  SELECT * INTO v_sti
  FROM public.stock_transfer_items sti
  WHERE sti.transfer_id = p_transfer_id
    AND sti.deleted_at IS NULL
  LIMIT 1;

  SELECT coalesce(sum(sl.quantity_delta), 0) INTO v_ledger
  FROM public.stock_ledger sl
  WHERE sl.reference_type = 'stock_transfer'
    AND sl.reference_id = p_transfer_id
    AND sl.movement_type = 'transfer_in'
    AND sl.deleted_at IS NULL;

  UPDATE public.stock_transfers
  SET deleted_at = timezone('utc', now())
  WHERE id = p_transfer_id;

  UPDATE public.stock_transfer_items
  SET deleted_at = timezone('utc', now())
  WHERE transfer_id = p_transfer_id;

  RETURN jsonb_build_object(
    'quantity_received', coalesce(v_sti.quantity_received, 0),
    'quantity_damaged', coalesce(v_sti.quantity_damaged, 0),
    'quantity_sent', coalesce(v_sti.quantity_sent, 0),
    'transfer_in_ledger_total', v_ledger
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_prepare_concurrent_transfer() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_prepare_concurrent_transfer() TO service_role;
REVOKE ALL ON FUNCTION public._erp_qa_receive_transfer_probe(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_receive_transfer_probe(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public._erp_qa_finalize_concurrent_transfer_probe(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_finalize_concurrent_transfer_probe(uuid) TO service_role;
