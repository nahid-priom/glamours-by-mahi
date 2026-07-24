-- Partial stock transfer receiving: accumulate receipts, damaged/quarantine, partially_received status

ALTER TABLE public.stock_transfers
  DROP CONSTRAINT IF EXISTS stock_transfers_status_check;

ALTER TABLE public.stock_transfers
  ADD CONSTRAINT stock_transfers_status_check
  CHECK (status IN ('draft', 'in_transit', 'partially_received', 'received', 'cancelled'));

ALTER TABLE public.stock_transfer_items
  ADD COLUMN IF NOT EXISTS quantity_damaged numeric(14, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.stock_transfer_items
  DROP CONSTRAINT IF EXISTS stock_transfer_items_qty_damaged_non_negative;

ALTER TABLE public.stock_transfer_items
  ADD CONSTRAINT stock_transfer_items_qty_damaged_non_negative
  CHECK (quantity_damaged >= 0);

CREATE OR REPLACE FUNCTION public.receive_stock_transfer(
  transfer_id uuid,
  items jsonb,
  finalize boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_tr public.stock_transfers%ROWTYPE;
  v_item jsonb;
  v_sti public.stock_transfer_items%ROWTYPE;
  v_recv_inc numeric(14, 3);
  v_damaged_inc numeric(14, 3);
  v_new_received numeric(14, 3);
  v_new_damaged numeric(14, 3);
  v_all_complete boolean := true;
  v_damaged_loc uuid;
  v_quarantine_loc uuid;
  v_condition text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Missing permission inventory.transfer' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tr
  FROM public.stock_transfers st
  WHERE st.id = transfer_id AND st.organization_id = v_org_id AND st.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;

  IF NOT public.user_has_branch_access(v_tr.to_branch_id) THEN
    RAISE EXCEPTION 'No access to destination branch' USING ERRCODE = '42501';
  END IF;

  IF v_tr.status = 'received' THEN
    RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'received', 'idempotent', true);
  END IF;

  IF v_tr.status NOT IN ('in_transit', 'partially_received') THEN
    RAISE EXCEPTION 'Only in_transit or partially_received transfers can be received';
  END IF;

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' OR jsonb_array_length(items) < 1 THEN
    RAISE EXCEPTION 'items with quantity_received is required';
  END IF;

  v_damaged_loc := public._location_by_type(v_org_id, v_tr.to_branch_id, 'damaged');
  v_quarantine_loc := public._location_by_type(v_org_id, v_tr.to_branch_id, 'quarantine');

  FOR v_item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    v_recv_inc := COALESCE((v_item->>'quantity_received')::numeric, 0);
    v_damaged_inc := COALESCE((v_item->>'quantity_damaged')::numeric, 0);
    v_condition := lower(btrim(COALESCE(v_item->>'condition', 'sellable')));

    IF v_recv_inc < 0 OR v_damaged_inc < 0 THEN
      RAISE EXCEPTION 'quantity_received and quantity_damaged cannot be negative';
    END IF;
    IF v_recv_inc = 0 AND v_damaged_inc = 0 THEN
      CONTINUE;
    END IF;

    SELECT * INTO v_sti
    FROM public.stock_transfer_items sti
    WHERE sti.transfer_id = v_tr.id
      AND sti.deleted_at IS NULL
      AND (
        (v_item->>'id') IS NOT NULL AND sti.id = (v_item->>'id')::uuid
        OR (v_item->>'variant_id') IS NOT NULL AND sti.variant_id = (v_item->>'variant_id')::uuid
      )
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Transfer item not found'; END IF;

    v_new_received := COALESCE(v_sti.quantity_received, 0) + v_recv_inc;
    v_new_damaged := COALESCE(v_sti.quantity_damaged, 0) + v_damaged_inc;

    IF v_new_received + v_new_damaged > v_sti.quantity_sent THEN
      RAISE EXCEPTION 'Received + damaged cannot exceed quantity_sent for variant %', v_sti.variant_id;
    END IF;

    UPDATE public.stock_transfer_items
    SET quantity_received = v_new_received,
        quantity_damaged = v_new_damaged,
        notes = COALESCE(NULLIF(btrim(v_item->>'notes'), ''), notes),
        updated_by = v_profile_id
    WHERE id = v_sti.id;

    IF v_recv_inc > 0 THEN
      PERFORM public._adjust_inventory(
        v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_tr.to_location_id,
        v_recv_inc, v_sti.unit_cost, 'transfer_in', 'stock_transfer', v_tr.id,
        v_profile_id, 'Receive transfer ' || v_tr.transfer_no
      );
    END IF;

    IF v_damaged_inc > 0 THEN
      IF v_condition IN ('damaged', 'sellable') AND v_damaged_loc IS NOT NULL THEN
        PERFORM public._adjust_inventory(
          v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_damaged_loc,
          v_damaged_inc, v_sti.unit_cost, 'damage', 'stock_transfer', v_tr.id,
          v_profile_id, 'Damaged on transfer receive ' || v_tr.transfer_no
        );
      ELSIF v_quarantine_loc IS NOT NULL THEN
        PERFORM public._adjust_inventory(
          v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_quarantine_loc,
          v_damaged_inc, v_sti.unit_cost, 'quarantine', 'stock_transfer', v_tr.id,
          v_profile_id, 'Quarantine on transfer receive ' || v_tr.transfer_no
        );
      ELSE
        RAISE EXCEPTION 'No damaged/quarantine location for destination branch';
      END IF;
    END IF;
  END LOOP;

  SELECT bool_and(
    COALESCE(sti.quantity_received, 0) + COALESCE(sti.quantity_damaged, 0) >= sti.quantity_sent
  ) INTO v_all_complete
  FROM public.stock_transfer_items sti
  WHERE sti.transfer_id = v_tr.id AND sti.deleted_at IS NULL;

  IF v_all_complete OR finalize THEN
    UPDATE public.stock_transfers
    SET status = 'received',
        received_at = timezone('utc', now()),
        updated_by = v_profile_id
    WHERE id = v_tr.id;

  ELSE
    UPDATE public.stock_transfers
    SET status = 'partially_received',
        updated_by = v_profile_id
    WHERE id = v_tr.id;
  END IF;

  SELECT status INTO v_tr.status FROM public.stock_transfers WHERE id = v_tr.id;

  PERFORM public.write_audit_log(
    v_org_id, v_tr.to_branch_id, v_profile_id,
    'inventory.transfer.receive', 'stock_transfer', v_tr.id,
    NULL,
    jsonb_build_object('status', v_tr.status, 'items', items, 'finalize', finalize),
    NULL,
    jsonb_build_object('source', 'receive_stock_transfer')
  );

  RETURN jsonb_build_object(
    'transfer_id', v_tr.id,
    'status', v_tr.status,
    'idempotent', false,
    'finalize', finalize
  );
END;
$$;

REVOKE ALL ON FUNCTION public.receive_stock_transfer(uuid, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.receive_stock_transfer(uuid, jsonb, boolean) TO authenticated;
