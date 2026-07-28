-- Migration 085: Canonical customer balance paths for online fulfil + sales return
-- + Top customers date-range ranking
-- Forward-only. Do not edit 00032/00034/00084.

CREATE OR REPLACE FUNCTION public.approve_sales_return(payload jsonb)
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
  v_reason text;
  v_client_txn_key text;
  v_refund_account_id uuid;
  v_sale public.sales%ROWTYPE;
  v_item jsonb;
  v_sale_item public.sale_items%ROWTYPE;
  v_qty numeric(14, 3);
  v_already_returned numeric(14, 3);
  v_condition text;
  v_return_id uuid;
  v_return_no text;
  v_seq bigint;
  v_return_total numeric(14, 2) := 0;
  v_line_total numeric(14, 2);
  v_loc uuid;
  v_movement text;
  v_existing uuid;
  v_customer public.customers%ROWTYPE;
  v_due_reduce numeric(14, 2) := 0;
  v_cash_refund numeric(14, 2) := 0;
  v_cogs_total numeric(14, 2) := 0;
  v_sales_coa uuid;
  v_cogs_coa uuid;
  v_inv_coa uuid;
  v_recv_coa uuid;
  v_cash_coa uuid;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.return.review')
    OR public.user_has_permission('sales.return')
    OR public.user_has_permission('sales.void')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to approve sales return' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_reason := NULLIF(payload->>'reason', '');
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_refund_account_id := NULLIF(payload->>'refund_account_id', '')::uuid;

  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'items array is required';
  END IF;

  SELECT id INTO v_existing
  FROM public.sale_returns
  WHERE organization_id = v_org_id
    AND client_txn_key = v_client_txn_key
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NULL THEN
    SELECT id INTO v_existing
    FROM public.sale_returns
    WHERE organization_id = v_org_id
      AND reason = 'CTX:' || v_client_txn_key
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('sale_return_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be returned';
  END IF;

  v_branch_id := v_sale.branch_id;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':sale_return'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(sr.return_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sale_returns sr
  WHERE sr.organization_id = v_org_id AND sr.deleted_at IS NULL;

  v_return_no := 'SR-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.sale_returns (
    organization_id, branch_id, sale_id, return_no, status, reason, total,
    client_txn_key, approved_by, approved_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_sale_id, v_return_no, 'completed',
    coalesce(v_reason, 'Sales return'), 0,
    v_client_txn_key, v_profile_id, timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_return_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_condition := lower(btrim(coalesce(v_item->>'condition', 'sellable')));

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each item requires qty > 0';
    END IF;
    IF v_condition NOT IN ('sellable', 'damaged', 'quarantine', 'missing', 'wrong_item') THEN
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

    SELECT coalesce(sum(sri.qty), 0) INTO v_already_returned
    FROM public.sale_return_items sri
    JOIN public.sale_returns sr ON sr.id = sri.sale_return_id
    WHERE sri.sale_item_id = v_sale_item.id
      AND sri.deleted_at IS NULL
      AND sr.deleted_at IS NULL
      AND sr.status = 'completed'
      AND sr.id <> v_return_id;

    IF v_qty + v_already_returned > v_sale_item.qty THEN
      RAISE EXCEPTION 'Return qty exceeds remaining returnable qty for item % (sold %, already returned %)',
        v_sale_item.id, v_sale_item.qty, v_already_returned;
    END IF;

    v_line_total := round(
      v_qty * v_sale_item.unit_price
      - coalesce(v_sale_item.line_discount, 0) * (v_qty / nullif(v_sale_item.qty, 0)),
      2
    );
    v_return_total := v_return_total + v_line_total;
    v_cogs_total := v_cogs_total + round(v_qty * coalesce(v_sale_item.cost_price, 0), 2);

    INSERT INTO public.sale_return_items (
      organization_id, sale_return_id, sale_item_id, variant_id,
      qty, unit_price, line_total, condition, created_by, updated_by
    ) VALUES (
      v_org_id, v_return_id, v_sale_item.id, v_sale_item.variant_id,
      v_qty, v_sale_item.unit_price, v_line_total, v_condition,
      v_profile_id, v_profile_id
    );

    IF v_qty > 0 AND v_condition IN ('sellable', 'damaged', 'quarantine') THEN
      IF v_condition = 'sellable' THEN
        v_loc := public._location_by_type(v_org_id, v_branch_id, 'saleable');
        v_movement := 'sale_return';
      ELSIF v_condition = 'damaged' THEN
        v_loc := public._location_by_type(v_org_id, v_branch_id, 'damaged');
        v_movement := 'damage';
      ELSE
        v_loc := public._location_by_type(v_org_id, v_branch_id, 'quarantine');
        v_movement := 'quarantine';
      END IF;

      IF v_loc IS NULL THEN
        v_loc := public._saleable_location(v_org_id, v_branch_id);
        v_movement := 'sale_return';
      END IF;

      IF v_loc IS NULL THEN
        RAISE EXCEPTION 'No stock location configured for branch';
      END IF;

      PERFORM public._adjust_inventory(
        v_org_id, v_branch_id, v_sale_item.variant_id, v_loc,
        v_qty, coalesce(v_sale_item.cost_price, 0), v_movement, 'sale_return', v_return_id,
        v_profile_id, coalesce(v_reason, 'Sales return')
      );
    END IF;
  END LOOP;

  UPDATE public.sale_returns
  SET total = v_return_total,
      updated_by = v_profile_id
  WHERE id = v_return_id;

  -- Canonical party ledger: full return_credit, then refund debit for cash portion
  v_due_reduce := least(v_return_total, coalesce(v_sale.due_total, 0));
  v_cash_refund := greatest(v_return_total - v_due_reduce, 0);

  IF v_sale.customer_id IS NOT NULL AND v_return_total > 0 THEN
    PERFORM public._post_customer_ledger_entry(
      v_org_id, v_branch_id, v_sale.customer_id,
      'return_credit', 0, v_return_total,
      'sale_return', v_return_id,
      coalesce(v_reason, 'Sales return ' || v_return_no),
      v_profile_id,
      0, -v_return_total
    );

    IF v_cash_refund > 0 THEN
      IF v_refund_account_id IS NULL THEN
        RAISE EXCEPTION 'refund_account_id is required when cash refund is due';
      END IF;
      PERFORM public._post_financial_txn(
        v_org_id, v_branch_id, v_refund_account_id,
        'refund', 'out', v_cash_refund,
        'sale_return', v_return_id,
        v_return_no,
        coalesce(v_reason, 'Sales return refund'),
        v_profile_id,
        true
      );
      PERFORM public._post_customer_ledger_entry(
        v_org_id, v_branch_id, v_sale.customer_id,
        'refund', v_cash_refund, 0,
        'sale_return', v_return_id,
        'Cash refund ' || v_return_no,
        v_profile_id,
        -v_cash_refund, 0
      );
    END IF;

    UPDATE public.sales
    SET due_total = greatest(due_total - v_due_reduce, 0),
        payment_status = CASE
          WHEN greatest(due_total - v_due_reduce, 0) = 0 THEN 'paid'
          WHEN paid_total > 0 THEN 'partial'
          ELSE payment_status
        END,
        updated_by = v_profile_id
    WHERE id = v_sale_id;

    PERFORM public._maybe_refresh_customer_rating(v_sale.customer_id);
  ELSIF v_cash_refund > 0 THEN
    IF v_refund_account_id IS NULL THEN
      RAISE EXCEPTION 'refund_account_id is required when cash refund is due';
    END IF;
    PERFORM public._post_financial_txn(
      v_org_id, v_branch_id, v_refund_account_id,
      'refund', 'out', v_cash_refund,
      'sale_return', v_return_id,
      v_return_no,
      coalesce(v_reason, 'Sales return refund'),
      v_profile_id,
      true
    );
  END IF;

  -- Reverse revenue / COGS / inventory for returned value
  SELECT id INTO v_sales_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'sales_revenue' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cogs_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'cogs' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_inv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'inventory_asset' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_recv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'receivable' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cash_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role IN ('cash', 'bank', 'mobile_money') AND deleted_at IS NULL
  ORDER BY CASE system_role WHEN 'cash' THEN 0 WHEN 'mobile_money' THEN 1 ELSE 2 END
  LIMIT 1;

  IF v_sales_coa IS NOT NULL AND v_return_total > 0 THEN
    IF v_due_reduce > 0 AND v_recv_coa IS NOT NULL THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'chart_account_id', v_recv_coa, 'debit', 0, 'credit', v_due_reduce,
        'description', 'AR reduction on return'
      ));
    END IF;
    IF v_cash_refund > 0 AND v_cash_coa IS NOT NULL THEN
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'chart_account_id', v_cash_coa, 'debit', 0, 'credit', v_cash_refund,
        'description', 'Cash refund on return'
      ));
    END IF;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'chart_account_id', v_sales_coa, 'debit', v_return_total, 'credit', 0,
      'description', 'Sales return'
    ));
    IF v_cogs_total > 0 AND v_cogs_coa IS NOT NULL AND v_inv_coa IS NOT NULL THEN
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'chart_account_id', v_inv_coa, 'debit', v_cogs_total, 'credit', 0,
          'description', 'Inventory restock'
        ),
        jsonb_build_object(
          'chart_account_id', v_cogs_coa, 'debit', 0, 'credit', v_cogs_total,
          'description', 'COGS reversal'
        )
      );
    END IF;

    IF jsonb_array_length(v_lines) >= 2 THEN
      PERFORM public._post_journal(
        v_org_id, v_branch_id,
        'JE-SRET-' || replace(v_return_id::text, '-', ''),
        'sale_return', v_return_id,
        'Sales return ' || v_return_no,
        v_lines,
        v_profile_id
      );
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'sale_return.approve', 'sale_return', v_return_id,
    NULL,
    jsonb_build_object(
      'sale_id', v_sale_id,
      'return_no', v_return_no,
      'total', v_return_total,
      'due_reduce', v_due_reduce,
      'cash_refund', v_cash_refund
    ),
    v_reason,
    jsonb_build_object('source', 'approve_sales_return')
  );

  RETURN jsonb_build_object(
    'sale_return_id', v_return_id,
    'return_no', v_return_no,
    'total', v_return_total,
    'due_reduce', v_due_reduce,
    'cash_refund', v_cash_refund,
    'idempotent', false
  );
END;
$$;


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
      fulfilled_by = coalesce(fulfilled_by, v_profile_id),
      updated_by = v_profile_id
  WHERE id = v_sale.id
  RETURNING * INTO v_sale;

  -- Persist payments + cash-book FIRST (canonical ledger reads sale_payments)
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

  -- Canonical customer ledger (due/advance-aware); no direct current_due updates
  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._apply_customer_sale_canonical_ledger(v_sale.id, v_profile_id);
    PERFORM public._maybe_refresh_customer_rating(v_sale.customer_id);
  END IF;

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


REVOKE ALL ON FUNCTION public.approve_sales_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_return(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.fulfil_online_order(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfil_online_order(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Top customers: optional from/to period metrics (rating remains lifetime)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_top_customers(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_limit int := greatest(1, least(coalesce((payload->>'limit')::int, 20), 100));
  v_offset int := greatest(0, coalesce((payload->>'offset')::int, 0));
  v_sort text := lower(coalesce(NULLIF(payload->>'sort', ''), 'spent'));
  v_search text := NULLIF(btrim(coalesce(payload->>'search', '')), '');
  v_branch_id uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_from timestamptz := NULLIF(payload->>'from', '')::timestamptz;
  v_to timestamptz := NULLIF(payload->>'to', '')::timestamptz;
  v_has_range boolean;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('reports.read')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF v_branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_sort NOT IN ('rating', 'spent', 'orders', 'recent') THEN
    v_sort := 'spent';
  END IF;

  -- Inclusive end-of-day when only a date was passed as to
  IF v_to IS NOT NULL AND (payload->>'to') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
    v_to := v_to + interval '1 day' - interval '1 second';
  END IF;

  v_has_range := (v_from IS NOT NULL OR v_to IS NOT NULL);

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(t)::jsonb ORDER BY t.rank)
    FROM (
      SELECT
        row_number() OVER ()::int AS rank,
        q.*
      FROM (
        SELECT
          c.id,
          c.name,
          c.phone,
          c.current_due,
          c.current_advance,
          CASE
            WHEN v_has_range THEN coalesce(period.period_spent, 0)
            ELSE c.total_spent
          END AS total_spent,
          c.status,
          crs.score AS rating,
          coalesce(crs.rating_status, 'unrated') AS rating_status,
          coalesce(period.completed_orders, 0) AS completed_orders,
          coalesce(period.return_total, 0) AS return_total,
          period.last_purchase_at
        FROM public.customers c
        LEFT JOIN public.customer_rating_summaries crs
          ON crs.customer_id = c.id
         AND crs.organization_id = c.organization_id
         AND crs.deleted_at IS NULL
        LEFT JOIN LATERAL (
          SELECT
            count(s.id)::int AS completed_orders,
            coalesce(sum(s.grand_total), 0) AS period_spent,
            max(s.completed_at) AS last_purchase_at,
            (
              SELECT coalesce(sum(sr.total), 0)
              FROM public.sale_returns sr
              JOIN public.sales s2 ON s2.id = sr.sale_id AND s2.deleted_at IS NULL
              WHERE s2.customer_id = c.id
                AND sr.organization_id = v_org_id
                AND sr.status = 'completed'
                AND sr.deleted_at IS NULL
                AND (v_from IS NULL OR sr.created_at >= v_from)
                AND (v_to IS NULL OR sr.created_at <= v_to)
                AND (v_branch_id IS NULL OR s2.branch_id = v_branch_id)
            ) AS return_total
          FROM public.sales s
          WHERE s.customer_id = c.id
            AND s.organization_id = v_org_id
            AND s.status = 'completed'
            AND s.deleted_at IS NULL
            AND (v_branch_id IS NULL OR s.branch_id = v_branch_id)
            AND (v_from IS NULL OR s.completed_at >= v_from)
            AND (v_to IS NULL OR s.completed_at <= v_to)
        ) period ON true
        WHERE c.organization_id = v_org_id
          AND c.deleted_at IS NULL
          AND c.status = 'active'
          AND (
            v_search IS NULL
            OR c.name ILIKE '%' || v_search || '%'
            OR c.phone ILIKE '%' || v_search || '%'
          )
          AND (
            v_branch_id IS NULL
            OR c.branch_id = v_branch_id
            OR EXISTS (
              SELECT 1 FROM public.sales s
              WHERE s.customer_id = c.id
                AND s.branch_id = v_branch_id
                AND s.deleted_at IS NULL
            )
          )
          AND (
            NOT v_has_range
            OR coalesce(period.completed_orders, 0) > 0
            OR coalesce(period.return_total, 0) > 0
          )
        ORDER BY
          CASE WHEN v_sort = 'spent' AND v_has_range THEN coalesce(period.period_spent, 0) END DESC NULLS LAST,
          CASE WHEN v_sort = 'spent' AND NOT v_has_range THEN c.total_spent END DESC NULLS LAST,
          CASE WHEN v_sort = 'orders' THEN coalesce(period.completed_orders, 0)::numeric END DESC NULLS LAST,
          CASE WHEN v_sort = 'rating' THEN crs.score END DESC NULLS LAST,
          CASE WHEN v_sort = 'recent' THEN period.last_purchase_at END DESC NULLS LAST,
          CASE WHEN v_has_range THEN coalesce(period.period_spent, 0) ELSE c.total_spent END DESC,
          c.name ASC
        LIMIT v_limit
        OFFSET v_offset
      ) q
    ) t
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_top_customers(
  p_limit int DEFAULT 20,
  p_sort text DEFAULT 'rating'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.list_top_customers(jsonb_build_object(
    'limit', p_limit,
    'sort', p_sort,
    'offset', 0
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_top_customers(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_top_customers(int, text) TO authenticated, service_role;
