-- Migration 109: Line-level sales generation + split commission architecture
-- Moderator intake lines → moderator commission
-- Tele Sales add / qty-increase lines at approval → tele sales commission
-- Who generates each line owns that line's commission.

--------------------------------------------------------------------------------
-- 1) sale_items attribution columns
--------------------------------------------------------------------------------
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS contributor_profile_id uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS contributor_employee_id uuid REFERENCES public.employees (id),
  ADD COLUMN IF NOT EXISTS line_origin text,
  ADD COLUMN IF NOT EXISTS parent_sale_item_id uuid REFERENCES public.sale_items (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sale_items_line_origin_chk'
  ) THEN
    ALTER TABLE public.sale_items
      ADD CONSTRAINT sale_items_line_origin_chk
      CHECK (
        line_origin IS NULL
        OR line_origin IN (
          'intake', 'approval_add', 'approval_increase', 'pos', 'ecommerce', 'manual', 'other'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sale_items_contributor_profile_idx
  ON public.sale_items (contributor_profile_id)
  WHERE deleted_at IS NULL AND contributor_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sale_items_sale_contributor_idx
  ON public.sale_items (sale_id, contributor_profile_id)
  WHERE deleted_at IS NULL;

-- Backfill: generator is created_by, else sale moderator/creator
UPDATE public.sale_items si
SET contributor_profile_id = coalesce(
      si.contributor_profile_id,
      si.created_by,
      s.moderator_id,
      s.created_by,
      s.tele_salesman_id,
      s.salesperson_id
    ),
    line_origin = coalesce(
      nullif(si.line_origin, ''),
      CASE
        WHEN coalesce(s.channel, '') = 'ecommerce' THEN 'ecommerce'
        WHEN coalesce(s.channel, '') = 'pos' THEN 'pos'
        WHEN coalesce(s.order_source, '') = 'tele_sales' THEN 'intake'
        WHEN coalesce(s.order_source, '') = 'moderator' THEN 'intake'
        ELSE 'intake'
      END
    )
FROM public.sales s
WHERE s.id = si.sale_id
  AND si.deleted_at IS NULL
  AND (si.contributor_profile_id IS NULL OR si.line_origin IS NULL);

--------------------------------------------------------------------------------
-- Default contributor on insert (POS / ecommerce / staff)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sale_items_default_contributor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.contributor_profile_id IS NULL THEN
    NEW.contributor_profile_id := NEW.created_by;
  END IF;
  IF NEW.line_origin IS NULL OR btrim(NEW.line_origin) = '' THEN
    NEW.line_origin := 'intake';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_items_default_contributor ON public.sale_items;
CREATE TRIGGER sale_items_default_contributor
  BEFORE INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sale_items_default_contributor();

--------------------------------------------------------------------------------
-- Staff match helpers (line contribution OR sale-level attribution)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_matches_sale(p_sale public.sales, p_staff uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_staff IS NOT NULL
    AND (
      public.sale_attributed_staff_id(p_sale) = p_staff
      OR p_sale.moderator_id = p_staff
      OR p_sale.tele_salesman_id = p_staff
      OR p_sale.salesperson_id = p_staff
      OR p_sale.created_by = p_staff
      OR EXISTS (
        SELECT 1
        FROM public.sale_items si
        WHERE si.sale_id = p_sale.id
          AND si.deleted_at IS NULL
          AND coalesce(si.contributor_profile_id, si.created_by) = p_staff
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.staff_line_contribution_total(
  p_org_id uuid,
  p_staff uuid,
  p_branch_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(sum(si.line_total), 0)
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE s.organization_id = p_org_id
    AND s.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND coalesce(si.contributor_profile_id, si.created_by) = p_staff
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    AND (p_from IS NULL OR s.created_at >= p_from)
    AND (p_to IS NULL OR s.created_at <= p_to)
    AND coalesce(s.fulfilment_status, '') <> 'cancelled'
    AND coalesce(s.status, '') NOT IN ('voided', 'cancelled');
$$;

--------------------------------------------------------------------------------
-- Recompute sale money fields from active lines
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._recompute_online_sale_totals(p_sale_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_subtotal numeric(14, 2);
  v_discount numeric(14, 2);
  v_shipping numeric(14, 2);
  v_grand numeric(14, 2);
  v_paid numeric(14, 2);
BEGIN
  SELECT coalesce(sum(si.line_total), 0)
  INTO v_subtotal
  FROM public.sale_items si
  WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL;

  SELECT coalesce(discount, 0), coalesce(shipping, 0), coalesce(paid_total, 0)
  INTO v_discount, v_shipping, v_paid
  FROM public.sales
  WHERE id = p_sale_id;

  v_grand := round(v_subtotal - v_discount + v_shipping, 2);
  IF v_grand < 0 THEN
    RAISE EXCEPTION 'grand_total cannot be negative';
  END IF;

  UPDATE public.sales
  SET subtotal = v_subtotal,
      grand_total = v_grand,
      due_total = greatest(v_grand - v_paid, 0),
      updated_at = timezone('utc', now())
  WHERE id = p_sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public._recompute_online_sale_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._recompute_online_sale_totals(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Append attributed lines (shared by approve / amend)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._append_attributed_online_lines(
  p_sale public.sales,
  p_actor uuid,
  p_org_id uuid,
  p_items jsonb,
  p_line_origin text,
  p_parent_sale_item_id uuid DEFAULT NULL
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_sale_item_id uuid;
  v_location_id uuid;
  v_expires_at timestamptz;
  v_count int := 0;
  v_cost numeric(14, 2);
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RETURN 0;
  END IF;

  v_location_id := public._saleable_location(p_org_id, p_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  v_expires_at := coalesce(
    p_sale.reservation_expires_at,
    timezone('utc', now()) + interval '48 hours'
  );

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_qty := coalesce((v_item->>'qty')::numeric, (v_item->>'quantity')::numeric, (v_item->>'add_qty')::numeric);
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item qty';
    END IF;

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = p_org_id
      AND pv.deleted_at IS NULL
      AND pv.is_active = true
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found or inactive: %', v_item->>'variant_id';
    END IF;

    v_unit_price := coalesce(
      NULLIF(v_item->>'unit_price', '')::numeric,
      v_variant.selling_price
    );
    v_line_total := round(v_qty * v_unit_price, 2);
    v_cost := coalesce(v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price,
      created_by, updated_by,
      contributor_profile_id, line_origin, parent_sale_item_id
    ) VALUES (
      p_org_id, p_sale.id, v_variant.id, v_qty, v_unit_price,
      0, v_line_total, v_cost,
      p_actor, p_actor,
      p_actor, p_line_origin, p_parent_sale_item_id
    )
    RETURNING id INTO v_sale_item_id;

    PERFORM public._reserve_inventory(
      p_org_id, p_sale.branch_id, v_variant.id, v_location_id,
      v_qty, p_sale.id, v_sale_item_id, p_actor, v_expires_at,
      coalesce(p_sale.client_txn_key, p_sale.id::text) || ':add:' || v_sale_item_id::text
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._append_attributed_online_lines(public.sales, uuid, uuid, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._append_attributed_online_lines(public.sales, uuid, uuid, jsonb, text, uuid) TO service_role;

--------------------------------------------------------------------------------
-- create_staff_online_order — stamp contributor on intake lines + MOD invoice
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
  v_cost numeric(14, 2);
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
  v_invoice_no := public.next_online_order_invoice(v_org_id);

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
    v_cost := coalesce(v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price,
      created_by, updated_by,
      contributor_profile_id, line_origin
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      0, v_line_total, v_cost,
      v_profile_id, v_profile_id,
      v_profile_id, 'intake'
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
      'grand_total', v_grand_total,
      'attribution', 'line_contributor'
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

GRANT EXECUTE ON FUNCTION public.create_staff_online_order(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- approve_online_order — optional add/increase lines attributed to approver
--------------------------------------------------------------------------------
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
  v_added int := 0;
  v_increased int := 0;
  v_inc jsonb;
  v_parent public.sale_items%ROWTYPE;
  v_add_qty numeric(14, 3);
  v_add_payload jsonb;
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
      'approved_at', v_sale.approved_at,
      'grand_total', v_sale.grand_total
    );
  END IF;

  -- Brand-new products added by Tele Sales / approver
  v_added := public._append_attributed_online_lines(
    v_sale, v_profile_id, v_org_id, payload->'add_items', 'approval_add', NULL
  );

  -- Qty increases: keep original moderator line; create sibling tele line for delta
  IF jsonb_typeof(payload->'increase_items') = 'array' THEN
    FOR v_inc IN SELECT * FROM jsonb_array_elements(payload->'increase_items')
    LOOP
      v_add_qty := coalesce((v_inc->>'add_qty')::numeric, (v_inc->>'qty')::numeric);
      IF v_add_qty IS NULL OR v_add_qty <= 0 THEN
        RAISE EXCEPTION 'increase_items.add_qty must be > 0';
      END IF;

      SELECT * INTO v_parent
      FROM public.sale_items si
      WHERE si.id = (v_inc->>'sale_item_id')::uuid
        AND si.sale_id = v_sale.id
        AND si.deleted_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent sale item not found: %', v_inc->>'sale_item_id';
      END IF;

      v_add_payload := jsonb_build_array(
        jsonb_build_object(
          'variant_id', v_parent.variant_id,
          'qty', v_add_qty,
          'unit_price', coalesce(NULLIF(v_inc->>'unit_price', '')::numeric, v_parent.unit_price)
        )
      );

      v_increased := v_increased + public._append_attributed_online_lines(
        v_sale, v_profile_id, v_org_id, v_add_payload, 'approval_increase', v_parent.id
      );
    END LOOP;
  END IF;

  IF payload ? 'shipping' THEN
    UPDATE public.sales
    SET shipping = greatest(coalesce((payload->>'shipping')::numeric, shipping), 0)
    WHERE id = v_sale.id;
  END IF;
  IF payload ? 'discount' THEN
    IF coalesce((payload->>'discount')::numeric, 0) > 0 AND NOT (
      public.user_has_permission('pos.discount')
      OR public.user_has_permission('accounts.manage')
    ) THEN
      RAISE EXCEPTION 'Missing discount permission' USING ERRCODE = '42501';
    END IF;
    UPDATE public.sales
    SET discount = greatest(coalesce((payload->>'discount')::numeric, discount), 0)
    WHERE id = v_sale.id;
  END IF;
  IF payload ? 'notes' THEN
    UPDATE public.sales
    SET note = NULLIF(btrim(payload->>'notes'), '')
    WHERE id = v_sale.id;
  END IF;

  PERFORM public._recompute_online_sale_totals(v_sale.id);

  UPDATE public.sales
  SET fulfilment_status = 'approved',
      approved_by = v_profile_id,
      approved_at = timezone('utc', now()),
      tele_salesman_id = coalesce(tele_salesman_id, v_profile_id),
      updated_by = v_profile_id
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.approve', 'sale', v_sale.id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_sale.invoice_no,
      'created_by', v_sale.created_by,
      'approved_by', v_profile_id,
      'lines_added', v_added,
      'lines_increased', v_increased,
      'grand_total', v_sale.grand_total
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
    'tele_salesman_id', v_sale.tele_salesman_id,
    'grand_total', v_sale.grand_total,
    'lines_added', v_added,
    'lines_increased', v_increased,
    'idempotent', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_online_order(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- amend_staff_online_order — edit after approve, before fulfil
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.amend_staff_online_order(payload jsonb)
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
  v_added int := 0;
  v_increased int := 0;
  v_inc jsonb;
  v_parent public.sale_items%ROWTYPE;
  v_add_qty numeric(14, 3);
  v_add_payload jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.approve')
    OR public.user_has_permission('orders.fulfil')
    OR public.user_has_permission('moderator.order.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to amend online orders' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = v_sale_id AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft orders can be amended';
  END IF;
  IF coalesce(v_sale.fulfilment_status, '') NOT IN ('pending_approval', 'approved') THEN
    RAISE EXCEPTION 'Order is not amendable in status %', v_sale.fulfilment_status;
  END IF;

  v_added := public._append_attributed_online_lines(
    v_sale, v_profile_id, v_org_id, payload->'add_items', 'approval_add', NULL
  );

  IF jsonb_typeof(payload->'increase_items') = 'array' THEN
    FOR v_inc IN SELECT * FROM jsonb_array_elements(payload->'increase_items')
    LOOP
      v_add_qty := coalesce((v_inc->>'add_qty')::numeric, (v_inc->>'qty')::numeric);
      IF v_add_qty IS NULL OR v_add_qty <= 0 THEN
        RAISE EXCEPTION 'increase_items.add_qty must be > 0';
      END IF;

      SELECT * INTO v_parent
      FROM public.sale_items si
      WHERE si.id = (v_inc->>'sale_item_id')::uuid
        AND si.sale_id = v_sale.id
        AND si.deleted_at IS NULL
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Parent sale item not found: %', v_inc->>'sale_item_id';
      END IF;

      v_add_payload := jsonb_build_array(
        jsonb_build_object(
          'variant_id', v_parent.variant_id,
          'qty', v_add_qty,
          'unit_price', coalesce(NULLIF(v_inc->>'unit_price', '')::numeric, v_parent.unit_price)
        )
      );

      v_increased := v_increased + public._append_attributed_online_lines(
        v_sale, v_profile_id, v_org_id, v_add_payload, 'approval_increase', v_parent.id
      );
    END LOOP;
  END IF;

  IF payload ? 'shipping' THEN
    UPDATE public.sales
    SET shipping = greatest(coalesce((payload->>'shipping')::numeric, shipping), 0)
    WHERE id = v_sale.id;
  END IF;
  IF payload ? 'discount' THEN
    IF coalesce((payload->>'discount')::numeric, 0) > 0 AND NOT (
      public.user_has_permission('pos.discount')
      OR public.user_has_permission('accounts.manage')
    ) THEN
      RAISE EXCEPTION 'Missing discount permission' USING ERRCODE = '42501';
    END IF;
    UPDATE public.sales
    SET discount = greatest(coalesce((payload->>'discount')::numeric, discount), 0)
    WHERE id = v_sale.id;
  END IF;

  UPDATE public.sales
  SET tele_salesman_id = coalesce(tele_salesman_id, v_profile_id),
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  PERFORM public._recompute_online_sale_totals(v_sale.id);

  SELECT * INTO v_sale FROM public.sales WHERE id = v_sale_id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.amend', 'sale', v_sale.id,
    NULL,
    jsonb_build_object(
      'lines_added', v_added,
      'lines_increased', v_increased,
      'grand_total', v_sale.grand_total
    ),
    NULL,
    jsonb_build_object('source', 'amend_staff_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'invoice_no', v_sale.invoice_no,
    'grand_total', v_sale.grand_total,
    'lines_added', v_added,
    'lines_increased', v_increased
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.amend_staff_online_order(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Split commission accrual by line contributor
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._accrue_contributor_commission(
  p_sale public.sales,
  p_profile_id uuid,
  p_employee_id uuid,
  p_base_amount numeric,
  p_cogs_amount numeric,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rule public.salesman_commission_rules%ROWTYPE;
  v_amount numeric(14, 2) := 0;
  v_commission_id uuid;
  v_key text;
  v_sale_date date;
  v_now timestamptz := timezone('utc', now());
  v_period_start date;
  v_period_end date;
  v_volume numeric(14, 2) := 0;
  v_tier jsonb;
  v_profit numeric(14, 2);
  v_employee_id uuid := p_employee_id;
  v_profile_id uuid := p_profile_id;
BEGIN
  IF v_profile_id IS NULL AND v_employee_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF coalesce(p_base_amount, 0) <= 0 THEN
    RETURN NULL;
  END IF;

  IF v_employee_id IS NULL AND v_profile_id IS NOT NULL THEN
    SELECT e.id INTO v_employee_id
    FROM public.employees e
    WHERE e.profile_id = v_profile_id
      AND e.organization_id = p_sale.organization_id
      AND e.deleted_at IS NULL
      AND e.status <> 'terminated'
    ORDER BY e.created_at ASC
    LIMIT 1;
  END IF;

  IF v_profile_id IS NULL AND v_employee_id IS NOT NULL THEN
    SELECT e.profile_id INTO v_profile_id
    FROM public.employees e
    WHERE e.id = v_employee_id;
  END IF;

  v_sale_date := coalesce(p_sale.completed_at, p_sale.created_at)::date;
  v_key := 'sale-comm:' || p_sale.id::text || ':' || coalesce(v_profile_id, v_employee_id)::text;

  IF EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = p_sale.organization_id
      AND sc.client_txn_key = v_key
      AND sc.deleted_at IS NULL
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = p_sale.organization_id
      AND client_txn_key = v_key AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  -- Legacy whole-sale key: skip creating a second row for same profile
  IF EXISTS (
    SELECT 1 FROM public.salesman_commissions sc
    WHERE sc.organization_id = p_sale.organization_id
      AND sc.client_txn_key = 'sale-comm:' || p_sale.id::text
      AND sc.deleted_at IS NULL
      AND sc.profile_id IS NOT DISTINCT FROM v_profile_id
  ) THEN
    SELECT id INTO v_commission_id
    FROM public.salesman_commissions
    WHERE organization_id = p_sale.organization_id
      AND client_txn_key = 'sale-comm:' || p_sale.id::text
      AND deleted_at IS NULL
    LIMIT 1;
    RETURN v_commission_id;
  END IF;

  SELECT * INTO v_rule
  FROM public.salesman_commission_rules r
  WHERE r.organization_id = p_sale.organization_id
    AND r.is_active = true
    AND r.deleted_at IS NULL
    AND r.effective_from <= v_sale_date
    AND (r.effective_to IS NULL OR r.effective_to >= v_sale_date)
    AND (r.branch_id IS NULL OR r.branch_id = p_sale.branch_id)
    AND p_source = ANY (r.applies_to_sources)
    AND (
      (r.subject_type = 'employee' AND v_employee_id IS NOT NULL AND r.employee_id = v_employee_id)
      OR (r.subject_type = 'profile' AND v_profile_id IS NOT NULL AND r.profile_id = v_profile_id)
      OR (
        r.subject_type IS DISTINCT FROM 'profile'
        AND v_employee_id IS NOT NULL
        AND r.employee_id = v_employee_id
      )
      OR (
        coalesce(r.subject_type, 'employee') = 'employee'
        AND r.employee_id IS NULL
        AND v_profile_id IS NOT NULL
        AND r.profile_id = v_profile_id
      )
    )
    AND (
      r.structure_mode IN ('sale_amount_tiers', 'period_volume_tiers')
      OR (r.rule_type <> 'none' AND r.rate > 0)
    )
  ORDER BY
    CASE WHEN r.subject_type = 'employee' AND r.employee_id IS NOT NULL THEN 0
         WHEN r.subject_type = 'profile' THEN 1
         ELSE 2 END,
    r.branch_id NULLS LAST,
    r.effective_from DESC
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  v_profit := GREATEST(p_base_amount - coalesce(p_cogs_amount, 0), 0);

  IF v_rule.structure_mode = 'per_sale' THEN
    v_amount := CASE v_rule.rule_type
      WHEN 'fixed' THEN v_rule.rate
      WHEN 'percent_sale' THEN round(p_base_amount * (v_rule.rate / 100.0), 2)
      WHEN 'percent_profit' THEN round(v_profit * (v_rule.rate / 100.0), 2)
      ELSE 0
    END;
  ELSIF v_rule.structure_mode = 'sale_amount_tiers' THEN
    v_tier := public._pick_commission_tier(v_rule.tiers, p_base_amount);
    v_amount := public._calc_tier_commission(v_tier, p_base_amount, v_profit, v_rule.base_metric);
  ELSE
    v_period_start := date_trunc('month', v_sale_date)::date;
    v_period_end := (date_trunc('month', v_sale_date) + interval '1 month - 1 day')::date;

    SELECT coalesce(sum(si.line_total), 0) INTO v_volume
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.organization_id = p_sale.organization_id
      AND s.deleted_at IS NULL
      AND si.deleted_at IS NULL
      AND s.status = 'completed'
      AND coalesce(s.completed_at, s.created_at)::date BETWEEN v_period_start AND v_period_end
      AND coalesce(si.contributor_profile_id, si.created_by) = v_profile_id;

    v_tier := public._pick_commission_tier(v_rule.tiers, v_volume);
    v_amount := public._calc_tier_commission(v_tier, p_base_amount, v_profit, v_rule.base_metric);
  END IF;

  IF v_amount <= 0 THEN RETURN NULL; END IF;

  INSERT INTO public.salesman_commissions (
    organization_id, branch_id, profile_id, employee_id, sale_id,
    base_amount, cogs_amount, commission_amount, status,
    approved_at, approved_by,
    client_txn_key, rule_snapshot, needs_employee_link, created_by, updated_by
  ) VALUES (
    p_sale.organization_id, p_sale.branch_id, v_profile_id, v_employee_id, p_sale.id,
    p_base_amount, coalesce(p_cogs_amount, 0), v_amount, 'approved',
    v_now, p_sale.created_by,
    v_key,
    jsonb_build_object(
      'rule_id', v_rule.id,
      'subject_type', v_rule.subject_type,
      'structure_mode', v_rule.structure_mode,
      'rule_type', v_rule.rule_type,
      'rate', v_rule.rate,
      'base_metric', v_rule.base_metric,
      'tiers', v_rule.tiers,
      'matched_tier', v_tier,
      'period_volume', CASE WHEN v_rule.structure_mode = 'period_volume_tiers' THEN v_volume ELSE NULL END,
      'order_source', p_source,
      'attribution_mode', 'line_contributor',
      'effective_from', v_rule.effective_from,
      'employee_id', v_rule.employee_id,
      'profile_id', v_rule.profile_id
    ),
    (v_employee_id IS NULL AND v_profile_id IS NOT NULL),
    p_sale.created_by, p_sale.created_by
  )
  RETURNING id INTO v_commission_id;

  RETURN v_commission_id;
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_contributor_commission(public.sales, uuid, uuid, numeric, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_contributor_commission(public.sales, uuid, uuid, numeric, numeric, text) TO service_role;

CREATE OR REPLACE FUNCTION public._accrue_sale_commission(p_sale_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_source text;
  v_first uuid;
  v_id uuid;
  r record;
  v_fallback_profile uuid;
  v_fallback_employee uuid;
  v_has_lines boolean := false;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.status <> 'completed' THEN
    RETURN NULL;
  END IF;

  -- Cancelled fulfilment never accrues
  IF coalesce(v_sale.fulfilment_status, '') = 'cancelled' THEN
    RETURN NULL;
  END IF;

  v_source := coalesce(nullif(v_sale.order_source, ''), 'pos');

  FOR r IN
    SELECT
      coalesce(si.contributor_profile_id, si.created_by) AS profile_id,
      max(si.contributor_employee_id) AS employee_id,
      sum(si.line_total) AS base_amount,
      coalesce(sum(round(si.qty * coalesce(si.cost_price, 0), 2)), 0) AS cogs_amount
    FROM public.sale_items si
    WHERE si.sale_id = p_sale_id
      AND si.deleted_at IS NULL
      AND coalesce(si.contributor_profile_id, si.created_by) IS NOT NULL
    GROUP BY coalesce(si.contributor_profile_id, si.created_by)
  LOOP
    v_has_lines := true;
    v_id := public._accrue_contributor_commission(
      v_sale, r.profile_id, r.employee_id, r.base_amount, r.cogs_amount, v_source
    );
    IF v_first IS NULL THEN
      v_first := v_id;
    END IF;
  END LOOP;

  IF v_has_lines THEN
    RETURN v_first;
  END IF;

  -- Legacy fallback: generator-first (created_by / moderator before tele)
  v_fallback_employee := v_sale.salesperson_employee_id;
  v_fallback_profile := coalesce(
    v_sale.salesperson_id,
    v_sale.moderator_id,
    v_sale.created_by,
    v_sale.tele_salesman_id
  );

  RETURN public._accrue_contributor_commission(
    v_sale,
    v_fallback_profile,
    v_fallback_employee,
    v_sale.grand_total,
    (
      SELECT coalesce(sum(round(si.qty * coalesce(si.cost_price, 0), 2)), 0)
      FROM public.sale_items si
      WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL
    ),
    v_source
  );
END;
$$;

REVOKE ALL ON FUNCTION public._accrue_sale_commission(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._accrue_sale_commission(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Patch staff dashboard / list to use contribution matching + line totals
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.staff_matches_sale_id(p_sale_id uuid, p_staff uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT public.staff_matches_sale(s, p_staff)
  FROM public.sales s
  WHERE s.id = p_sale_id;
$$;

-- Replace attribution predicate in existing staff RPCs via source rewrite
DO $$
DECLARE
  d text;
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.get_staff_dashboard_summary(jsonb)'::regprocedure,
    'public.list_staff_sales(jsonb)'::regprocedure
  ]
  LOOP
    d := pg_get_functiondef(fn);
    IF d IS NULL THEN CONTINUE; END IF;
    IF position('public.sale_attributed_staff_id(s) = v_staff' IN d) = 0 THEN
      CONTINUE;
    END IF;
    d := replace(
      d,
      'public.sale_attributed_staff_id(s) = v_staff',
      'public.staff_matches_sale(s, v_staff)'
    );
    -- Prefer line contribution for sales amount KPIs when present
    d := replace(
      d,
      'SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.staff_matches_sale(s, v_staff)
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_today_start AND s.created_at <= v_today_end
          AND coalesce(s.fulfilment_status, '''') <> ''cancelled''
          AND coalesce(s.status, '''') NOT IN (''voided'', ''cancelled'')',
      'SELECT public.staff_line_contribution_total(v_org_id, v_staff, v_branch, v_today_start, v_today_end)'
    );
    d := replace(
      d,
      'SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.staff_matches_sale(s, v_staff)
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_yest_start AND s.created_at <= v_yest_end
          AND coalesce(s.fulfilment_status, '''') <> ''cancelled''
          AND coalesce(s.status, '''') NOT IN (''voided'', ''cancelled'')',
      'SELECT public.staff_line_contribution_total(v_org_id, v_staff, v_branch, v_yest_start, v_yest_end)'
    );
    d := replace(
      d,
      'SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.staff_matches_sale(s, v_staff)
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_month_start
          AND coalesce(s.fulfilment_status, '''') <> ''cancelled''
          AND coalesce(s.status, '''') NOT IN (''voided'', ''cancelled'')',
      'SELECT public.staff_line_contribution_total(v_org_id, v_staff, v_branch, v_month_start, NULL)'
    );
    EXECUTE d;
  END LOOP;
END $$;
