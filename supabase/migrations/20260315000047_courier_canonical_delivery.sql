-- Canonical courier parcel status transitions with automatic COD accounting

--------------------------------------------------------------------------------
-- Internal: idempotent COD receivable posting (trusted callers only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_courier_cod_accounting(
  p_parcel_id uuid,
  p_actor uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parcel public.courier_parcels%ROWTYPE;
  v_settlement_id uuid;
  v_courier_recv_coa uuid;
  v_recv_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_actor uuid;
BEGIN
  SELECT * INTO v_parcel
  FROM public.courier_parcels cp
  WHERE cp.id = p_parcel_id AND cp.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'skipped', true, 'reason', 'not_found');
  END IF;

  v_actor := COALESCE(p_actor, v_parcel.updated_by, v_parcel.created_by);

  IF COALESCE(v_parcel.cod_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'skipped', true, 'reason', 'no_cod');
  END IF;

  SELECT id INTO v_settlement_id
  FROM public.courier_settlements cs
  WHERE cs.parcel_id = p_parcel_id
    AND cs.organization_id = v_parcel.organization_id
    AND cs.deleted_at IS NULL
  LIMIT 1;

  IF v_settlement_id IS NULL THEN
    INSERT INTO public.courier_settlements (
      organization_id, branch_id, courier_company_id, parcel_id, sale_id,
      cod_amount, courier_charge, return_charge, settlement_amount,
      status, created_by, updated_by
    ) VALUES (
      v_parcel.organization_id, v_parcel.branch_id, v_parcel.courier_company_id,
      v_parcel.id, v_parcel.sale_id,
      v_parcel.cod_amount, COALESCE(v_parcel.courier_charge, 0), 0,
      GREATEST(v_parcel.cod_amount - COALESCE(v_parcel.courier_charge, 0), 0),
      'pending', v_actor, v_actor
    )
    RETURNING id INTO v_settlement_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = v_parcel.organization_id
      AND je.source_type = 'courier_cod'
      AND je.source_id = p_parcel_id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'parcel_id', p_parcel_id,
      'settlement_id', v_settlement_id,
      'idempotent', true
    );
  END IF;

  v_courier_recv_coa := public._coa_by_role(v_parcel.organization_id, 'courier_receivable');
  v_recv_coa := public._coa_by_role(v_parcel.organization_id, 'receivable');

  IF v_courier_recv_coa IS NOT NULL AND v_recv_coa IS NOT NULL THEN
    v_entry_no := 'JE-COD-' || replace(p_parcel_id::text, '-', '');

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_parcel.organization_id, v_parcel.branch_id, v_entry_no,
      (timezone('utc', now()))::date, 'posted',
      'courier_cod', p_parcel_id,
      'Courier COD receivable TRK ' || COALESCE(v_parcel.tracking_no, ''),
      timezone('utc', now()), v_actor, v_actor
    )
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES
      (v_parcel.organization_id, v_journal_id, v_courier_recv_coa,
       'Courier COD receivable', v_parcel.cod_amount, 0, 1, v_actor, v_actor),
      (v_parcel.organization_id, v_journal_id, v_recv_coa,
       'Customer receivable relief', 0, v_parcel.cod_amount, 2, v_actor, v_actor);
  END IF;

  RETURN jsonb_build_object(
    'parcel_id', p_parcel_id,
    'settlement_id', v_settlement_id,
    'cod_amount', v_parcel.cod_amount,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public._apply_courier_cod_accounting(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._apply_courier_cod_accounting(uuid, uuid) TO service_role;

--------------------------------------------------------------------------------
-- Internal: reverse COD journal when delivery is undone
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reverse_courier_cod_accounting(
  p_parcel_id uuid,
  p_actor uuid DEFAULT NULL,
  p_reason text DEFAULT 'Courier delivery reversed'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parcel public.courier_parcels%ROWTYPE;
  v_orig public.journal_entries%ROWTYPE;
  v_courier_recv_coa uuid;
  v_recv_coa uuid;
  v_journal_id uuid;
  v_actor uuid;
BEGIN
  SELECT * INTO v_parcel FROM public.courier_parcels WHERE id = p_parcel_id AND deleted_at IS NULL;
  IF NOT FOUND OR COALESCE(v_parcel.cod_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'skipped', true);
  END IF;

  v_actor := COALESCE(p_actor, v_parcel.updated_by, v_parcel.created_by);

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = v_parcel.organization_id
      AND je.source_type = 'courier_cod_reversal'
      AND je.source_id = p_parcel_id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_orig
  FROM public.journal_entries je
  WHERE je.organization_id = v_parcel.organization_id
    AND je.source_type = 'courier_cod'
    AND je.source_id = p_parcel_id
    AND je.status = 'posted'
    AND je.deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'skipped', true, 'reason', 'no_cod_journal');
  END IF;

  v_courier_recv_coa := public._coa_by_role(v_parcel.organization_id, 'courier_receivable');
  v_recv_coa := public._coa_by_role(v_parcel.organization_id, 'receivable');

  IF v_courier_recv_coa IS NOT NULL AND v_recv_coa IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_parcel.organization_id, v_parcel.branch_id,
      'JE-CODR-' || replace(p_parcel_id::text, '-', ''),
      (timezone('utc', now()))::date, 'posted',
      'courier_cod_reversal', p_parcel_id, p_reason,
      timezone('utc', now()), v_actor, v_actor
    )
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES
      (v_parcel.organization_id, v_journal_id, v_recv_coa,
       'Restore customer receivable', v_parcel.cod_amount, 0, 1, v_actor, v_actor),
      (v_parcel.organization_id, v_journal_id, v_courier_recv_coa,
       'Reverse courier COD receivable', 0, v_parcel.cod_amount, 2, v_actor, v_actor);
  END IF;

  UPDATE public.courier_settlements
  SET status = 'disputed',
      notes = coalesce(notes, '') || ' reversed:' || p_reason,
      updated_by = v_actor
  WHERE parcel_id = p_parcel_id
    AND organization_id = v_parcel.organization_id
    AND status = 'pending'
    AND deleted_at IS NULL;

  RETURN jsonb_build_object('parcel_id', p_parcel_id, 'reversed', true);
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_courier_cod_accounting(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_courier_cod_accounting(uuid, uuid, text) TO service_role;

--------------------------------------------------------------------------------
-- Canonical parcel status RPC (all delivery paths must use this)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_courier_parcel_status(
  p_parcel_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_parcel public.courier_parcels%ROWTYPE;
  v_status text;
  v_allowed text[] := ARRAY[
    'booked', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned', 'cancelled'
  ];
  v_cod_result jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('courier.book')
    OR public.user_has_permission('courier.settle')
    OR public.user_has_permission('courier.cancel')
    OR public.user_has_permission('orders.fulfil')
  ) THEN
    RAISE EXCEPTION 'Missing courier permission' USING ERRCODE = '42501';
  END IF;

  v_status := lower(btrim(p_status));
  IF NOT (v_status = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid parcel status: %', p_status;
  END IF;

  SELECT * INTO v_parcel
  FROM public.courier_parcels cp
  WHERE cp.id = p_parcel_id
    AND cp.organization_id = v_org_id
    AND cp.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;

  IF v_parcel.branch_id IS NOT NULL
     AND NOT public.user_has_branch_access(v_parcel.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_parcel.status = v_status THEN
    IF v_status = 'delivered' AND COALESCE(v_parcel.cod_amount, 0) > 0 THEN
      v_cod_result := public._apply_courier_cod_accounting(p_parcel_id, v_profile_id);
      RETURN jsonb_build_object(
        'parcel_id', p_parcel_id,
        'status', v_status,
        'idempotent', true,
        'cod', v_cod_result
      );
    END IF;
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'status', v_status, 'idempotent', true);
  END IF;

  IF v_parcel.status = 'delivered'
     AND v_status IN ('returned', 'cancelled', 'failed') THEN
    PERFORM public._reverse_courier_cod_accounting(p_parcel_id, v_profile_id, p_notes);
  END IF;

  PERFORM set_config('app.allow_parcel_status', '1', true);

  UPDATE public.courier_parcels
  SET status = v_status,
      delivered_at = CASE
        WHEN v_status = 'delivered' THEN COALESCE(delivered_at, timezone('utc', now()))
        WHEN v_status IN ('returned', 'cancelled', 'failed') THEN NULL
        ELSE delivered_at
      END,
      updated_by = v_profile_id
  WHERE id = p_parcel_id;

  IF v_status = 'delivered' THEN
    v_cod_result := public._apply_courier_cod_accounting(p_parcel_id, v_profile_id);
  END IF;

  INSERT INTO public.courier_events (
    organization_id, courier_company_id, parcel_id,
    external_event_id, event_type, payload, occurred_at, processed_at, created_by
  ) VALUES (
    v_org_id, v_parcel.courier_company_id, p_parcel_id,
    'status-' || p_parcel_id::text || '-' || v_status || '-' || extract(epoch from timezone('utc', now()))::bigint,
    v_status,
    jsonb_build_object('notes', p_notes, 'source', 'update_courier_parcel_status'),
    timezone('utc', now()), timezone('utc', now()), v_profile_id
  );

  PERFORM public.write_audit_log(
    v_org_id, v_parcel.branch_id, v_profile_id,
    'courier.parcel.status', 'courier_parcel', p_parcel_id,
    jsonb_build_object('status', v_parcel.status),
    jsonb_build_object('status', v_status, 'notes', p_notes),
    NULL,
    jsonb_build_object('source', 'update_courier_parcel_status')
  );

  RETURN jsonb_build_object(
    'parcel_id', p_parcel_id,
    'status', v_status,
    'idempotent', false,
    'cod', v_cod_result
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_courier_parcel_status(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_courier_parcel_status(uuid, text, text) TO authenticated;

--------------------------------------------------------------------------------
-- Preserve public signature: delegate to canonical status RPC
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_courier_cod_receivable(p_parcel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.update_courier_parcel_status(p_parcel_id, 'delivered', 'COD receivable via record_courier_cod_receivable');
END;
$$;

REVOKE ALL ON FUNCTION public.record_courier_cod_receivable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_courier_cod_receivable(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Safety net: direct status updates still post COD once (idempotent internal)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_courier_parcel_delivery_cod()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NULL
     AND NEW.status = 'delivered'
     AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    PERFORM public._apply_courier_cod_accounting(NEW.id, NEW.updated_by);
  ELSIF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NULL
     AND OLD.status = 'delivered'
     AND NEW.status IN ('returned', 'cancelled', 'failed')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public._reverse_courier_cod_accounting(NEW.id, NEW.updated_by, 'Status reverted from delivered');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courier_parcels_delivery_cod ON public.courier_parcels;
CREATE TRIGGER courier_parcels_delivery_cod
  AFTER UPDATE OF status ON public.courier_parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_courier_parcel_delivery_cod();
