-- Online order reservation + fulfilment through shared sale engines

--------------------------------------------------------------------------------
-- Internal: reserve / release available stock (qty_on_hand - qty_reserved)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._reserve_inventory(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty numeric,
  p_sale_id uuid,
  p_sale_item_id uuid,
  p_actor uuid,
  p_expires_at timestamptz,
  p_client_txn_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_available numeric(14, 3);
  v_id uuid;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'reserve qty must be > 0';
  END IF;

  IF p_client_txn_key IS NOT NULL THEN
    SELECT id INTO v_id
    FROM public.inventory_reservations
    WHERE organization_id = p_org_id
      AND client_txn_key = p_client_txn_key
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  v_bal := public._ensure_inventory_balance(p_org_id, p_variant_id, p_location_id, p_actor);

  SELECT * INTO v_bal
  FROM public.inventory_balances
  WHERE id = v_bal.id
  FOR UPDATE;

  v_available := coalesce(v_bal.quantity, 0) - coalesce(v_bal.qty_reserved, 0);
  IF v_available < p_qty THEN
    RAISE EXCEPTION 'Insufficient available stock for variant % (available %, need %)',
      p_variant_id, v_available, p_qty;
  END IF;

  UPDATE public.inventory_balances
  SET qty_reserved = coalesce(qty_reserved, 0) + p_qty,
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = v_bal.id;

  INSERT INTO public.inventory_reservations (
    organization_id, branch_id, sale_id, sale_item_id, variant_id, location_id,
    qty, status, expires_at, client_txn_key, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_sale_id, p_sale_item_id, p_variant_id, p_location_id,
    p_qty, 'active', p_expires_at, p_client_txn_key, p_actor, p_actor
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._release_sale_reservations(
  p_org_id uuid,
  p_sale_id uuid,
  p_actor uuid,
  p_new_status text DEFAULT 'released'
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT *
    FROM public.inventory_reservations
    WHERE organization_id = p_org_id
      AND sale_id = p_sale_id
      AND status = 'active'
      AND deleted_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE public.inventory_balances
    SET qty_reserved = greatest(coalesce(qty_reserved, 0) - r.qty, 0),
        updated_by = p_actor,
        updated_at = timezone('utc', now())
    WHERE organization_id = p_org_id
      AND variant_id = r.variant_id
      AND location_id = r.location_id
      AND deleted_at IS NULL;

    UPDATE public.inventory_reservations
    SET status = p_new_status,
        updated_by = p_actor,
        updated_at = timezone('utc', now())
    WHERE id = r.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public._reserve_inventory(uuid, uuid, uuid, uuid, numeric, uuid, uuid, uuid, timestamptz, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._release_sale_reservations(uuid, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- place_online_order: draft WEB sale + stock reservation only
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.place_online_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_branch_id uuid;
  v_client_txn_key text;
  v_phone text;
  v_name text;
  v_email text;
  v_address text;
  v_district text;
  v_notes text;
  v_shipping numeric(14, 2);
  v_customer_id uuid;
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
  v_location_id uuid;
  v_sale_item_id uuid;
  v_expires_at timestamptz;
  v_profile_id uuid;
  v_actor uuid;
BEGIN
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required';
  END IF;

  SELECT * INTO v_org
  FROM public.organizations o
  WHERE o.slug = NULLIF(btrim(coalesce(payload->>'organization_slug', payload->>'org_slug')), '')
    AND o.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Organization not found';
  END IF;

  -- Prefer org primary branch; fall back to first active branch
  SELECT b.id INTO v_branch_id
  FROM public.branches b
  WHERE b.organization_id = v_org.id
    AND b.deleted_at IS NULL
    AND b.is_active = true
  ORDER BY b.is_central DESC, b.created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'No active branch for organization';
  END IF;

  v_phone := regexp_replace(coalesce(payload->>'phone', ''), '[^0-9+]', '', 'g');
  IF length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Valid customer phone is required';
  END IF;
  -- Normalize BD mobiles to last 11 digits starting with 01 when possible
  IF v_phone ~ '01[3-9][0-9]{8}$' THEN
    v_phone := substring(v_phone from length(v_phone) - 10);
  END IF;

  v_name := NULLIF(btrim(coalesce(payload->>'customer_name', '')), '');
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'customer_name is required';
  END IF;
  v_email := NULLIF(btrim(coalesce(payload->>'email', '')), '');
  v_address := NULLIF(btrim(coalesce(payload->>'address', payload->>'delivery_address', '')), '');
  v_district := NULLIF(btrim(coalesce(payload->>'district', '')), '');
  v_notes := NULLIF(btrim(coalesce(payload->>'notes', payload->>'note', '')), '');
  v_shipping := coalesce((payload->>'shipping')::numeric, 0);
  IF v_shipping < 0 THEN RAISE EXCEPTION 'shipping cannot be negative'; END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  SELECT * INTO v_existing
  FROM public.sales s
  WHERE s.organization_id = v_org.id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sale_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'customer_id', v_existing.customer_id,
      'grand_total', v_existing.grand_total,
      'due_total', v_existing.due_total,
      'shipping', v_existing.shipping,
      'public_share_token', v_existing.public_share_token,
      'fulfilment_status', v_existing.fulfilment_status,
      'idempotent', true
    );
  END IF;

  -- Optional authenticated actor; guests use NULL created_by
  BEGIN
    SELECT p.id INTO v_profile_id
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.organization_id = v_org.id
      AND p.deleted_at IS NULL
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_profile_id := NULL;
  END;
  v_actor := v_profile_id;

  SELECT c.id INTO v_customer_id
  FROM public.customers c
  WHERE c.organization_id = v_org.id
    AND c.phone = v_phone
    AND c.deleted_at IS NULL
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      organization_id, branch_id, name, phone, email, address, district,
      preferred_channel, status, created_by, updated_by
    ) VALUES (
      v_org.id, v_branch_id, v_name, v_phone, v_email, v_address, v_district,
      'ecommerce', 'active', v_actor, v_actor
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers
    SET name = coalesce(NULLIF(name, ''), v_name),
        email = coalesce(v_email, email),
        address = coalesce(v_address, address),
        district = coalesce(v_district, district),
        updated_by = v_actor
    WHERE id = v_customer_id;
  END IF;

  v_location_id := public._saleable_location(v_org.id, v_branch_id);
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
      AND pv.organization_id = v_org.id
      AND pv.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
    END IF;

    v_unit_price := v_variant.selling_price;
    v_line_total := round(v_qty * v_unit_price, 2);
    v_subtotal := v_subtotal + v_line_total;
  END LOOP;

  v_grand_total := round(v_subtotal + v_shipping, 2);
  v_expires_at := timezone('utc', now()) + interval '48 hours';

  PERFORM pg_advisory_xact_lock(hashtext(v_org.id::text || ':web_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org.id
    AND s.deleted_at IS NULL
    AND s.invoice_no ILIKE 'WEB-%';

  v_invoice_no := 'WEB-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.sales (
    organization_id, branch_id, invoice_no, customer_id,
    status, payment_status, channel,
    subtotal, discount, tax, shipping, grand_total,
    paid_total, due_total, change_amount, client_txn_key,
    fulfilment_status, delivery_address, delivery_district,
    reservation_expires_at, note, created_by, updated_by
  ) VALUES (
    v_org.id, v_branch_id, v_invoice_no, v_customer_id,
    'draft', 'unpaid', 'ecommerce',
    v_subtotal, 0, 0, v_shipping, v_grand_total,
    0, v_grand_total, 0, v_client_txn_key,
    'new', v_address, v_district,
    v_expires_at, v_notes, v_actor, v_actor
  )
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := coalesce((v_item->>'qty')::numeric, (v_item->>'quantity')::numeric);

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid;

    v_unit_price := v_variant.selling_price;
    v_line_total := round(v_qty * v_unit_price, 2);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, created_by, updated_by
    ) VALUES (
      v_org.id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      0, v_line_total, v_actor, v_actor
    )
    RETURNING id INTO v_sale_item_id;

    PERFORM public._reserve_inventory(
      v_org.id, v_branch_id, v_variant.id, v_location_id, v_qty,
      v_sale_id, v_sale_item_id, v_actor, v_expires_at,
      v_client_txn_key || ':' || v_variant.id::text
    );
  END LOOP;

  PERFORM public.write_audit_log(
    v_org.id, v_branch_id, v_actor,
    'online_order.place', 'sale', v_sale_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'grand_total', v_grand_total,
      'client_txn_key', v_client_txn_key,
      'reserved', true
    ),
    v_notes,
    jsonb_build_object('source', 'place_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'customer_id', v_customer_id,
    'grand_total', v_grand_total,
    'due_total', v_grand_total,
    'shipping', v_shipping,
    'public_share_token', (
      SELECT public_share_token FROM public.sales WHERE id = v_sale_id
    ),
    'fulfilment_status', 'new',
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_online_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_online_order(jsonb) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- fulfil_online_order: convert draft → completed via shared POS core engines
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfil_online_order(payload jsonb)
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
  v_item public.sale_items%ROWTYPE;
  v_location_id uuid;
  v_res record;
  v_complete_payload jsonb;
  v_items jsonb := '[]'::jsonb;
  v_payments jsonb;
  v_result jsonb;
  v_client_txn_key text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.fulfil')
    OR public.user_has_permission('sales.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to fulfil online orders' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = v_sale_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status = 'completed' AND v_sale.fulfilled_sale_posted_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'sale_id', v_sale.id,
      'invoice_no', v_sale.invoice_no,
      'idempotent', true
    );
  END IF;

  IF v_sale.status <> 'draft'
     OR coalesce(v_sale.channel, '') NOT IN ('ecommerce', 'online') THEN
    RAISE EXCEPTION 'Only draft ecommerce orders can be fulfilled';
  END IF;

  IF v_sale.fulfilment_status = 'cancelled' THEN
    RAISE EXCEPTION 'Cancelled orders cannot be fulfilled';
  END IF;

  IF v_sale.reservation_expires_at IS NOT NULL
     AND v_sale.reservation_expires_at < timezone('utc', now()) THEN
    RAISE EXCEPTION 'Order reservation has expired; cancel or re-place the order';
  END IF;

  -- Consume reservations (release reserved qty) then deduct on-hand via sale movements
  FOR v_res IN
    SELECT *
    FROM public.inventory_reservations
    WHERE sale_id = v_sale.id
      AND organization_id = v_org_id
      AND status = 'active'
      AND deleted_at IS NULL
    FOR UPDATE
  LOOP
    UPDATE public.inventory_balances
    SET qty_reserved = greatest(coalesce(qty_reserved, 0) - v_res.qty, 0),
        updated_by = v_profile_id
    WHERE organization_id = v_org_id
      AND variant_id = v_res.variant_id
      AND location_id = v_res.location_id
      AND deleted_at IS NULL;

    UPDATE public.inventory_reservations
    SET status = 'consumed', updated_by = v_profile_id
    WHERE id = v_res.id;
  END LOOP;

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location';
  END IF;

  FOR v_item IN
    SELECT * FROM public.sale_items
    WHERE sale_id = v_sale.id AND deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      -v_item.qty, NULL, 'sale', 'sale', v_sale.id,
      v_profile_id, 'Online fulfilment ' || v_sale.invoice_no
    );

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'variant_id', v_item.variant_id,
      'qty', v_item.qty,
      'unit_price', v_item.unit_price,
      'line_discount', coalesce(v_item.line_discount, 0)
    ));
  END LOOP;

  -- COD: treat as due unless explicit payments provided
  IF jsonb_typeof(payload->'payments') = 'array'
     AND jsonb_array_length(payload->'payments') > 0 THEN
    v_payments := payload->'payments';
  ELSE
    v_payments := jsonb_build_array(jsonb_build_object(
      'method', 'due',
      'amount', v_sale.grand_total
    ));
  END IF;

  -- Unique client key for POS core (draft already owns original key)
  v_client_txn_key := 'fulfil:' || v_sale.client_txn_key;

  -- Mark draft completed in place (shared posting semantics without duplicate sale row)
  UPDATE public.sales
  SET status = 'completed',
      payment_status = CASE
        WHEN coalesce((
          SELECT sum((p->>'amount')::numeric)
          FROM jsonb_array_elements(v_payments) p
          WHERE lower(coalesce(p->>'method','')) NOT IN ('due','credit','receivable')
        ), 0) >= grand_total THEN 'paid'
        WHEN coalesce((
          SELECT sum((p->>'amount')::numeric)
          FROM jsonb_array_elements(v_payments) p
          WHERE lower(coalesce(p->>'method','')) NOT IN ('due','credit','receivable')
        ), 0) > 0 THEN 'partial'
        ELSE 'unpaid'
      END,
      paid_total = coalesce((
        SELECT sum((p->>'amount')::numeric)
        FROM jsonb_array_elements(v_payments) p
        WHERE lower(coalesce(p->>'method','')) NOT IN ('due','credit','receivable')
      ), 0),
      due_total = greatest(grand_total - coalesce((
        SELECT sum((p->>'amount')::numeric)
        FROM jsonb_array_elements(v_payments) p
        WHERE lower(coalesce(p->>'method','')) NOT IN ('due','credit','receivable')
      ), 0), 0),
      fulfilment_status = coalesce(NULLIF(payload->>'fulfilment_status', ''), 'confirmed'),
      fulfilled_sale_posted_at = timezone('utc', now()),
      completed_at = timezone('utc', now()),
      updated_by = v_profile_id
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  -- Customer AR / paid summaries
  IF v_sale.customer_id IS NOT NULL AND v_sale.due_total > 0 THEN
    UPDATE public.customers
    SET current_due = current_due + v_sale.due_total,
        total_spent = total_spent + v_sale.grand_total,
        total_paid = total_paid + v_sale.paid_total,
        updated_by = v_profile_id
    WHERE id = v_sale.customer_id;

    INSERT INTO public.customer_ledger (
      organization_id, branch_id, customer_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    )
    SELECT
      v_org_id, v_sale.branch_id, v_sale.customer_id, 'sale_due',
      v_sale.due_total, 0, c.current_due,
      'sale', v_sale.id,
      'Online order ' || v_sale.invoice_no,
      v_profile_id, v_profile_id
    FROM public.customers c WHERE c.id = v_sale.customer_id;
  ELSIF v_sale.customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = total_spent + v_sale.grand_total,
        total_paid = total_paid + v_sale.paid_total,
        updated_by = v_profile_id
    WHERE id = v_sale.customer_id;
  END IF;

  -- Persist payments + cash-book
  DECLARE
    v_payment jsonb;
    v_method text;
    v_pay_amount numeric(14, 2);
    v_fin_acct uuid;
    v_is_due boolean;
  BEGIN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
    LOOP
      v_method := lower(btrim(coalesce(v_payment->>'method', '')));
      v_pay_amount := (v_payment->>'amount')::numeric;
      SELECT coalesce(pm.is_due, false) INTO v_is_due
      FROM public.payment_methods pm
      WHERE pm.organization_id = v_org_id AND lower(pm.code) = v_method
        AND pm.deleted_at IS NULL AND pm.is_active = true;
      IF NOT FOUND THEN
        v_is_due := (v_method IN ('due', 'credit', 'receivable'));
      END IF;

      INSERT INTO public.sale_payments (
        organization_id, sale_id, method, amount,
        financial_account_id, reference, created_by, updated_by
      ) VALUES (
        v_org_id, v_sale.id, coalesce(NULLIF(btrim(v_payment->>'method'), ''), 'due'),
        v_pay_amount,
        NULLIF(v_payment->>'financial_account_id', '')::uuid,
        NULLIF(v_payment->>'reference', ''),
        v_profile_id, v_profile_id
      );

      IF NOT v_is_due THEN
        v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
        IF v_fin_acct IS NULL THEN
          RAISE EXCEPTION 'financial_account_id required for method %', v_method;
        END IF;
        PERFORM public._post_financial_txn(
          v_org_id, v_sale.branch_id, v_fin_acct,
          'sale_payment', 'in', v_pay_amount,
          'sale', v_sale.id,
          v_sale.invoice_no,
          'Online fulfilment payment',
          v_profile_id,
          true
        );
      END IF;
    END LOOP;
  END;

  -- Revenue / COGS / inventory / AR journal when CoA present
  DECLARE
    v_rev uuid := public._coa_by_role(v_org_id, 'sales_revenue');
    v_cogs uuid := public._coa_by_role(v_org_id, 'cogs');
    v_inv uuid := public._coa_by_role(v_org_id, 'inventory_asset');
    v_recv uuid := public._coa_by_role(v_org_id, 'receivable');
    v_cash uuid := public._coa_by_role(v_org_id, 'cash');
    v_lines jsonb := '[]'::jsonb;
    v_cogs_amt numeric(14, 2);
  BEGIN
    IF v_cash IS NULL THEN v_cash := public._coa_by_role(v_org_id, 'bank'); END IF;

    SELECT coalesce(sum(
      si.qty * coalesce(pv.purchase_price, 0)
    ), 0) INTO v_cogs_amt
    FROM public.sale_items si
    JOIN public.product_variants pv ON pv.id = si.variant_id
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL;

    IF v_rev IS NOT NULL THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'chart_account_id', v_rev, 'debit', 0, 'credit', v_sale.grand_total,
        'description', 'Online sales revenue'
      ));
      IF v_sale.due_total > 0 AND v_recv IS NOT NULL THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'chart_account_id', v_recv, 'debit', v_sale.due_total, 'credit', 0,
          'description', 'Accounts receivable'
        ));
      END IF;
      IF v_sale.paid_total > 0 AND v_cash IS NOT NULL THEN
        v_lines := v_lines || jsonb_build_array(jsonb_build_object(
          'chart_account_id', v_cash, 'debit', v_sale.paid_total, 'credit', 0,
          'description', 'Cash/bank received'
        ));
      END IF;
      IF v_cogs IS NOT NULL AND v_inv IS NOT NULL AND v_cogs_amt > 0 THEN
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'chart_account_id', v_cogs, 'debit', v_cogs_amt, 'credit', 0,
            'description', 'COGS'
          ),
          jsonb_build_object(
            'chart_account_id', v_inv, 'debit', 0, 'credit', v_cogs_amt,
            'description', 'Inventory relief'
          )
        );
      END IF;

      IF jsonb_array_length(v_lines) >= 2 THEN
        PERFORM public._post_journal(
          v_org_id, v_sale.branch_id,
          'JE-WEB-' || replace(v_sale.id::text, '-', ''),
          'sale', v_sale.id,
          'Online fulfilment ' || v_sale.invoice_no,
          v_lines,
          v_profile_id
        );
      END IF;
    END IF;
  END;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.fulfil', 'sale', v_sale.id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_sale.invoice_no,
      'fulfil_key', v_client_txn_key,
      'grand_total', v_sale.grand_total
    ),
    NULL,
    jsonb_build_object('source', 'fulfil_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'invoice_no', v_sale.invoice_no,
    'grand_total', v_sale.grand_total,
    'paid_total', v_sale.paid_total,
    'due_total', v_sale.due_total,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fulfil_online_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfil_online_order(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- cancel_online_order / expire_online_reservations
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_online_order(payload jsonb)
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
  v_released int;
  v_reason text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.cancel')
    OR public.user_has_permission('sales.update')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to cancel online orders' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_reason := NULLIF(payload->>'reason', '');
  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;

  SELECT * INTO v_sale
  FROM public.sales
  WHERE id = v_sale_id AND organization_id = v_org_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft online orders can be cancelled';
  END IF;

  v_released := public._release_sale_reservations(v_org_id, v_sale.id, v_profile_id, 'released');

  UPDATE public.sales
  SET fulfilment_status = 'cancelled',
      note = coalesce(v_sale.note || E'\n', '') || coalesce('Cancelled: ' || v_reason, 'Cancelled'),
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'online_order.cancel', 'sale', v_sale.id,
    NULL,
    jsonb_build_object('released', v_released, 'reason', v_reason),
    v_reason,
    jsonb_build_object('source', 'cancel_online_order')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'released', v_released,
    'fulfilment_status', 'cancelled'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_online_reservations(p_organization_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_count int := 0;
  v_released int;
BEGIN
  FOR r IN
    SELECT s.*
    FROM public.sales s
    WHERE s.status = 'draft'
      AND coalesce(s.channel, '') IN ('ecommerce', 'online')
      AND coalesce(s.fulfilment_status, 'new') <> 'cancelled'
      AND s.reservation_expires_at IS NOT NULL
      AND s.reservation_expires_at < timezone('utc', now())
      AND s.deleted_at IS NULL
      AND (p_organization_id IS NULL OR s.organization_id = p_organization_id)
    FOR UPDATE
  LOOP
    v_released := public._release_sale_reservations(
      r.organization_id, r.id, r.updated_by, 'expired'
    );
    UPDATE public.sales
    SET fulfilment_status = 'cancelled',
        note = coalesce(note || E'\n', '') || 'Reservation expired',
        updated_at = timezone('utc', now())
    WHERE id = r.id;
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('expired_orders', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_online_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_online_order(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.expire_online_reservations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_online_reservations(uuid) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- Admin list helper
--------------------------------------------------------------------------------
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
  v_limit int;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('orders.read')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission to list online orders' USING ERRCODE = '42501';
  END IF;

  v_status := NULLIF(payload->>'status', '');
  v_limit := least(coalesce((payload->>'limit')::int, 100), 500);

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(q)::jsonb ORDER BY q.created_at DESC)
    FROM (
      SELECT
        s.id, s.invoice_no, s.status, s.fulfilment_status, s.channel,
        s.grand_total, s.due_total, s.paid_total,
        s.delivery_address, s.delivery_district,
        s.reservation_expires_at, s.completed_at, s.created_at,
        s.public_share_token, s.customer_id,
        c.name AS customer_name, c.phone AS customer_phone
      FROM public.sales s
      LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE s.organization_id = v_org_id
        AND s.deleted_at IS NULL
        AND coalesce(s.channel, '') IN ('ecommerce', 'online')
        AND (v_status IS NULL OR s.fulfilment_status = v_status OR s.status = v_status)
      ORDER BY s.created_at DESC
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_online_orders(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_online_orders(jsonb) TO authenticated;
