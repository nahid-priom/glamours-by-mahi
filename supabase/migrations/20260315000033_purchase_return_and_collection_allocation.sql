-- Purchase path: FT posting helper, purchase return RPC, collection FIFO allocation

--------------------------------------------------------------------------------
-- FIFO allocation of a customer collection onto open sales
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._allocate_customer_collection(
  p_org_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_collection_id uuid,
  p_amount numeric,
  p_actor uuid,
  p_allocations jsonb DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining numeric(14, 2) := p_amount;
  v_apply numeric(14, 2);
  v_sale public.sales%ROWTYPE;
  v_alloc jsonb;
  v_sale_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array'
     AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_sale_id := NULLIF(v_alloc->>'sale_id', '')::uuid;
      v_apply := least(coalesce((v_alloc->>'amount')::numeric, 0), v_remaining);
      IF v_sale_id IS NULL OR v_apply <= 0 THEN CONTINUE; END IF;

      SELECT * INTO v_sale
      FROM public.sales
      WHERE id = v_sale_id
        AND organization_id = p_org_id
        AND customer_id = p_customer_id
        AND deleted_at IS NULL
        AND status = 'completed'
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation sale not found: %', v_sale_id;
      END IF;

      v_apply := least(v_apply, coalesce(v_sale.due_total, 0));
      IF v_apply <= 0 THEN CONTINUE; END IF;

      UPDATE public.sales
      SET paid_total = paid_total + v_apply,
          due_total = greatest(due_total - v_apply, 0),
          payment_status = CASE
            WHEN greatest(due_total - v_apply, 0) = 0 THEN 'paid'
            ELSE 'partial'
          END,
          updated_by = p_actor
      WHERE id = v_sale.id;

      INSERT INTO public.payment_allocations (
        organization_id, branch_id, party_type, party_id, direction,
        source_type, source_id, document_type, document_id, amount,
        client_txn_key, created_by, updated_by
      ) VALUES (
        p_org_id, p_branch_id, 'customer', p_customer_id, 'in',
        'collection', p_collection_id, 'sale', v_sale.id, v_apply,
        'alloc:' || p_collection_id::text || ':' || v_sale.id::text,
        p_actor, p_actor
      );

      v_remaining := v_remaining - v_apply;
    END LOOP;
  ELSE
    FOR v_sale IN
      SELECT *
      FROM public.sales
      WHERE organization_id = p_org_id
        AND customer_id = p_customer_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND due_total > 0
      ORDER BY completed_at ASC NULLS LAST, created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := least(v_remaining, v_sale.due_total);

      UPDATE public.sales
      SET paid_total = paid_total + v_apply,
          due_total = greatest(due_total - v_apply, 0),
          payment_status = CASE
            WHEN greatest(due_total - v_apply, 0) = 0 THEN 'paid'
            ELSE 'partial'
          END,
          updated_by = p_actor
      WHERE id = v_sale.id;

      INSERT INTO public.payment_allocations (
        organization_id, branch_id, party_type, party_id, direction,
        source_type, source_id, document_type, document_id, amount,
        client_txn_key, created_by, updated_by
      ) VALUES (
        p_org_id, p_branch_id, 'customer', p_customer_id, 'in',
        'collection', p_collection_id, 'sale', v_sale.id, v_apply,
        'alloc:' || p_collection_id::text || ':' || v_sale.id::text,
        p_actor, p_actor
      );

      v_remaining := v_remaining - v_apply;
    END LOOP;
  END IF;

  RETURN p_amount - v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public._allocate_customer_collection(uuid, uuid, uuid, uuid, numeric, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- Patch collect_customer_due: tighten permission + allocate to sales
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collect_customer_due(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_customer_id uuid;
  v_client_txn_key text;
  v_amount numeric(14, 2) := 0;
  v_payments jsonb;
  v_payment jsonb;
  v_pay_amount numeric(14, 2);
  v_fin_acct uuid;
  v_customer public.customers%ROWTYPE;
  v_existing uuid;
  v_collection_id uuid := gen_random_uuid();
  v_entry_no text;
  v_journal_id uuid;
  v_cash_coa uuid;
  v_recv_coa uuid;
  v_line_no int := 0;
  v_fa public.financial_accounts%ROWTYPE;
  v_note text;
  v_allow_advance boolean := false;
  v_allocated numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.post')
    OR public.user_has_permission('customer_due.collect')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to collect customer due' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_customer_id := NULLIF(payload->>'customer_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_note := coalesce(NULLIF(payload->>'notes', ''), NULLIF(payload->>'note', ''));

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_customer_id IS NULL THEN RAISE EXCEPTION 'customer_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required';
  END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  v_entry_no := 'COL-' || left(encode(extensions.digest(v_org_id::text || ':' || v_client_txn_key, 'sha256'), 'hex'), 24);

  SELECT id INTO v_existing
  FROM public.financial_transactions
  WHERE organization_id = v_org_id
    AND reference = v_entry_no
    AND status = 'posted'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('collection_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.organization_id = v_org_id
    AND c.deleted_at IS NULL
    AND c.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found or not active';
  END IF;

  v_payments := public._normalize_money_payments(payload);
  IF jsonb_array_length(v_payments) < 1 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment amount';
    END IF;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
    IF v_fin_acct IS NULL THEN
      RAISE EXCEPTION 'Receive account is required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_accounts fa
      WHERE fa.id = v_fin_acct
        AND fa.organization_id = v_org_id
        AND fa.deleted_at IS NULL
        AND fa.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid receive account';
    END IF;
    v_amount := v_amount + v_pay_amount;
  END LOOP;

  SELECT coalesce(settings->'simple_accounting'->>'allow_customer_advance', 'false') = 'true'
  INTO v_allow_advance
  FROM public.organizations
  WHERE id = v_org_id;

  IF v_amount > v_customer.current_due AND NOT coalesce(v_allow_advance, false) THEN
    RAISE EXCEPTION 'Collection amount % exceeds customer due %', v_amount, v_customer.current_due;
  END IF;

  -- Non-negative due constraint: never go below zero unless advance supported
  IF NOT coalesce(v_allow_advance, false) THEN
    NULL;
  ELSIF v_amount > v_customer.current_due THEN
    RAISE EXCEPTION 'Customer advances are configured but current_due cannot go negative; split advance into a separate credit workflow';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := (v_payment->>'financial_account_id')::uuid;

    PERFORM public._post_financial_txn(
      v_org_id, v_branch_id, v_fin_acct,
      'customer_collection', 'in', v_pay_amount,
      'collection', v_collection_id,
      v_entry_no,
      coalesce(v_note, 'Customer due collection'),
      v_profile_id,
      true
    );
  END LOOP;

  UPDATE public.customers
  SET current_due = current_due - v_amount,
      total_paid = total_paid + v_amount,
      updated_by = v_profile_id
  WHERE id = v_customer_id
  RETURNING * INTO v_customer;

  INSERT INTO public.customer_ledger (
    organization_id, branch_id, customer_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_customer_id, 'collection',
    0, v_amount, v_customer.current_due,
    'collection', v_collection_id,
    coalesce(v_note, 'Due collection ' || v_client_txn_key),
    v_profile_id, v_profile_id
  );

  v_allocated := public._allocate_customer_collection(
    v_org_id, v_branch_id, v_customer_id, v_collection_id, v_amount, v_profile_id,
    payload->'allocations'
  );

  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'bank'); END IF;
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'mobile_money'); END IF;
  v_recv_coa := public._coa_by_role(v_org_id, 'receivable');

  IF v_cash_coa IS NOT NULL AND v_recv_coa IS NOT NULL THEN
    v_journal_id := public._post_journal(
      v_org_id, v_branch_id,
      'JE-' || v_entry_no,
      'collection', v_collection_id,
      'Customer due collection ' || v_client_txn_key,
      jsonb_build_array(
        jsonb_build_object(
          'chart_account_id', v_cash_coa, 'debit', v_amount, 'credit', 0,
          'description', 'Cash collected'
        ),
        jsonb_build_object(
          'chart_account_id', v_recv_coa, 'debit', 0, 'credit', v_amount,
          'description', 'Receivable reduced'
        )
      ),
      v_profile_id
    );
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'collection.create', 'collection', v_collection_id,
    NULL,
    jsonb_build_object(
      'customer_id', v_customer_id,
      'amount', v_amount,
      'allocated', v_allocated,
      'client_txn_key', v_client_txn_key,
      'balance_after', v_customer.current_due
    ),
    v_note,
    jsonb_build_object('source', 'collect_customer_due')
  );

  RETURN jsonb_build_object(
    'collection_id', v_collection_id,
    'journal_id', v_journal_id,
    'amount', v_amount,
    'allocated', v_allocated,
    'balance_after', v_customer.current_due,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.collect_customer_due(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_customer_due(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- approve_purchase_return — atomic stock + AP + optional cash + journal
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_purchase_return(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_purchase_id uuid;
  v_branch_id uuid;
  v_client_txn_key text;
  v_reason text;
  v_refund_account_id uuid;
  v_purchase public.purchases%ROWTYPE;
  v_item jsonb;
  v_purchase_item public.purchase_items%ROWTYPE;
  v_qty numeric(14, 3);
  v_already numeric(14, 3);
  v_return_id uuid;
  v_return_no text;
  v_seq bigint;
  v_existing uuid;
  v_total numeric(14, 2) := 0;
  v_line_total numeric(14, 2);
  v_loc uuid;
  v_supplier public.suppliers%ROWTYPE;
  v_due_reduce numeric(14, 2) := 0;
  v_cash_refund numeric(14, 2) := 0;
  v_inv_coa uuid;
  v_pay_coa uuid;
  v_cash_coa uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('purchases.return')
    OR public.user_has_permission('purchases.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission for purchase return' USING ERRCODE = '42501';
  END IF;

  v_purchase_id := NULLIF(payload->>'purchase_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_reason := NULLIF(payload->>'reason', '');
  v_refund_account_id := NULLIF(payload->>'refund_account_id', '')::uuid;

  IF v_purchase_id IS NULL THEN RAISE EXCEPTION 'purchase_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;
  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'items array is required';
  END IF;

  SELECT id INTO v_existing
  FROM public.purchase_returns
  WHERE organization_id = v_org_id
    AND client_txn_key = v_client_txn_key
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('purchase_return_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases
  WHERE id = v_purchase_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Purchase not found'; END IF;
  IF v_purchase.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed purchases can be returned';
  END IF;

  v_branch_id := v_purchase.branch_id;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':purchase_return'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(pr.return_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.purchase_returns pr
  WHERE pr.organization_id = v_org_id AND pr.deleted_at IS NULL;

  v_return_no := 'PR-' || lpad(v_seq::text, 6, '0');

  INSERT INTO public.purchase_returns (
    organization_id, branch_id, purchase_id, supplier_id, return_no, status, reason, total,
    client_txn_key, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_purchase_id, v_purchase.supplier_id, v_return_no, 'completed',
    coalesce(v_reason, 'Purchase return'), 0,
    v_client_txn_key, v_profile_id, v_profile_id
  )
  RETURNING id INTO v_return_id;

  v_loc := public._saleable_location(v_org_id, v_branch_id);
  IF v_loc IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Each item requires qty > 0';
    END IF;

    SELECT * INTO v_purchase_item
    FROM public.purchase_items pi
    WHERE pi.id = (v_item->>'purchase_item_id')::uuid
      AND pi.purchase_id = v_purchase_id
      AND pi.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Purchase item not found';
    END IF;

    SELECT coalesce(sum(pri.qty), 0) INTO v_already
    FROM public.purchase_return_items pri
    JOIN public.purchase_returns pr ON pr.id = pri.purchase_return_id
    WHERE pri.purchase_item_id = v_purchase_item.id
      AND pri.deleted_at IS NULL
      AND pr.deleted_at IS NULL
      AND pr.status = 'completed'
      AND pr.id <> v_return_id;

    IF v_qty + v_already > v_purchase_item.qty THEN
      RAISE EXCEPTION 'Return qty exceeds purchased qty for item %', v_purchase_item.id;
    END IF;

    v_line_total := round(v_qty * v_purchase_item.unit_cost, 2);
    v_total := v_total + v_line_total;

    INSERT INTO public.purchase_return_items (
      organization_id, purchase_return_id, purchase_item_id, variant_id,
      qty, unit_cost, line_total, created_by, updated_by
    ) VALUES (
      v_org_id, v_return_id, v_purchase_item.id, v_purchase_item.variant_id,
      v_qty, v_purchase_item.unit_cost, v_line_total, v_profile_id, v_profile_id
    );

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_purchase_item.variant_id, v_loc,
      -v_qty, v_purchase_item.unit_cost, 'purchase_return', 'purchase_return', v_return_id,
      v_profile_id, coalesce(v_reason, 'Purchase return')
    );
  END LOOP;

  UPDATE public.purchase_returns
  SET total = v_total, updated_by = v_profile_id
  WHERE id = v_return_id;

  v_due_reduce := least(v_total, coalesce(v_purchase.due_total, 0));
  IF v_due_reduce > 0 THEN
    UPDATE public.suppliers
    SET current_due = greatest(current_due - v_due_reduce, 0),
        updated_by = v_profile_id
    WHERE id = v_purchase.supplier_id
    RETURNING * INTO v_supplier;

    INSERT INTO public.supplier_ledger (
      organization_id, branch_id, supplier_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_purchase.supplier_id, 'return_credit',
      0, v_due_reduce, v_supplier.current_due,
      'purchase_return', v_return_id,
      coalesce(v_reason, 'Purchase return ' || v_return_no),
      v_profile_id, v_profile_id
    );

    UPDATE public.purchases
    SET due_total = greatest(due_total - v_due_reduce, 0),
        payment_status = CASE
          WHEN greatest(due_total - v_due_reduce, 0) = 0 THEN 'paid'
          WHEN paid_total > 0 THEN 'partial'
          ELSE payment_status
        END,
        updated_by = v_profile_id
    WHERE id = v_purchase_id;
  END IF;

  v_cash_refund := greatest(v_total - v_due_reduce, 0);
  IF v_cash_refund > 0 THEN
    IF v_refund_account_id IS NULL THEN
      RAISE EXCEPTION 'refund_account_id required when supplier refund cash is due';
    END IF;
    PERFORM public._post_financial_txn(
      v_org_id, v_branch_id, v_refund_account_id,
      'purchase_return_refund', 'in', v_cash_refund,
      'purchase_return', v_return_id,
      v_return_no,
      coalesce(v_reason, 'Purchase return refund'),
      v_profile_id,
      true
    );
  END IF;

  v_inv_coa := public._coa_by_role(v_org_id, 'inventory_asset');
  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'bank'); END IF;

  IF v_inv_coa IS NOT NULL AND v_total > 0 THEN
    PERFORM public._post_journal(
      v_org_id, v_branch_id,
      'JE-PRET-' || replace(v_return_id::text, '-', ''),
      'purchase_return', v_return_id,
      'Purchase return ' || v_return_no,
      (
        SELECT jsonb_agg(x)
        FROM (
          SELECT jsonb_build_object(
            'chart_account_id', v_inv_coa, 'debit', 0, 'credit', v_total,
            'description', 'Inventory returned'
          ) AS x
          UNION ALL
          SELECT jsonb_build_object(
            'chart_account_id', coalesce(v_pay_coa, v_cash_coa), 'debit', v_total, 'credit', 0,
            'description', 'AP/cash reduction'
          )
          WHERE coalesce(v_pay_coa, v_cash_coa) IS NOT NULL
        ) q
      ),
      v_profile_id
    );
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'purchase_return.approve', 'purchase_return', v_return_id,
    NULL,
    jsonb_build_object(
      'purchase_id', v_purchase_id,
      'return_no', v_return_no,
      'total', v_total,
      'due_reduce', v_due_reduce,
      'cash_refund', v_cash_refund
    ),
    v_reason,
    jsonb_build_object('source', 'approve_purchase_return')
  );

  RETURN jsonb_build_object(
    'purchase_return_id', v_return_id,
    'return_no', v_return_no,
    'total', v_total,
    'due_reduce', v_due_reduce,
    'cash_refund', v_cash_refund,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_purchase_return(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_purchase_return(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Backfill financial_transactions for completed purchases that only adjusted FA
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_purchase_financial_transactions(p_purchase_id uuid)
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
    SELECT
      pp.amount,
      pp.financial_account_id,
      pp.reference,
      p.organization_id,
      p.branch_id,
      p.invoice_no,
      p.created_by,
      p.id AS purchase_id
    FROM public.purchase_payments pp
    JOIN public.purchases p ON p.id = pp.purchase_id
    WHERE pp.purchase_id = p_purchase_id
      AND pp.financial_account_id IS NOT NULL
      AND pp.deleted_at IS NULL
      AND p.deleted_at IS NULL
  LOOP
    PERFORM public._post_financial_txn(
      r.organization_id, r.branch_id, r.financial_account_id,
      'purchase_payment', 'out', r.amount,
      'purchase', r.purchase_id,
      coalesce(r.reference, r.invoice_no),
      'Purchase payment ' || coalesce(r.invoice_no, ''),
      r.created_by,
      false
    );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_purchase_financial_transactions(uuid)
  FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- Wrap complete_purchase: keep legacy body, post FT ledger without double-balance
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'complete_purchase'
      AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = '_complete_purchase_core'
      AND pg_get_function_identity_arguments(p.oid) = 'payload jsonb'
  ) THEN
    ALTER FUNCTION public.complete_purchase(jsonb) RENAME TO _complete_purchase_core;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_purchase(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_purchase_id uuid;
  v_idempotent boolean;
  n_synced int;
BEGIN
  v_result := public._complete_purchase_core(payload);
  v_purchase_id := NULLIF(v_result->>'purchase_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_purchase_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  -- Core already mutated FA balances; write matching FT rows without re-applying.
  n_synced := public.sync_purchase_financial_transactions(v_purchase_id);

  RETURN v_result || jsonb_build_object('financial_txns_synced', n_synced);
END;
$$;

REVOKE ALL ON FUNCTION public.complete_purchase(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_purchase(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public._complete_purchase_core(jsonb) FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- FIFO allocation for supplier payments onto open purchases
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._allocate_supplier_payment(
  p_org_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_payment_id uuid,
  p_amount numeric,
  p_actor uuid,
  p_purchase_id uuid DEFAULT NULL,
  p_allocations jsonb DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining numeric(14, 2) := p_amount;
  v_apply numeric(14, 2);
  v_purchase public.purchases%ROWTYPE;
  v_alloc jsonb;
  v_doc_id uuid;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  IF p_allocations IS NOT NULL AND jsonb_typeof(p_allocations) = 'array'
     AND jsonb_array_length(p_allocations) > 0 THEN
    FOR v_alloc IN SELECT * FROM jsonb_array_elements(p_allocations)
    LOOP
      v_doc_id := NULLIF(v_alloc->>'purchase_id', '')::uuid;
      v_apply := least(coalesce((v_alloc->>'amount')::numeric, 0), v_remaining);
      IF v_doc_id IS NULL OR v_apply <= 0 THEN CONTINUE; END IF;

      SELECT * INTO v_purchase
      FROM public.purchases
      WHERE id = v_doc_id
        AND organization_id = p_org_id
        AND supplier_id = p_supplier_id
        AND deleted_at IS NULL
        AND status = 'completed'
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation purchase not found: %', v_doc_id;
      END IF;

      v_apply := least(v_apply, coalesce(v_purchase.due_total, 0));
      IF v_apply <= 0 THEN CONTINUE; END IF;

      UPDATE public.purchases
      SET paid_total = paid_total + v_apply,
          due_total = greatest(due_total - v_apply, 0),
          payment_status = CASE
            WHEN greatest(due_total - v_apply, 0) = 0 THEN 'paid'
            ELSE 'partial'
          END,
          updated_by = p_actor
      WHERE id = v_purchase.id;

      INSERT INTO public.payment_allocations (
        organization_id, branch_id, party_type, party_id, direction,
        source_type, source_id, document_type, document_id, amount,
        client_txn_key, created_by, updated_by
      ) VALUES (
        p_org_id, p_branch_id, 'supplier', p_supplier_id, 'out',
        'supplier_payment', p_payment_id, 'purchase', v_purchase.id, v_apply,
        'alloc:' || p_payment_id::text || ':' || v_purchase.id::text,
        p_actor, p_actor
      );

      v_remaining := v_remaining - v_apply;
    END LOOP;
  ELSIF p_purchase_id IS NOT NULL THEN
    -- Explicit single invoice already updated by pay_supplier; record allocation only.
    SELECT * INTO v_purchase
    FROM public.purchases
    WHERE id = p_purchase_id
      AND organization_id = p_org_id
      AND supplier_id = p_supplier_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
      v_apply := least(p_amount, coalesce(v_purchase.due_total, 0) + p_amount);
      -- Document totals already adjusted in pay_supplier; allocation is audit only.
      IF NOT EXISTS (
        SELECT 1 FROM public.payment_allocations pa
        WHERE pa.organization_id = p_org_id
          AND pa.client_txn_key = 'alloc:' || p_payment_id::text || ':' || v_purchase.id::text
          AND pa.deleted_at IS NULL
      ) THEN
        INSERT INTO public.payment_allocations (
          organization_id, branch_id, party_type, party_id, direction,
          source_type, source_id, document_type, document_id, amount,
          client_txn_key, created_by, updated_by
        ) VALUES (
          p_org_id, p_branch_id, 'supplier', p_supplier_id, 'out',
          'supplier_payment', p_payment_id, 'purchase', v_purchase.id, p_amount,
          'alloc:' || p_payment_id::text || ':' || v_purchase.id::text,
          p_actor, p_actor
        );
      END IF;
      v_remaining := 0;
    END IF;
  ELSE
    FOR v_purchase IN
      SELECT *
      FROM public.purchases
      WHERE organization_id = p_org_id
        AND supplier_id = p_supplier_id
        AND deleted_at IS NULL
        AND status = 'completed'
        AND due_total > 0
      ORDER BY completed_at ASC NULLS LAST, created_at ASC, id ASC
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_apply := least(v_remaining, v_purchase.due_total);

      UPDATE public.purchases
      SET paid_total = paid_total + v_apply,
          due_total = greatest(due_total - v_apply, 0),
          payment_status = CASE
            WHEN greatest(due_total - v_apply, 0) = 0 THEN 'paid'
            ELSE 'partial'
          END,
          updated_by = p_actor
      WHERE id = v_purchase.id;

      INSERT INTO public.payment_allocations (
        organization_id, branch_id, party_type, party_id, direction,
        source_type, source_id, document_type, document_id, amount,
        client_txn_key, created_by, updated_by
      ) VALUES (
        p_org_id, p_branch_id, 'supplier', p_supplier_id, 'out',
        'supplier_payment', p_payment_id, 'purchase', v_purchase.id, v_apply,
        'alloc:' || p_payment_id::text || ':' || v_purchase.id::text,
        p_actor, p_actor
      );

      v_remaining := v_remaining - v_apply;
    END LOOP;
  END IF;

  RETURN p_amount - v_remaining;
END;
$$;

REVOKE ALL ON FUNCTION public._allocate_supplier_payment(uuid, uuid, uuid, uuid, numeric, uuid, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- pay_supplier: allocate to purchases (FIFO or explicit)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_supplier(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_supplier_id uuid;
  v_purchase_id uuid;
  v_client_txn_key text;
  v_amount numeric(14, 2) := 0;
  v_payments jsonb;
  v_payment jsonb;
  v_pay_amount numeric(14, 2);
  v_fin_acct uuid;
  v_supplier public.suppliers%ROWTYPE;
  v_existing uuid;
  v_payment_id uuid := gen_random_uuid();
  v_entry_no text;
  v_journal_id uuid;
  v_pay_coa uuid;
  v_cash_coa uuid;
  v_note text;
  v_allow_advance boolean := false;
  v_allocated numeric(14, 2) := 0;
  v_skip_doc_update boolean := false;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('purchases.pay')
    OR public.user_has_permission('accounts.post')
    OR public.user_has_permission('supplier_due.pay')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to pay supplier' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_supplier_id := NULLIF(payload->>'supplier_id', '')::uuid;
  v_purchase_id := NULLIF(payload->>'purchase_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_note := coalesce(NULLIF(payload->>'notes', ''), NULLIF(payload->>'note', ''));

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  v_entry_no := 'SPAY-' || left(encode(extensions.digest(v_org_id::text || ':' || v_client_txn_key, 'sha256'), 'hex'), 24);

  SELECT id INTO v_existing
  FROM public.financial_transactions
  WHERE organization_id = v_org_id
    AND reference = v_entry_no
    AND status = 'posted'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('payment_id', v_existing, 'idempotent', true);
  END IF;

  SELECT * INTO v_supplier
  FROM public.suppliers s
  WHERE s.id = v_supplier_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;

  v_payments := public._normalize_money_payments(payload);
  IF jsonb_array_length(v_payments) < 1 THEN
    RAISE EXCEPTION 'At least one payment is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment amount';
    END IF;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
    IF v_fin_acct IS NULL THEN
      RAISE EXCEPTION 'Payment account is required';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.financial_accounts fa
      WHERE fa.id = v_fin_acct AND fa.organization_id = v_org_id
        AND fa.deleted_at IS NULL AND fa.is_active = true
    ) THEN
      RAISE EXCEPTION 'Invalid payment account';
    END IF;
    v_amount := v_amount + v_pay_amount;
  END LOOP;

  SELECT coalesce(settings->'simple_accounting'->>'allow_supplier_advance', 'false') = 'true'
  INTO v_allow_advance
  FROM public.organizations
  WHERE id = v_org_id;

  IF v_amount > v_supplier.current_due AND NOT coalesce(v_allow_advance, false) THEN
    RAISE EXCEPTION 'Payment % exceeds supplier due %', v_amount, v_supplier.current_due;
  END IF;

  IF v_purchase_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.purchases p
      WHERE p.id = v_purchase_id AND p.organization_id = v_org_id
        AND p.supplier_id = v_supplier_id AND p.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Invalid purchase_id';
    END IF;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
    LOOP
      INSERT INTO public.purchase_payments (
        organization_id, purchase_id, method, amount,
        financial_account_id, reference, created_by, updated_by
      ) VALUES (
        v_org_id, v_purchase_id,
        coalesce(NULLIF(btrim(v_payment->>'method'), ''), 'cash'),
        (v_payment->>'amount')::numeric,
        (v_payment->>'financial_account_id')::uuid,
        coalesce(NULLIF(v_payment->>'reference', ''), v_entry_no),
        v_profile_id, v_profile_id
      );
    END LOOP;

    UPDATE public.purchases
    SET paid_total = paid_total + v_amount,
        due_total = greatest(due_total - v_amount, 0),
        payment_status = CASE
          WHEN greatest(due_total - v_amount, 0) <= 0 THEN 'paid'
          WHEN paid_total + v_amount > 0 THEN 'partial'
          ELSE payment_status
        END,
        updated_by = v_profile_id
    WHERE id = v_purchase_id;

    v_skip_doc_update := true;
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    PERFORM public._post_financial_txn(
      v_org_id, v_branch_id,
      (v_payment->>'financial_account_id')::uuid,
      'supplier_payment', 'out',
      (v_payment->>'amount')::numeric,
      'supplier_payment', v_payment_id,
      v_entry_no,
      coalesce(v_note, 'Supplier payment'),
      v_profile_id,
      true
    );
  END LOOP;

  UPDATE public.suppliers
  SET current_due = current_due - v_amount,
      updated_by = v_profile_id
  WHERE id = v_supplier_id
  RETURNING * INTO v_supplier;

  INSERT INTO public.supplier_ledger (
    organization_id, branch_id, supplier_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_supplier_id, 'payment',
    0, v_amount, v_supplier.current_due,
    'supplier_payment', v_payment_id,
    coalesce(v_note, 'Supplier payment ' || v_client_txn_key),
    v_profile_id, v_profile_id
  );

  IF v_skip_doc_update THEN
    v_allocated := public._allocate_supplier_payment(
      v_org_id, v_branch_id, v_supplier_id, v_payment_id, v_amount, v_profile_id,
      v_purchase_id, NULL
    );
  ELSE
    v_allocated := public._allocate_supplier_payment(
      v_org_id, v_branch_id, v_supplier_id, v_payment_id, v_amount, v_profile_id,
      NULL, payload->'allocations'
    );
  END IF;

  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'bank');
  END IF;

  IF v_pay_coa IS NOT NULL AND v_cash_coa IS NOT NULL THEN
    v_journal_id := public._post_journal(
      v_org_id, v_branch_id,
      'JE-' || v_entry_no,
      'supplier_payment', v_payment_id,
      'Supplier payment ' || v_client_txn_key,
      jsonb_build_array(
        jsonb_build_object(
          'chart_account_id', v_pay_coa, 'debit', v_amount, 'credit', 0,
          'description', 'Payable reduced'
        ),
        jsonb_build_object(
          'chart_account_id', v_cash_coa, 'debit', 0, 'credit', v_amount,
          'description', 'Cash paid'
        )
      ),
      v_profile_id
    );
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'supplier_payment.create', 'supplier_payment', v_payment_id,
    NULL,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'amount', v_amount,
      'allocated', v_allocated,
      'client_txn_key', v_client_txn_key,
      'balance_after', v_supplier.current_due
    ),
    v_note,
    jsonb_build_object('source', 'pay_supplier')
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment_id,
    'journal_id', v_journal_id,
    'amount', v_amount,
    'allocated', v_allocated,
    'balance_after', v_supplier.current_due,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_supplier(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_supplier(jsonb) TO authenticated;
