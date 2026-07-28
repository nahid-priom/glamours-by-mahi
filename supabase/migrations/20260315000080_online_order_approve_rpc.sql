-- Migration 080: Staff online order create, approve, assign; list + fulfil guards

--------------------------------------------------------------------------------
-- Preserve creator + require approval for moderator orders on fulfil
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sales_online_fulfil_attribution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'draft'
     AND NEW.status = 'completed'
     AND coalesce(OLD.channel, NEW.channel, '') IN ('ecommerce', 'online', 'moderator')
  THEN
    -- Never overwrite creator
    NEW.created_by := OLD.created_by;

    IF coalesce(OLD.order_source, NEW.order_source, '') IN ('moderator', 'tele_sales', 'manual')
       AND coalesce(OLD.fulfilment_status, '') = 'pending_approval' THEN
      RAISE EXCEPTION 'Order must be approved before fulfilment';
    END IF;

    IF NEW.fulfilled_by IS NULL THEN
      NEW.fulfilled_by := public.current_profile_id();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_online_fulfil_attribution ON public.sales;
CREATE TRIGGER sales_online_fulfil_attribution
  BEFORE UPDATE OF status ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sales_online_fulfil_attribution();

--------------------------------------------------------------------------------
-- create_staff_online_order — moderator / tele-sales / manual intake
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_staff_online_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_client_txn_key text;
  v_order_source text;
  v_phone text;
  v_name text;
  v_email text;
  v_address text;
  v_district text;
  v_notes text;
  v_shipping numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_customer_id uuid;
  v_location_id uuid;
  v_existing public.sales%ROWTYPE;
  v_sale_id uuid;
  v_invoice_no text;
  v_seq bigint;
  v_item jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_grand_total numeric(14, 2);
  v_expires_at timestamptz;
  v_sale_item_id uuid;
  v_unit_override numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('moderator.order.create')
    OR public.user_has_permission('orders.fulfil')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to create staff online orders' USING ERRCODE = '42501';
  END IF;

  v_branch_id := coalesce(
    NULLIF(payload->>'branch_id', '')::uuid,
    (SELECT default_branch_id FROM public.profiles WHERE id = v_profile_id)
  );
  IF v_branch_id IS NULL OR NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'Valid branch_id is required';
  END IF;

  v_client_txn_key := NULLIF(btrim(coalesce(payload->>'client_txn_key', '')), '');
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required';
  END IF;

  v_order_source := lower(coalesce(NULLIF(payload->>'order_source', ''), 'moderator'));
  IF v_order_source NOT IN ('moderator', 'tele_sales', 'manual', 'other') THEN
    RAISE EXCEPTION 'Invalid order_source';
  END IF;

  v_phone := NULLIF(btrim(coalesce(payload->>'phone', payload->>'customer_phone', '')), '');
  v_name := NULLIF(btrim(coalesce(payload->>'customer_name', payload->>'name', '')), '');
  IF v_phone IS NULL OR v_name IS NULL THEN
    RAISE EXCEPTION 'customer_name and phone are required';
  END IF;
  v_email := NULLIF(btrim(coalesce(payload->>'email', '')), '');
  v_address := NULLIF(btrim(coalesce(payload->>'address', payload->>'delivery_address', '')), '');
  v_district := NULLIF(btrim(coalesce(payload->>'district', '')), '');
  v_notes := NULLIF(btrim(coalesce(payload->>'notes', payload->>'note', '')), '');
  v_shipping := coalesce((payload->>'shipping')::numeric, (payload->>'delivery_charge')::numeric, 0);
  v_discount := coalesce((payload->>'discount')::numeric, 0);
  IF v_shipping < 0 OR v_discount < 0 THEN
    RAISE EXCEPTION 'shipping/discount cannot be negative';
  END IF;
  IF v_discount > 0 AND NOT (
    public.user_has_permission('pos.discount')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing discount permission' USING ERRCODE = '42501';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  SELECT * INTO v_existing
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sale_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'idempotent', true,
      'fulfilment_status', v_existing.fulfilment_status,
      'order_source', v_existing.order_source
    );
  END IF;

  v_customer_id := NULLIF(payload->>'customer_id', '')::uuid;
  IF v_customer_id IS NULL THEN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.organization_id = v_org_id
      AND c.phone = v_phone
      AND c.deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_customer_id IS NULL THEN
    IF NOT public.user_has_permission('customers.manage') THEN
      RAISE EXCEPTION 'Missing permission to create customers' USING ERRCODE = '42501';
    END IF;
    INSERT INTO public.customers (
      organization_id, branch_id, name, phone, email, address, district,
      preferred_channel, status, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_name, v_phone, v_email, v_address, v_district,
      v_order_source, 'active', v_profile_id, v_profile_id
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = coalesce(NULLIF(name, ''), v_name),
        email = coalesce(v_email, email),
        address = coalesce(v_address, address),
        district = coalesce(v_district, district),
        updated_by = v_profile_id
    WHERE id = v_customer_id
      AND organization_id = v_org_id;
  END IF;

  v_location_id := public._saleable_location(v_org_id, v_branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := coalesce((v_item->>'qty')::numeric, (v_item->>'quantity')::numeric);
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item qty';
    END IF;
    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL
      AND pv.is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found or inactive: %', v_item->>'variant_id';
    END IF;
    v_unit_override := NULLIF(v_item->>'unit_price', '')::numeric;
    v_unit_price := coalesce(v_unit_override, v_variant.selling_price);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
  END LOOP;

  v_grand_total := round(v_subtotal - v_discount + v_shipping, 2);
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'grand_total cannot be negative';
  END IF;
  v_expires_at := timezone('utc', now()) + interval '48 hours';

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':web_invoice'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.invoice_no ILIKE 'WEB-%';
  v_invoice_no := 'WEB-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.sales (
    organization_id, branch_id, invoice_no, customer_id,
    status, payment_status, channel, order_source,
    moderator_id, tele_salesman_id,
    subtotal, discount, tax, shipping, grand_total,
    paid_total, due_total, change_amount, client_txn_key,
    fulfilment_status, delivery_address, delivery_district,
    reservation_expires_at, note, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_invoice_no, v_customer_id,
    'draft', 'unpaid', 'online', v_order_source,
    CASE WHEN v_order_source = 'moderator' THEN v_profile_id ELSE NULLIF(payload->>'moderator_id', '')::uuid END,
    CASE WHEN v_order_source = 'tele_sales' THEN v_profile_id ELSE NULLIF(payload->>'tele_salesman_id', '')::uuid END,
    v_subtotal, v_discount, 0, v_shipping, v_grand_total,
    0, v_grand_total, 0, v_client_txn_key,
    'pending_approval', v_address, v_district,
    v_expires_at, v_notes, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := coalesce((v_item->>'qty')::numeric, (v_item->>'quantity')::numeric);
    SELECT * INTO v_variant FROM public.product_variants WHERE id = (v_item->>'variant_id')::uuid;
    v_unit_price := coalesce(NULLIF(v_item->>'unit_price', '')::numeric, v_variant.selling_price);
    v_line_total := round(v_qty * v_unit_price, 2);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, created_by, updated_by
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      0, v_line_total, v_profile_id, v_profile_id
    )
    RETURNING id INTO v_sale_item_id;

    PERFORM public._reserve_inventory(
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      v_qty, v_sale_id, v_sale_item_id, v_profile_id, v_expires_at,
      v_client_txn_key || ':' || v_sale_item_id::text
    );
  END LOOP;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'online_order.create_staff', 'sale', v_sale_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'order_source', v_order_source,
      'grand_total', v_grand_total
    ),
    NULL,
    jsonb_build_object('source', 'create_staff_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'customer_id', v_customer_id,
    'grand_total', v_grand_total,
    'fulfilment_status', 'pending_approval',
    'order_source', v_order_source,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_online_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale_id uuid;
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.approve')
    OR public.user_has_permission('orders.fulfil')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to approve online orders' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = v_sale_id AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft orders can be approved';
  END IF;
  IF coalesce(v_sale.fulfilment_status, '') = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be approved';
  END IF;
  IF coalesce(v_sale.fulfilment_status, '') = 'approved' AND v_sale.approved_by IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sale_id', v_sale.id,
      'idempotent', true,
      'approved_by', v_sale.approved_by,
      'approved_at', v_sale.approved_at
    );
  END IF;

  UPDATE public.sales
  SET fulfilment_status = 'approved',
      approved_by = v_profile_id,
      approved_at = timezone('utc', now()),
      updated_by = v_profile_id
      -- created_by intentionally unchanged
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.approve', 'sale', v_sale.id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_sale.invoice_no,
      'created_by', v_sale.created_by,
      'approved_by', v_profile_id
    ),
    NULL,
    jsonb_build_object('source', 'approve_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'invoice_no', v_sale.invoice_no,
    'fulfilment_status', v_sale.fulfilment_status,
    'approved_by', v_sale.approved_by,
    'approved_at', v_sale.approved_at,
    'created_by', v_sale.created_by,
    'idempotent', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_online_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale_id uuid;
  v_assignee uuid;
  v_sale public.sales%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.assign')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to assign online orders' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_assignee := NULLIF(payload->>'tele_salesman_id', '')::uuid;
  IF v_sale_id IS NULL OR v_assignee IS NULL THEN
    RAISE EXCEPTION 'sale_id and tele_salesman_id are required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = v_sale_id AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  UPDATE public.sales
  SET tele_salesman_id = v_assignee,
      updated_by = v_profile_id
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.assign', 'sale', v_sale.id,
    NULL,
    jsonb_build_object('tele_salesman_id', v_assignee),
    NULL,
    jsonb_build_object('source', 'assign_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'tele_salesman_id', v_sale.tele_salesman_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_online_orders(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_status text;
  v_source text;
  v_limit int;
  v_own_only boolean := false;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.read')
    OR public.user_has_permission('sales.read')
    OR public.user_has_permission('moderator.order.read_own')
  ) THEN
    RAISE EXCEPTION 'Missing permission to list online orders' USING ERRCODE = '42501';
  END IF;

  v_status := NULLIF(payload->>'status', '');
  v_source := NULLIF(payload->>'order_source', '');
  v_limit := least(coalesce((payload->>'limit')::int, 100), 500);

  IF public.user_has_permission('moderator.order.read_own')
     AND NOT public.user_has_permission('orders.read')
     AND NOT public.user_has_permission('sales.read') THEN
    v_own_only := true;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(q)::jsonb ORDER BY q.created_at DESC)
    FROM (
      SELECT
        s.id, s.invoice_no, s.status, s.fulfilment_status, s.channel,
        s.order_source, s.moderator_id, s.tele_salesman_id,
        s.approved_by, s.approved_at, s.fulfilled_by, s.created_by,
        s.grand_total, s.due_total, s.paid_total,
        s.delivery_address, s.delivery_district,
        s.reservation_expires_at, s.completed_at, s.created_at,
        s.public_share_token, s.customer_id,
        c.name AS customer_name, c.phone AS customer_phone
      FROM public.sales s
      LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE s.organization_id = v_org_id
        AND s.deleted_at IS NULL
        AND (
          coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
          OR coalesce(s.order_source, '') IN ('ecommerce', 'moderator', 'tele_sales', 'manual', 'other')
        )
        AND (v_status IS NULL OR s.fulfilment_status = v_status OR s.status = v_status)
        AND (v_source IS NULL OR s.order_source = v_source)
        AND (
          NOT v_own_only
          OR s.created_by = v_profile_id
          OR s.moderator_id = v_profile_id
        )
        AND (
          NOT public.user_has_permission('orders.read')
          OR s.tele_salesman_id IS NULL
          OR s.tele_salesman_id = v_profile_id
          OR public.user_has_permission('orders.assign')
          OR public.user_has_permission('accounts.manage')
          OR public.user_has_permission('orders.fulfil')
        )
      ORDER BY s.created_at DESC
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);
END;
$$;

-- Also set order_source on public place_online_order inserts via trigger
CREATE OR REPLACE FUNCTION public.trg_sales_default_order_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.order_source IS NULL THEN
    IF lower(coalesce(NEW.channel, '')) IN ('ecommerce', 'online', 'website') THEN
      NEW.order_source := 'ecommerce';
    ELSIF NEW.channel IS NULL AND NEW.status = 'completed' THEN
      NEW.order_source := 'pos';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_default_order_source ON public.sales;
CREATE TRIGGER sales_default_order_source
  BEFORE INSERT ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sales_default_order_source();

GRANT EXECUTE ON FUNCTION public.create_staff_online_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_online_order(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_online_order(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.list_online_orders(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_online_orders(jsonb) TO authenticated;
