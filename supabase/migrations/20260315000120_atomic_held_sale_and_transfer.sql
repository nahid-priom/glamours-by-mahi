-- Migration 120: Atomic held-sale upsert/delete + atomic stock transfer create + cancel.
-- Replaces client multi-write patterns for draft held sales and transfer drafts.

--------------------------------------------------------------------------------
-- upsert_held_sale: single-transaction header + items
-- payload: {
--   branch_id, customer_id?, salesperson_id?, hold_label?, note?,
--   subtotal, discount, tax, shipping, grand_total,
--   items: [{ variant_id, qty, unit_price, line_discount, line_total, sort_order }]
-- }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.upsert_held_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_held_id uuid;
  v_item jsonb;
  v_sort int := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('pos.create') THEN
    RAISE EXCEPTION 'Missing permission pos.create' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF payload->'items' IS NULL OR jsonb_typeof(payload->'items') <> 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'Held sale requires at least one item';
  END IF;

  INSERT INTO public.held_sales (
    organization_id, branch_id, customer_id, salesperson_id,
    hold_label, note, subtotal, discount, tax, shipping, grand_total,
    created_by, updated_by
  ) VALUES (
    v_org_id,
    v_branch_id,
    NULLIF(payload->>'customer_id', '')::uuid,
    COALESCE(NULLIF(payload->>'salesperson_id', '')::uuid, v_profile_id),
    NULLIF(payload->>'hold_label', ''),
    NULLIF(payload->>'note', ''),
    coalesce((payload->>'subtotal')::numeric, 0),
    coalesce((payload->>'discount')::numeric, 0),
    coalesce((payload->>'tax')::numeric, 0),
    coalesce((payload->>'shipping')::numeric, 0),
    coalesce((payload->>'grand_total')::numeric, 0),
    v_profile_id,
    v_profile_id
  )
  RETURNING id INTO v_held_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    INSERT INTO public.held_sale_items (
      organization_id, held_sale_id, variant_id, qty, unit_price,
      line_discount, line_total, sort_order, created_by, updated_by
    ) VALUES (
      v_org_id,
      v_held_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'qty')::numeric,
      (v_item->>'unit_price')::numeric,
      coalesce((v_item->>'line_discount')::numeric, 0),
      coalesce((v_item->>'line_total')::numeric, 0),
      coalesce((v_item->>'sort_order')::int, v_sort),
      v_profile_id,
      v_profile_id
    );
    v_sort := v_sort + 1;
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'pos.held_sale.create', 'held_sale', v_held_id,
    NULL,
    jsonb_build_object('item_count', jsonb_array_length(payload->'items')),
    NULL,
    jsonb_build_object('source', 'upsert_held_sale')
  );

  RETURN jsonb_build_object('held_sale_id', v_held_id);
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_held_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_held_sale(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- delete_held_sale: soft-delete header + items atomically
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_held_sale(p_held_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_held public.held_sales%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('pos.create') THEN
    RAISE EXCEPTION 'Missing permission pos.create' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_held
  FROM public.held_sales hs
  WHERE hs.id = p_held_sale_id
    AND hs.organization_id = v_org_id
    AND hs.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('held_sale_id', p_held_sale_id, 'idempotent', true);
  END IF;

  IF NOT public.user_has_branch_access(v_held.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  UPDATE public.held_sale_items
  SET deleted_at = v_now, updated_by = v_profile_id
  WHERE held_sale_id = v_held.id AND deleted_at IS NULL;

  UPDATE public.held_sales
  SET deleted_at = v_now, updated_by = v_profile_id
  WHERE id = v_held.id;

  RETURN jsonb_build_object('held_sale_id', v_held.id, 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_held_sale(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_held_sale(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- create_stock_transfer: draft header + items in one transaction
-- payload: {
--   from_branch_id, to_branch_id, from_location_id, to_location_id, notes?,
--   items: [{ variant_id, quantity_sent, unit_cost?, notes? }]
-- }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_stock_transfer(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_from_branch uuid;
  v_to_branch uuid;
  v_from_loc uuid;
  v_to_loc uuid;
  v_transfer_id uuid;
  v_transfer_no text;
  v_item jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Missing permission inventory.transfer' USING ERRCODE = '42501';
  END IF;

  v_from_branch := NULLIF(payload->>'from_branch_id', '')::uuid;
  v_to_branch := NULLIF(payload->>'to_branch_id', '')::uuid;
  v_from_loc := NULLIF(payload->>'from_location_id', '')::uuid;
  v_to_loc := NULLIF(payload->>'to_location_id', '')::uuid;

  IF v_from_branch IS NULL OR v_to_branch IS NULL OR v_from_loc IS NULL OR v_to_loc IS NULL THEN
    RAISE EXCEPTION 'from/to branch and location are required';
  END IF;
  IF v_from_branch = v_to_branch THEN
    RAISE EXCEPTION 'Source and destination branches must differ';
  END IF;
  IF NOT public.user_has_branch_access(v_from_branch) THEN
    RAISE EXCEPTION 'No access to source branch' USING ERRCODE = '42501';
  END IF;
  IF payload->'items' IS NULL OR jsonb_typeof(payload->'items') <> 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'Transfer requires at least one item';
  END IF;

  v_transfer_no := 'TR-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.stock_transfers (
    organization_id, transfer_no, from_branch_id, to_branch_id,
    from_location_id, to_location_id, status, notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_transfer_no, v_from_branch, v_to_branch,
    v_from_loc, v_to_loc, 'draft', NULLIF(payload->>'notes', ''),
    v_profile_id, v_profile_id
  )
  RETURNING id INTO v_transfer_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    INSERT INTO public.stock_transfer_items (
      organization_id, transfer_id, variant_id, quantity_sent, unit_cost, notes,
      created_by, updated_by
    ) VALUES (
      v_org_id,
      v_transfer_id,
      (v_item->>'variant_id')::uuid,
      (v_item->>'quantity_sent')::numeric,
      NULLIF(v_item->>'unit_cost', '')::numeric,
      NULLIF(v_item->>'notes', ''),
      v_profile_id,
      v_profile_id
    );
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, v_from_branch, v_profile_id,
    'inventory.transfer.create', 'stock_transfer', v_transfer_id,
    NULL,
    jsonb_build_object('transfer_no', v_transfer_no, 'status', 'draft'),
    NULL,
    jsonb_build_object('source', 'create_stock_transfer')
  );

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'transfer_no', v_transfer_no,
    'status', 'draft'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_stock_transfer(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_stock_transfer(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- cancel_stock_transfer: draft → soft cancel; in_transit → restore stock then cancel
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_stock_transfer(p_transfer_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_tr public.stock_transfers%ROWTYPE;
  v_item public.stock_transfer_items%ROWTYPE;
  v_prev text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('inventory.transfer') THEN
    RAISE EXCEPTION 'Missing permission inventory.transfer' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tr
  FROM public.stock_transfers st
  WHERE st.id = p_transfer_id
    AND st.organization_id = v_org_id
    AND st.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF NOT public.user_has_branch_access(v_tr.from_branch_id) THEN
    RAISE EXCEPTION 'No access to source branch' USING ERRCODE = '42501';
  END IF;

  IF v_tr.status = 'cancelled' THEN
    RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'cancelled', 'idempotent', true);
  END IF;

  IF v_tr.status IN ('received', 'partially_received') THEN
    RAISE EXCEPTION 'Cannot cancel a transfer that has been received';
  END IF;

  v_prev := v_tr.status;

  IF v_tr.status = 'in_transit' THEN
    FOR v_item IN
      SELECT * FROM public.stock_transfer_items sti
      WHERE sti.transfer_id = v_tr.id AND sti.deleted_at IS NULL
    LOOP
      -- Restore unreceived quantity to source saleable location
      PERFORM public._adjust_inventory(
        v_org_id, v_tr.from_branch_id, v_item.variant_id, v_tr.from_location_id,
        v_item.quantity_sent - coalesce(v_item.quantity_received, 0),
        v_item.unit_cost, 'transfer_in', 'stock_transfer', v_tr.id,
        v_profile_id, 'Cancel transfer ' || v_tr.transfer_no
      );
    END LOOP;
  END IF;

  UPDATE public.stock_transfers
  SET status = 'cancelled',
      notes = CASE
        WHEN NULLIF(btrim(coalesce(p_reason, '')), '') IS NULL THEN notes
        ELSE coalesce(notes || E'\n', '') || 'Cancelled: ' || btrim(p_reason)
      END,
      updated_by = v_profile_id
  WHERE id = v_tr.id;

  PERFORM public.write_audit_log(
    v_org_id, v_tr.from_branch_id, v_profile_id,
    'inventory.transfer.cancel', 'stock_transfer', v_tr.id,
    jsonb_build_object('status', v_prev),
    jsonb_build_object('status', 'cancelled', 'reason', p_reason),
    NULL,
    jsonb_build_object('source', 'cancel_stock_transfer')
  );

  RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'cancelled', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_stock_transfer(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_stock_transfer(uuid, text) TO authenticated;
