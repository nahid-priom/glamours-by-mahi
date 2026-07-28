-- Migration 083: complete / cancel product exchange RPCs (Phase D)

--------------------------------------------------------------------------------
-- complete_product_exchange
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_product_exchange(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale_id uuid;
  v_branch_id uuid;
  v_client_txn_key text;
  v_note text;
  v_payment_account_id uuid;
  v_refund_account_id uuid;
  v_charge_as_due boolean;
  v_credit_as_advance boolean;
  v_sale public.sales%ROWTYPE;
  v_item jsonb;
  v_sale_item public.sale_items%ROWTYPE;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_condition text;
  v_variant_id uuid;
  v_already_returned numeric(14, 3);
  v_already_exchanged numeric(14, 3);
  v_exchange_id uuid;
  v_exchange_no text;
  v_seq bigint;
  v_existing uuid;
  v_return_total numeric(14, 2) := 0;
  v_replacement_total numeric(14, 2) := 0;
  v_difference numeric(14, 2) := 0;
  v_loc uuid;
  v_cost numeric(14, 2);
  v_saleable_loc uuid;
  v_abs_diff numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('exchange.create') THEN
    RAISE EXCEPTION 'Missing permission exchange.create' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_note := NULLIF(btrim(payload->>'note'), '');
  v_payment_account_id := NULLIF(payload->>'payment_account_id', '')::uuid;
  v_refund_account_id := NULLIF(payload->>'refund_account_id', '')::uuid;
  v_charge_as_due := coalesce((payload->>'charge_as_due')::boolean, false);
  v_credit_as_advance := coalesce((payload->>'credit_as_advance')::boolean, false);

  IF v_sale_id IS NULL THEN
    RAISE EXCEPTION 'sale_id is required';
  END IF;
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required';
  END IF;

  IF jsonb_typeof(payload->'return_items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'return_items') < 1 THEN
    RAISE EXCEPTION 'return_items array is required';
  END IF;
  IF jsonb_typeof(payload->'replacement_items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'replacement_items') < 1 THEN
    RAISE EXCEPTION 'replacement_items array is required';
  END IF;

  -- Idempotent on client_txn_key
  SELECT id INTO v_existing
  FROM public.exchanges
  WHERE organization_id = v_org_id
    AND client_txn_key = v_client_txn_key
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    SELECT e.id, e.exchange_no, e.difference_amount
    INTO v_exchange_id, v_exchange_no, v_difference
    FROM public.exchanges e
    WHERE e.id = v_existing;

    RETURN jsonb_build_object(
      'exchange_id', v_exchange_id,
      'exchange_no', v_exchange_no,
      'difference', v_difference,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be exchanged';
  END IF;

  v_branch_id := v_sale.branch_id;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  v_saleable_loc := public._saleable_location(v_org_id, v_branch_id);
  IF v_saleable_loc IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':exchange'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(e.exchange_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.exchanges e
  WHERE e.organization_id = v_org_id AND e.deleted_at IS NULL;

  v_exchange_no := 'EXC-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.exchanges (
    organization_id, branch_id, sale_id, exchange_no, status,
    difference_amount, payment_account_id, refund_account_id,
    client_txn_key, note, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_sale_id, v_exchange_no, 'completed',
    0, v_payment_account_id, v_refund_account_id,
    v_client_txn_key, v_note, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_exchange_id;

  --------------------------------------------------------------------------
  -- Return items (stock in)
  --------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'return_items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_condition := lower(btrim(coalesce(v_item->>'condition', 'sellable')));
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each return item requires qty > 0';
    END IF;
    IF v_condition NOT IN ('sellable', 'damaged', 'defective', 'quarantine') THEN
      RAISE EXCEPTION 'Invalid condition: %', v_condition;
    END IF;

    SELECT * INTO v_sale_item
    FROM public.sale_items si
    WHERE si.id = (v_item->>'sale_item_id')::uuid
      AND si.sale_id = v_sale_id
      AND si.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sale item not found';
    END IF;

    IF v_variant_id IS NOT NULL AND v_variant_id IS DISTINCT FROM v_sale_item.variant_id THEN
      RAISE EXCEPTION 'Return variant does not match sale item';
    END IF;
    v_variant_id := v_sale_item.variant_id;

    SELECT coalesce(sum(sri.qty), 0) INTO v_already_returned
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.sale_return_id
    WHERE sri.sale_item_id = v_sale_item.id
      AND sri.deleted_at IS NULL
      AND sr.deleted_at IS NULL
      AND sr.status = 'completed';

    SELECT coalesce(sum(ei.qty), 0) INTO v_already_exchanged
    FROM public.exchange_items ei
    JOIN public.exchanges ex ON ex.id = ei.exchange_id
    WHERE ei.original_sale_item_id = v_sale_item.id
      AND ei.direction = 'return'
      AND ei.deleted_at IS NULL
      AND ex.deleted_at IS NULL
      AND ex.status = 'completed'
      AND ex.id <> v_exchange_id;

    IF v_qty + v_already_returned + v_already_exchanged > v_sale_item.qty THEN
      RAISE EXCEPTION
        'Exchange return qty exceeds remaining for item % (sold %, returned %, exchanged %)',
        v_sale_item.id, v_sale_item.qty, v_already_returned, v_already_exchanged;
    END IF;

    v_unit_price := v_sale_item.unit_price;
    v_line_total := round(
      v_qty * v_unit_price
      - coalesce(v_sale_item.line_discount, 0) * (v_qty / nullif(v_sale_item.qty, 0)),
      2
    );
    v_return_total := v_return_total + v_line_total;

    INSERT INTO public.exchange_items (
      organization_id, exchange_id, direction, variant_id,
      qty, unit_price, line_total, condition, original_sale_item_id,
      created_by, updated_by
    ) VALUES (
      v_org_id, v_exchange_id, 'return', v_variant_id,
      v_qty, v_unit_price, v_line_total, v_condition, v_sale_item.id,
      v_profile_id, v_profile_id
    );

    IF v_condition = 'sellable' THEN
      v_loc := public._saleable_location(v_org_id, v_branch_id);
      IF v_loc IS NULL THEN
        v_loc := public._location_by_type(v_org_id, v_branch_id, 'saleable');
      END IF;
    ELSIF v_condition IN ('damaged', 'defective') THEN
      v_loc := public._location_by_type(v_org_id, v_branch_id, 'damaged');
    ELSE
      v_loc := public._location_by_type(v_org_id, v_branch_id, 'quarantine');
    END IF;

    IF v_loc IS NULL THEN
      v_loc := public._saleable_location(v_org_id, v_branch_id);
    END IF;
    IF v_loc IS NULL THEN
      RAISE EXCEPTION 'No stock location configured for condition %', v_condition;
    END IF;

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant_id, v_loc,
      v_qty, coalesce(v_sale_item.cost_price, 0), 'sale_return',
      'exchange', v_exchange_id,
      v_profile_id, coalesce(v_note, 'Product exchange return')
    );
  END LOOP;

  --------------------------------------------------------------------------
  -- Replacement items (stock out)
  --------------------------------------------------------------------------
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'replacement_items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_variant_id := NULLIF(v_item->>'variant_id', '')::uuid;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    IF v_variant_id IS NULL THEN
      RAISE EXCEPTION 'Each replacement item requires variant_id';
    END IF;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each replacement item requires qty > 0';
    END IF;
    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'unit_price cannot be negative';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.product_variants pv
      WHERE pv.id = v_variant_id
        AND pv.organization_id = v_org_id
        AND pv.deleted_at IS NULL
        AND pv.is_active = true
    ) THEN
      RAISE EXCEPTION 'Replacement variant not found: %', v_variant_id;
    END IF;

    v_line_total := round(v_qty * v_unit_price, 2);
    v_replacement_total := v_replacement_total + v_line_total;

    INSERT INTO public.exchange_items (
      organization_id, exchange_id, direction, variant_id,
      qty, unit_price, line_total, condition, original_sale_item_id,
      created_by, updated_by
    ) VALUES (
      v_org_id, v_exchange_id, 'replacement', v_variant_id,
      v_qty, v_unit_price, v_line_total, NULL, NULL,
      v_profile_id, v_profile_id
    );

    SELECT coalesce(ib.average_unit_cost, pv.purchase_price, 0)
    INTO v_cost
    FROM public.product_variants pv
    LEFT JOIN public.inventory_balances ib
      ON ib.variant_id = pv.id
     AND ib.location_id = v_saleable_loc
     AND ib.deleted_at IS NULL
    WHERE pv.id = v_variant_id
    LIMIT 1;

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant_id, v_saleable_loc,
      -v_qty, coalesce(v_cost, 0), 'sale',
      'exchange', v_exchange_id,
      v_profile_id, coalesce(v_note, 'Product exchange replacement')
    );
  END LOOP;

  v_difference := round(v_replacement_total - v_return_total, 2);

  UPDATE public.exchanges
  SET difference_amount = v_difference,
      updated_by = v_profile_id
  WHERE id = v_exchange_id;

  --------------------------------------------------------------------------
  -- Money movement
  --------------------------------------------------------------------------
  v_abs_diff := abs(v_difference);

  IF v_difference > 0 THEN
    -- Customer pays difference to account, or difference becomes customer due
    IF v_payment_account_id IS NOT NULL AND NOT v_charge_as_due THEN
      PERFORM public._post_financial_txn(
        v_org_id, v_branch_id, v_payment_account_id,
        'sale_payment', 'in', v_abs_diff,
        'exchange', v_exchange_id,
        v_exchange_no,
        coalesce(v_note, 'Exchange difference payment'),
        v_profile_id,
        true
      );
    ELSE
      IF v_sale.customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer required to charge exchange difference as due (or provide payment_account_id)';
      END IF;
      PERFORM public._post_customer_ledger_entry(
        v_org_id, v_branch_id, v_sale.customer_id,
        'sale_due', v_abs_diff, 0,
        'exchange', v_exchange_id,
        coalesce(v_note, 'Exchange difference due ' || v_exchange_no),
        v_profile_id,
        0, v_abs_diff, false
      );
    END IF;
  ELSIF v_difference < 0 THEN
    -- Refund via account, or credit customer advance via ledger
    IF v_refund_account_id IS NOT NULL AND NOT v_credit_as_advance THEN
      IF NOT (
        public.user_has_permission('exchange.refund')
        OR public.user_has_permission('exchange.create')
      ) THEN
        RAISE EXCEPTION 'Missing permission for exchange refund' USING ERRCODE = '42501';
      END IF;
      PERFORM public._post_financial_txn(
        v_org_id, v_branch_id, v_refund_account_id,
        'refund', 'out', v_abs_diff,
        'exchange', v_exchange_id,
        v_exchange_no,
        coalesce(v_note, 'Exchange difference refund'),
        v_profile_id,
        true
      );
    ELSE
      IF v_sale.customer_id IS NULL THEN
        RAISE EXCEPTION 'Customer required to credit exchange difference as advance (or provide refund_account_id)';
      END IF;
      PERFORM public._post_customer_ledger_entry(
        v_org_id, v_branch_id, v_sale.customer_id,
        'return_credit', 0, v_abs_diff,
        'exchange', v_exchange_id,
        coalesce(v_note, 'Exchange difference credit ' || v_exchange_no),
        v_profile_id,
        0, 0, false
      );
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'exchange.complete', 'exchange', v_exchange_id,
    NULL,
    jsonb_build_object(
      'sale_id', v_sale_id,
      'exchange_no', v_exchange_no,
      'return_total', v_return_total,
      'replacement_total', v_replacement_total,
      'difference', v_difference
    ),
    v_note,
    jsonb_build_object('source', 'complete_product_exchange')
  );

  IF v_sale.customer_id IS NOT NULL
     AND to_regprocedure('public._maybe_refresh_customer_rating(uuid)') IS NOT NULL THEN
    PERFORM public._maybe_refresh_customer_rating(v_sale.customer_id);
  END IF;

  RETURN jsonb_build_object(
    'exchange_id', v_exchange_id,
    'exchange_no', v_exchange_no,
    'difference', v_difference,
    'return_total', v_return_total,
    'replacement_total', v_replacement_total,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_product_exchange(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_product_exchange(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- cancel_product_exchange
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_product_exchange(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_exchange_id uuid;
  v_reason text;
  v_exchange public.exchanges%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_item public.exchange_items%ROWTYPE;
  v_loc uuid;
  v_saleable_loc uuid;
  v_cost numeric(14, 2);
  v_abs_diff numeric(14, 2);
  v_had_payment boolean;
  v_had_refund boolean;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('exchange.cancel') THEN
    RAISE EXCEPTION 'Missing permission exchange.cancel' USING ERRCODE = '42501';
  END IF;

  v_exchange_id := NULLIF(payload->>'exchange_id', '')::uuid;
  v_reason := NULLIF(btrim(payload->>'reason'), '');

  IF v_exchange_id IS NULL THEN
    RAISE EXCEPTION 'exchange_id is required';
  END IF;

  SELECT * INTO v_exchange
  FROM public.exchanges e
  WHERE e.id = v_exchange_id
    AND e.organization_id = v_org_id
    AND e.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exchange not found';
  END IF;

  IF NOT public.user_has_branch_access(v_exchange.branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_exchange.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'exchange_id', v_exchange.id,
      'exchange_no', v_exchange.exchange_no,
      'status', 'cancelled',
      'idempotent', true
    );
  END IF;

  IF v_exchange.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed exchanges can be cancelled';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_exchange.sale_id
    AND s.deleted_at IS NULL;

  v_saleable_loc := public._saleable_location(v_org_id, v_exchange.branch_id);
  IF v_saleable_loc IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  -- Reverse stock movements
  FOR v_item IN
    SELECT * FROM public.exchange_items ei
    WHERE ei.exchange_id = v_exchange.id
      AND ei.deleted_at IS NULL
  LOOP
    IF v_item.direction = 'return' THEN
      IF coalesce(v_item.condition, 'sellable') = 'sellable' THEN
        v_loc := public._saleable_location(v_org_id, v_exchange.branch_id);
      ELSIF coalesce(v_item.condition, '') IN ('damaged', 'defective') THEN
        v_loc := public._location_by_type(v_org_id, v_exchange.branch_id, 'damaged');
      ELSE
        v_loc := public._location_by_type(v_org_id, v_exchange.branch_id, 'quarantine');
      END IF;
      IF v_loc IS NULL THEN
        v_loc := v_saleable_loc;
      END IF;

      PERFORM public._adjust_inventory(
        v_org_id, v_exchange.branch_id, v_item.variant_id, v_loc,
        -v_item.qty, v_item.unit_price, 'correction',
        'exchange_cancel', v_exchange.id,
        v_profile_id, coalesce(v_reason, 'Cancel exchange return')
      );
    ELSE
      SELECT coalesce(ib.average_unit_cost, pv.purchase_price, v_item.unit_price, 0)
      INTO v_cost
      FROM public.product_variants pv
      LEFT JOIN public.inventory_balances ib
        ON ib.variant_id = pv.id
       AND ib.location_id = v_saleable_loc
       AND ib.deleted_at IS NULL
      WHERE pv.id = v_item.variant_id
      LIMIT 1;

      PERFORM public._adjust_inventory(
        v_org_id, v_exchange.branch_id, v_item.variant_id, v_saleable_loc,
        v_item.qty, coalesce(v_cost, 0), 'correction',
        'exchange_cancel', v_exchange.id,
        v_profile_id, coalesce(v_reason, 'Cancel exchange replacement')
      );
    END IF;
  END LOOP;

  -- Reverse money movement
  v_abs_diff := abs(coalesce(v_exchange.difference_amount, 0));

  IF v_abs_diff > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.source_type = 'exchange'
        AND ft.source_id = v_exchange.id
        AND ft.direction = 'in'
        AND ft.deleted_at IS NULL
        AND coalesce(ft.status, 'posted') = 'posted'
        AND ft.voided_at IS NULL
    ) INTO v_had_payment;

    SELECT EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.source_type = 'exchange'
        AND ft.source_id = v_exchange.id
        AND ft.direction = 'out'
        AND ft.deleted_at IS NULL
        AND coalesce(ft.status, 'posted') = 'posted'
        AND ft.voided_at IS NULL
    ) INTO v_had_refund;

    IF v_exchange.difference_amount > 0 THEN
      IF v_had_payment AND v_exchange.payment_account_id IS NOT NULL THEN
        PERFORM public._post_financial_txn(
          v_org_id, v_exchange.branch_id, v_exchange.payment_account_id,
          'refund', 'out', v_abs_diff,
          'exchange_cancel', v_exchange.id,
          v_exchange.exchange_no,
          coalesce(v_reason, 'Cancel exchange payment reverse'),
          v_profile_id,
          true
        );
      ELSIF v_sale.customer_id IS NOT NULL THEN
        PERFORM public._post_customer_ledger_entry(
          v_org_id, v_exchange.branch_id, v_sale.customer_id,
          'reversal', 0, v_abs_diff,
          'exchange_cancel', v_exchange.id,
          coalesce(v_reason, 'Cancel exchange due ' || v_exchange.exchange_no),
          v_profile_id,
          0, -v_abs_diff, false
        );
      END IF;
    ELSIF v_exchange.difference_amount < 0 THEN
      IF v_had_refund AND v_exchange.refund_account_id IS NOT NULL THEN
        PERFORM public._post_financial_txn(
          v_org_id, v_exchange.branch_id, v_exchange.refund_account_id,
          'sale_payment', 'in', v_abs_diff,
          'exchange_cancel', v_exchange.id,
          v_exchange.exchange_no,
          coalesce(v_reason, 'Cancel exchange refund reverse'),
          v_profile_id,
          true
        );
      ELSIF v_sale.customer_id IS NOT NULL THEN
        PERFORM public._post_customer_ledger_entry(
          v_org_id, v_exchange.branch_id, v_sale.customer_id,
          'reversal', v_abs_diff, 0,
          'exchange_cancel', v_exchange.id,
          coalesce(v_reason, 'Cancel exchange credit ' || v_exchange.exchange_no),
          v_profile_id,
          0, 0, false
        );
      END IF;
    END IF;
  END IF;

  UPDATE public.exchanges
  SET status = 'cancelled',
      note = CASE
        WHEN v_reason IS NULL THEN note
        WHEN note IS NULL OR note = '' THEN v_reason
        ELSE note || E'\nCancel: ' || v_reason
      END,
      updated_by = v_profile_id
  WHERE id = v_exchange.id;

  PERFORM public.write_audit_log(
    v_org_id, v_exchange.branch_id, v_profile_id,
    'exchange.cancel', 'exchange', v_exchange.id,
    jsonb_build_object('status', 'completed', 'difference', v_exchange.difference_amount),
    jsonb_build_object('status', 'cancelled', 'reason', v_reason),
    v_reason,
    jsonb_build_object('source', 'cancel_product_exchange')
  );

  IF v_sale.customer_id IS NOT NULL
     AND to_regprocedure('public._maybe_refresh_customer_rating(uuid)') IS NOT NULL THEN
    PERFORM public._maybe_refresh_customer_rating(v_sale.customer_id);
  END IF;

  RETURN jsonb_build_object(
    'exchange_id', v_exchange.id,
    'exchange_no', v_exchange.exchange_no,
    'status', 'cancelled',
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_product_exchange(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_product_exchange(jsonb) TO authenticated;
