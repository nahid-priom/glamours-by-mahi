-- Fix inventory ledger idempotency, short-receive stock loss, opening/transfer
-- collisions, valuation zero balances, and product list summary filters.

--------------------------------------------------------------------------------
-- 1. Durable ledger idempotency key
--------------------------------------------------------------------------------
ALTER TABLE public.stock_ledger
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS stock_ledger_org_idempotency_uidx
  ON public.stock_ledger (organization_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL;

--------------------------------------------------------------------------------
-- 2. _adjust_inventory — prefer explicit idempotency_key; keep WAC engine
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public._adjust_inventory(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text
);

CREATE OR REPLACE FUNCTION public._adjust_inventory(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty_delta numeric,
  p_unit_cost numeric,
  p_movement_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid,
  p_notes text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_avg_before numeric(14, 2);
  v_avg_after numeric(14, 2);
  v_ledger_unit_cost numeric(14, 2);
  v_ledger_total_cost numeric(14, 2);
  v_incoming_cost numeric(14, 2);
  v_key text := NULLIF(btrim(coalesce(p_idempotency_key, '')), '');
  v_allowed text[] := ARRAY[
    'opening', 'purchase', 'purchase_return', 'sale', 'sale_return',
    'adjustment', 'transfer_out', 'transfer_in', 'damage', 'quarantine', 'correction'
  ];
BEGIN
  IF p_org_id IS NULL OR p_variant_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'organization, variant and location are required';
  END IF;
  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RAISE EXCEPTION 'quantity delta must be non-zero';
  END IF;
  IF p_movement_type IS NULL OR NOT (p_movement_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid inventory movement_type: %', p_movement_type;
  END IF;

  IF v_key IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.stock_ledger sl
      WHERE sl.organization_id = p_org_id
        AND sl.idempotency_key = v_key
        AND sl.deleted_at IS NULL
    ) THEN
      RETURN;
    END IF;
  ELSIF p_reference_id IS NOT NULL AND EXISTS (
    -- Legacy one-shot guard (sales etc.). Prefer p_idempotency_key for multi-post refs.
    SELECT 1 FROM public.stock_ledger sl
    WHERE sl.organization_id = p_org_id
      AND sl.variant_id = p_variant_id
      AND sl.location_id = p_location_id
      AND sl.reference_type = p_reference_type
      AND sl.reference_id = p_reference_id
      AND sl.movement_type = p_movement_type
      AND sl.quantity_delta = p_qty_delta
      AND sl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_bal := public._ensure_inventory_balance(p_org_id, p_variant_id, p_location_id, p_actor);
  v_before := v_bal.quantity;
  v_after := v_before + p_qty_delta;
  v_avg_before := COALESCE(v_bal.average_unit_cost, 0);
  v_incoming_cost := COALESCE(p_unit_cost, 0);

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for variant % (have %, delta %)',
      p_variant_id, v_before, p_qty_delta;
  END IF;

  IF COALESCE(v_bal.qty_reserved, 0) > v_after THEN
    RAISE EXCEPTION 'Reserved quantity (%) exceeds resulting on-hand (%) for variant %',
      v_bal.qty_reserved, v_after, p_variant_id;
  END IF;

  IF p_qty_delta > 0 THEN
    IF v_before <= 0 THEN
      v_avg_after := v_incoming_cost;
    ELSE
      v_avg_after := round(
        (v_before * v_avg_before + p_qty_delta * v_incoming_cost)
        / NULLIF(v_before + p_qty_delta, 0),
        2
      );
    END IF;
    v_ledger_unit_cost := v_incoming_cost;
  ELSE
    v_ledger_unit_cost := v_avg_before;
    v_avg_after := CASE WHEN v_after = 0 THEN 0 ELSE v_avg_before END;
  END IF;

  v_ledger_total_cost := round(v_ledger_unit_cost * p_qty_delta, 2);

  UPDATE public.inventory_balances
  SET quantity = v_after,
      average_unit_cost = COALESCE(v_avg_after, 0),
      cost_is_fallback = CASE
        WHEN p_qty_delta > 0 AND v_incoming_cost = 0 THEN true
        ELSE cost_is_fallback
      END,
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = v_bal.id;

  INSERT INTO public.stock_ledger (
    organization_id, branch_id, variant_id, location_id,
    quantity_delta, quantity_before, quantity_after,
    unit_cost, total_cost,
    movement_type, reference_type, reference_id, notes,
    idempotency_key, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_variant_id, p_location_id,
    p_qty_delta, v_before, v_after,
    v_ledger_unit_cost, v_ledger_total_cost,
    p_movement_type, p_reference_type, p_reference_id, p_notes,
    v_key, p_actor, p_actor
  );
END;
$$;

REVOKE ALL ON FUNCTION public._adjust_inventory(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._adjust_inventory(
  uuid, uuid, uuid, uuid, numeric, numeric, text, text, uuid, uuid, text, text
) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- 3. Valuation: include zero-qty balances (out-of-stock KPIs)
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_inventory_valuation_balances
WITH (security_invoker = true)
AS
SELECT
  ib.id AS balance_id,
  ib.organization_id,
  ib.variant_id,
  ib.location_id,
  ib.quantity,
  COALESCE(ib.qty_reserved, 0) AS qty_reserved,
  GREATEST(ib.quantity - COALESCE(ib.qty_reserved, 0), 0) AS available_quantity,
  ib.average_unit_cost,
  ib.cost_is_fallback,
  sl.branch_id,
  sl.location_type,
  sl.name AS location_name,
  b.name AS branch_name,
  b.code AS branch_code,
  b.is_central AS is_head_office,
  pv.product_id,
  pv.sku,
  pv.barcode,
  pv.name AS variant_name,
  pv.selling_price AS variant_selling_price,
  p.name AS product_name,
  p.base_sku AS product_code,
  p.product_type,
  p.reorder_level AS product_reorder_level,
  p.category_id,
  p.brand_id,
  p.track_inventory,
  c.name AS category_name,
  br.name AS brand_name
FROM public.inventory_balances ib
JOIN public.stock_locations sl
  ON sl.id = ib.location_id AND sl.deleted_at IS NULL AND sl.is_active = true
JOIN public.branches b
  ON b.id = sl.branch_id AND b.deleted_at IS NULL AND b.is_active = true
JOIN public.product_variants pv
  ON pv.id = ib.variant_id AND pv.deleted_at IS NULL AND pv.is_active = true
JOIN public.products p
  ON p.id = pv.product_id AND p.deleted_at IS NULL
LEFT JOIN public.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
LEFT JOIN public.brands br ON br.id = p.brand_id AND br.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
  AND p.organization_id = ib.organization_id;

--------------------------------------------------------------------------------
-- 4. create_opening_stock — unique idempotency (no silent skip)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_opening_stock(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org_id uuid;
  v_branch_id uuid;
  v_location_id uuid;
  v_variant_id uuid;
  v_product_id uuid;
  v_qty numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_batch_number text;
  v_manufactured date;
  v_expires date;
  v_product public.products%ROWTYPE;
  v_batch_id uuid;
  v_ref text;
  v_opening_id uuid := gen_random_uuid();
  v_client_key text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_org_id := public.current_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization';
  END IF;

  IF NOT (
    public.user_has_permission('inventory.adjust')
    OR public.user_has_permission('products.create')
    OR public.user_has_permission('products.update')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  v_branch_id := (payload->>'branch_id')::uuid;
  v_location_id := NULLIF(payload->>'location_id', '')::uuid;
  v_variant_id := (payload->>'variant_id')::uuid;
  v_qty := COALESCE((payload->>'quantity')::numeric, 0);
  v_unit_cost := COALESCE((payload->>'unit_cost')::numeric, 0);
  v_batch_number := NULLIF(trim(payload->>'batch_number'), '');
  v_manufactured := NULLIF(payload->>'manufactured_at', '')::date;
  v_expires := NULLIF(payload->>'expires_at', '')::date;
  v_ref := COALESCE(payload->>'reference', 'opening');
  v_client_key := NULLIF(btrim(coalesce(payload->>'client_txn_key', '')), '');
  IF v_client_key IS NULL THEN
    v_client_key := 'opening:' || v_opening_id::text;
  END IF;

  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'Opening stock quantity must be > 0';
  END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No branch access';
  END IF;

  SELECT p.* INTO v_product
  FROM public.product_variants pv
  JOIN public.products p ON p.id = pv.product_id
  WHERE pv.id = v_variant_id AND pv.organization_id = v_org_id AND pv.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Variant not found';
  END IF;

  v_product_id := v_product.id;

  IF v_location_id IS NULL THEN
    SELECT sl.id INTO v_location_id
    FROM public.stock_locations sl
    WHERE sl.branch_id = v_branch_id
      AND sl.location_type = 'saleable'
      AND sl.is_active = true
      AND sl.deleted_at IS NULL
    ORDER BY sl.is_default DESC NULLS LAST, sl.name
    LIMIT 1;
  END IF;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  IF v_product.batch_tracking_enabled OR v_product.expiry_tracking_enabled THEN
    IF v_batch_number IS NULL THEN
      v_batch_number := 'OPEN-' || to_char(timezone('utc', now()), 'YYYYMMDDHH24MISS');
    END IF;
    IF v_product.expiry_tracking_enabled AND v_expires IS NULL THEN
      RAISE EXCEPTION 'Expiry date required for expiry-tracked products';
    END IF;
    IF v_manufactured IS NOT NULL AND v_expires IS NOT NULL AND v_expires < v_manufactured THEN
      RAISE EXCEPTION 'Expiry date cannot be before manufacturing date';
    END IF;

    INSERT INTO public.inventory_batches (
      organization_id, branch_id, location_id, product_id, variant_id,
      batch_number, manufactured_at, expires_at, quantity_received, quantity_available,
      unit_cost, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_location_id, v_product_id, v_variant_id,
      v_batch_number, v_manufactured, v_expires, v_qty, v_qty,
      v_unit_cost, v_actor, v_actor
    )
    RETURNING id INTO v_batch_id;

    PERFORM public.refresh_batch_status(v_batch_id);
  END IF;

  PERFORM public._adjust_inventory(
    v_org_id, v_branch_id, v_variant_id, v_location_id,
    v_qty, v_unit_cost, 'opening', 'opening_stock', COALESCE(v_batch_id, v_opening_id),
    v_actor, v_ref, v_client_key
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_actor, 'opening_stock.create', 'product_variant', v_variant_id,
    NULL,
    jsonb_build_object(
      'quantity', v_qty,
      'branch_id', v_branch_id,
      'batch_id', v_batch_id,
      'unit_cost', v_unit_cost,
      'client_txn_key', v_client_key
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'variant_id', v_variant_id,
    'batch_id', v_batch_id,
    'quantity', v_qty,
    'client_txn_key', v_client_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_opening_stock(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 5. create_stock_transfer — reject duplicate variant lines
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
  v_variant_ids uuid[] := ARRAY[]::uuid[];
  v_vid uuid;
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

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_vid := (v_item->>'variant_id')::uuid;
    IF v_vid IS NULL THEN
      RAISE EXCEPTION 'Each transfer line requires variant_id';
    END IF;
    IF v_vid = ANY (v_variant_ids) THEN
      RAISE EXCEPTION 'Duplicate variant on transfer lines is not allowed; combine quantities instead';
    END IF;
    v_variant_ids := array_append(v_variant_ids, v_vid);
  END LOOP;

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
-- 6. dispatch_stock_transfer — per-item idempotency keys
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dispatch_stock_transfer(transfer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_tr public.stock_transfers%ROWTYPE;
  v_item public.stock_transfer_items%ROWTYPE;
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

  IF NOT public.user_has_branch_access(v_tr.from_branch_id) THEN
    RAISE EXCEPTION 'No access to source branch' USING ERRCODE = '42501';
  END IF;

  IF v_tr.status = 'in_transit' THEN
    RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'in_transit', 'idempotent', true);
  END IF;

  IF v_tr.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft transfers can be dispatched';
  END IF;

  FOR v_item IN
    SELECT * FROM public.stock_transfer_items sti
    WHERE sti.transfer_id = v_tr.id AND sti.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_tr.from_branch_id, v_item.variant_id, v_tr.from_location_id,
      -v_item.quantity_sent, v_item.unit_cost, 'transfer_out', 'stock_transfer', v_tr.id,
      v_profile_id, 'Dispatch transfer ' || v_tr.transfer_no,
      'xfer:' || v_tr.id::text || ':dispatch:' || v_item.id::text
    );
  END LOOP;

  UPDATE public.stock_transfers
  SET status = 'in_transit',
      shipped_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_tr.id;

  PERFORM public.write_audit_log(
    v_org_id, v_tr.from_branch_id, v_profile_id,
    'inventory.transfer.dispatch', 'stock_transfer', v_tr.id,
    jsonb_build_object('status', 'draft'),
    jsonb_build_object('status', 'in_transit'),
    NULL,
    jsonb_build_object('source', 'dispatch_stock_transfer')
  );

  RETURN jsonb_build_object('transfer_id', v_tr.id, 'status', 'in_transit', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.dispatch_stock_transfer(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_stock_transfer(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 7. receive_stock_transfer — unique receive keys + restore shortfall on finalize
--------------------------------------------------------------------------------
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
  v_shortfall numeric(14, 3);
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

  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array';
  END IF;
  -- Allow empty items only when finalizing a short receive (restore shortfall, no new posts).
  IF jsonb_array_length(items) < 1 AND NOT finalize THEN
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
        v_profile_id, 'Receive transfer ' || v_tr.transfer_no,
        'xfer:' || v_tr.id::text || ':recv:' || v_sti.id::text || ':' || v_new_received::text
      );
    END IF;

    IF v_damaged_inc > 0 THEN
      IF v_condition IN ('damaged', 'sellable') AND v_damaged_loc IS NOT NULL THEN
        PERFORM public._adjust_inventory(
          v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_damaged_loc,
          v_damaged_inc, v_sti.unit_cost, 'damage', 'stock_transfer', v_tr.id,
          v_profile_id, 'Damaged on transfer receive ' || v_tr.transfer_no,
          'xfer:' || v_tr.id::text || ':dmg:' || v_sti.id::text || ':' || v_new_damaged::text
        );
      ELSIF v_quarantine_loc IS NOT NULL THEN
        PERFORM public._adjust_inventory(
          v_org_id, v_tr.to_branch_id, v_sti.variant_id, v_quarantine_loc,
          v_damaged_inc, v_sti.unit_cost, 'quarantine', 'stock_transfer', v_tr.id,
          v_profile_id, 'Quarantine on transfer receive ' || v_tr.transfer_no,
          'xfer:' || v_tr.id::text || ':qtn:' || v_sti.id::text || ':' || v_new_damaged::text
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
    -- Short-receive finalize: restore unreceived remainder to source
    IF finalize AND NOT v_all_complete THEN
      FOR v_sti IN
        SELECT * FROM public.stock_transfer_items sti
        WHERE sti.transfer_id = v_tr.id AND sti.deleted_at IS NULL
      LOOP
        v_shortfall := v_sti.quantity_sent
          - COALESCE(v_sti.quantity_received, 0)
          - COALESCE(v_sti.quantity_damaged, 0);
        IF v_shortfall > 0 THEN
          PERFORM public._adjust_inventory(
            v_org_id, v_tr.from_branch_id, v_sti.variant_id, v_tr.from_location_id,
            v_shortfall, v_sti.unit_cost, 'transfer_in', 'stock_transfer', v_tr.id,
            v_profile_id, 'Short-receive restore ' || v_tr.transfer_no,
            'xfer:' || v_tr.id::text || ':shortfall:' || v_sti.id::text
          );
        END IF;
      END LOOP;
    END IF;

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

--------------------------------------------------------------------------------
-- 8. cancel_stock_transfer — restore shortfall with unique keys
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
  v_restore numeric(14, 3);
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
      v_restore := v_item.quantity_sent
        - coalesce(v_item.quantity_received, 0)
        - coalesce(v_item.quantity_damaged, 0);
      IF v_restore > 0 THEN
        PERFORM public._adjust_inventory(
          v_org_id, v_tr.from_branch_id, v_item.variant_id, v_tr.from_location_id,
          v_restore, v_item.unit_cost, 'transfer_in', 'stock_transfer', v_tr.id,
          v_profile_id, 'Cancel transfer ' || v_tr.transfer_no,
          'xfer:' || v_tr.id::text || ':cancel:' || v_item.id::text
        );
      END IF;
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

--------------------------------------------------------------------------------
-- 9. list_products_with_inventory_summary — brand / uncategorized / expiring / fields
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_products_with_inventory_summary(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_search text := nullif(btrim(payload->>'search'), '');
  v_category_raw text := nullif(btrim(payload->>'category_id'), '');
  v_uncategorized boolean := v_category_raw = '__uncategorized__';
  v_category uuid := CASE
    WHEN v_category_raw IS NULL OR v_uncategorized THEN NULL
    ELSE v_category_raw::uuid
  END;
  v_brand uuid := NULLIF(payload->>'brand_id', '')::uuid;
  v_status text := nullif(btrim(payload->>'status'), '');
  v_stock_status text := lower(nullif(btrim(payload->>'stock_status'), ''));
  v_page int := greatest(coalesce((payload->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((payload->>'page_size')::int, 24), 1), 100);
  v_offset int := (v_page - 1) * v_page_size;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('products.read') THEN
    RAISE EXCEPTION 'Missing permission products.read' USING ERRCODE = '42501';
  END IF;

  IF v_branch IS NOT NULL AND NOT public.user_has_branch_access(v_branch) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  WITH stock AS (
    SELECT
      pv.product_id,
      count(DISTINCT pv.id) FILTER (WHERE pv.deleted_at IS NULL) AS variant_count,
      coalesce(sum(ib.quantity), 0) AS total_stock,
      coalesce(sum(ib.quantity * coalesce(pv.purchase_price, 0)), 0) AS stock_cost,
      coalesce(sum(ib.quantity * coalesce(pv.selling_price, 0)), 0) AS stock_value
    FROM public.product_variants pv
    LEFT JOIN public.inventory_balances ib
      ON ib.variant_id = pv.id
     AND ib.organization_id = v_org
     AND ib.deleted_at IS NULL
    LEFT JOIN public.stock_locations sl ON sl.id = ib.location_id
    WHERE pv.organization_id = v_org
      AND pv.deleted_at IS NULL
      AND (v_branch IS NULL OR sl.branch_id = v_branch OR sl.branch_id IS NULL)
    GROUP BY pv.product_id
  ),
  filtered AS (
    SELECT
      p.id,
      p.name,
      p.base_sku,
      p.base_barcode,
      p.status,
      p.reorder_level,
      p.is_active,
      p.category_id,
      p.brand_id,
      p.product_type,
      p.unit,
      p.purchase_price,
      p.selling_price,
      p.created_at,
      c.name AS category_name,
      b.name AS brand_name,
      coalesce(st.variant_count, 0) AS variant_count,
      coalesce(st.total_stock, 0) AS total_stock,
      coalesce(st.stock_cost, 0) AS stock_cost,
      coalesce(st.stock_value, 0) AS stock_value,
      CASE
        WHEN coalesce(st.total_stock, 0) <= 0 THEN 'out_of_stock'
        WHEN p.reorder_level > 0 AND coalesce(st.total_stock, 0) <= p.reorder_level THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      (
        SELECT pi.storage_path
        FROM public.product_images pi
        WHERE pi.product_id = p.id AND pi.deleted_at IS NULL
        ORDER BY pi.is_cover DESC, pi.sort_order ASC
        LIMIT 1
      ) AS cover_path
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN public.brands b ON b.id = p.brand_id
    LEFT JOIN stock st ON st.product_id = p.id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND (
        v_search IS NULL
        OR p.name ILIKE '%' || v_search || '%'
        OR p.base_sku ILIKE '%' || v_search || '%'
        OR p.base_barcode ILIKE '%' || v_search || '%'
      )
      AND (
        (v_uncategorized AND p.category_id IS NULL)
        OR (NOT v_uncategorized AND (v_category IS NULL OR p.category_id = v_category))
      )
      AND (v_brand IS NULL OR p.brand_id = v_brand)
      AND (v_status IS NULL OR p.status::text = v_status)
      AND (
        v_stock_status IS NULL
        OR (v_stock_status = 'out_of_stock' AND coalesce(st.total_stock, 0) <= 0)
        OR (v_stock_status = 'low_stock' AND coalesce(st.total_stock, 0) > 0
            AND p.reorder_level > 0 AND coalesce(st.total_stock, 0) <= p.reorder_level)
        OR (v_stock_status = 'in_stock' AND coalesce(st.total_stock, 0) > coalesce(p.reorder_level, 0))
        OR (
          v_stock_status = 'expiring_soon'
          AND EXISTS (
            SELECT 1 FROM public.expiry_alerts ea
            WHERE ea.product_id = p.id
              AND ea.organization_id = v_org
              AND ea.is_read = false
          )
        )
      )
  )
  SELECT count(*) INTO v_total FROM filtered;

  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT * FROM filtered
    ORDER BY name
    OFFSET v_offset
    LIMIT v_page_size
  ) f;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_products_with_inventory_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_products_with_inventory_summary(jsonb) TO authenticated, service_role;
