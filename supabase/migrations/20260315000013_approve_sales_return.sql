-- Glamourous by Mahi · Retail ERP
-- Migration 013: approve_sales_return RPC for POS sale returns
-- Restocks by condition, reverses customer due / cash refund, writes financial_transactions

CREATE OR REPLACE FUNCTION public.approve_sales_return(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.return.review')
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
    v_client_txn_key := 'auto:' || gen_random_uuid()::text;
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'items array is required';
  END IF;

  SELECT id INTO v_existing
  FROM public.sale_returns
  WHERE organization_id = v_org_id
    AND reason = 'CTX:' || v_client_txn_key
    AND deleted_at IS NULL
  LIMIT 1;

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
    approved_by, approved_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_sale_id, v_return_no, 'completed',
    coalesce('CTX:' || v_client_txn_key, v_reason), 0,
    v_profile_id, timezone('utc', now()), v_profile_id, v_profile_id
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

    IF v_qty > v_sale_item.qty THEN
      RAISE EXCEPTION 'Return qty exceeds sold qty for item %', v_sale_item.id;
    END IF;

    v_line_total := round(v_qty * v_sale_item.unit_price - coalesce(v_sale_item.line_discount, 0) * (v_qty / nullif(v_sale_item.qty, 0)), 2);
    v_return_total := v_return_total + v_line_total;

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
      reason = coalesce(v_reason, reason),
      updated_by = v_profile_id
  WHERE id = v_return_id;

  -- Prefer reducing customer due; otherwise refund cash/bank when account provided
  IF v_sale.customer_id IS NOT NULL AND v_sale.due_total > 0 THEN
    v_due_reduce := least(v_return_total, v_sale.due_total);
    UPDATE public.customers
    SET current_due = greatest(current_due - v_due_reduce, 0),
        updated_by = v_profile_id
    WHERE id = v_sale.customer_id
    RETURNING * INTO v_customer;

    INSERT INTO public.customer_ledger (
      organization_id, branch_id, customer_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_sale.customer_id, 'sale_return',
      0, v_due_reduce, v_customer.current_due,
      'sale_return', v_return_id,
      coalesce(v_reason, 'Sales return ' || v_return_no),
      v_profile_id, v_profile_id
    );

    UPDATE public.sales
    SET due_total = greatest(due_total - v_due_reduce, 0),
        grand_total = greatest(grand_total - v_return_total, 0),
        updated_by = v_profile_id
    WHERE id = v_sale_id;
  ELSE
    UPDATE public.sales
    SET grand_total = greatest(grand_total - v_return_total, 0),
        updated_by = v_profile_id
    WHERE id = v_sale_id;
  END IF;

  v_cash_refund := greatest(v_return_total - v_due_reduce, 0);
  IF v_cash_refund > 0 AND v_refund_account_id IS NOT NULL THEN
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

COMMENT ON FUNCTION public.approve_sales_return(jsonb) IS
  'Approves a POS sales return: restocks by condition, updates customer due / refund, records financial txn.';

REVOKE ALL ON FUNCTION public.approve_sales_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_sales_return(jsonb) TO authenticated;
