-- Supplier 360 Phase 1: financial integrity
-- - Harden pay_supplier idempotency (require ledger; repair orphan FT)
-- - Route approve_purchase_return through _post_supplier_ledger_entry
-- - Ledger statement RPC with opening/closing
-- - Audited dry-run + apply repair RPCs (opening sign, party sync)

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
  v_payment_id uuid;
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

  SELECT id, source_id INTO v_existing, v_payment_id
  FROM public.financial_transactions
  WHERE organization_id = v_org_id
    AND reference = v_entry_no
    AND status = 'posted'
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    -- Durable idempotency: require matching supplier_ledger row; repair if FT orphaned.
    IF EXISTS (
      SELECT 1 FROM public.supplier_ledger sl
      WHERE sl.organization_id = v_org_id
        AND sl.supplier_id = v_supplier_id
        AND sl.reference_type = 'supplier_payment'
        AND sl.reference_id = coalesce(v_payment_id, v_existing)
        AND sl.deleted_at IS NULL
    ) THEN
      RETURN jsonb_build_object(
        'payment_id', coalesce(v_payment_id, v_existing),
        'financial_transaction_id', v_existing,
        'idempotent', true
      );
    END IF;

    -- Orphan FT without ledger: reconstruct party effects using FT amount.
    SELECT coalesce(sum(ft.amount), 0) INTO v_amount
    FROM public.financial_transactions ft
    WHERE ft.organization_id = v_org_id
      AND ft.reference = v_entry_no
      AND ft.status = 'posted'
      AND ft.deleted_at IS NULL;

    IF v_payment_id IS NULL THEN
      v_payment_id := v_existing;
    END IF;

    SELECT * INTO v_supplier
    FROM public.suppliers s
    WHERE s.id = v_supplier_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN RAISE EXCEPTION 'Supplier not found'; END IF;

    IF v_amount > 0 THEN
      PERFORM public._post_supplier_ledger_entry(
        v_org_id, v_branch_id, v_supplier_id,
        'supplier_payment', 0, v_amount,
        'supplier_payment', v_payment_id,
        coalesce(v_note, 'Supplier payment repair ' || v_client_txn_key),
        v_profile_id
      );
      v_allocated := public._allocate_supplier_payment(
        v_org_id, v_branch_id, v_supplier_id, v_payment_id, v_amount, v_profile_id,
        v_purchase_id, payload->'allocations'
      );
    END IF;

    SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_supplier_id;

    RETURN jsonb_build_object(
      'payment_id', v_payment_id,
      'financial_transaction_id', v_existing,
      'amount', v_amount,
      'allocated', v_allocated,
      'balance_after', v_supplier.current_due,
      'idempotent', true,
      'repaired', true
    );
  END IF;

  v_payment_id := gen_random_uuid();

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

  PERFORM public._post_supplier_ledger_entry(
    v_org_id, v_branch_id, v_supplier_id,
    'supplier_payment', 0, v_amount,
    'supplier_payment', v_payment_id,
    coalesce(v_note, 'Supplier payment ' || v_client_txn_key),
    v_profile_id
  );

  SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_supplier_id;

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




-- Patched approve_purchase_return (ledger helper)
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
    PERFORM public._post_supplier_ledger_entry(
      v_org_id, v_branch_id, v_purchase.supplier_id,
      'return_credit', 0, v_due_reduce,
      'purchase_return', v_return_id,
      coalesce(v_reason, 'Purchase return ' || v_return_no),
      v_profile_id
    );
    SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_purchase.supplier_id;

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


-- ---------------------------------------------------------------------------
-- get_supplier_ledger_statement
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_supplier_ledger_statement(
  p_supplier_id uuid,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL,
  p_entry_types text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_page int := GREATEST(coalesce(p_page, 1), 1);
  v_size int := LEAST(GREATEST(coalesce(p_page_size, 50), 1), 200);
  v_search text := NULLIF(trim(p_search), '');
  v_opening numeric(14,2) := 0;
  v_purchases numeric(14,2) := 0;
  v_payments numeric(14,2) := 0;
  v_returns numeric(14,2) := 0;
  v_adjustments numeric(14,2) := 0;
  v_closing numeric(14,2) := 0;
  v_count int := 0;
  v_lines jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Organization context required';
  END IF;
  IF NOT (
    public.user_has_permission('suppliers.read')
    OR public.user_has_permission('accounts.read')
    OR public.user_has_permission('purchases.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = p_supplier_id AND s.organization_id = v_org AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  -- Opening = sum(debit-credit) before p_from
  IF p_from IS NOT NULL THEN
    SELECT coalesce(sum(sl.debit - sl.credit), 0) INTO v_opening
    FROM public.supplier_ledger sl
    WHERE sl.supplier_id = p_supplier_id
      AND sl.organization_id = v_org
      AND sl.deleted_at IS NULL
      AND sl.occurred_at < p_from
      AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id OR public.user_has_branch_access(sl.branch_id));
  ELSE
    v_opening := 0;
  END IF;

  WITH filtered AS (
    SELECT
      sl.*,
      sl.debit AS due_increase,
      sl.credit AS due_decrease
    FROM public.supplier_ledger sl
    WHERE sl.supplier_id = p_supplier_id
      AND sl.organization_id = v_org
      AND sl.deleted_at IS NULL
      AND (p_from IS NULL OR sl.occurred_at >= p_from)
      AND (p_to IS NULL OR sl.occurred_at <= p_to)
      AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id)
      AND (p_branch_id IS NOT NULL OR sl.branch_id IS NULL OR public.user_has_branch_access(sl.branch_id))
      AND (p_entry_types IS NULL OR sl.entry_type = ANY(p_entry_types))
      AND (
        v_search IS NULL
        OR coalesce(sl.notes, '') ILIKE '%' || v_search || '%'
        OR coalesce(sl.reference_type, '') ILIKE '%' || v_search || '%'
        OR coalesce(sl.entry_type, '') ILIKE '%' || v_search || '%'
      )
  ),
  ordered AS (
    SELECT
      f.*,
      v_opening + sum(f.due_increase - f.due_decrease) OVER (
        ORDER BY f.occurred_at ASC, f.id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS running_balance
    FROM filtered f
  ),
  totals AS (
    SELECT
      coalesce(sum(due_increase) FILTER (
        WHERE entry_type IN ('purchase_invoice', 'purchase_due')
      ), 0) AS purchases,
      coalesce(sum(due_decrease) FILTER (
        WHERE entry_type IN ('supplier_payment', 'purchase_payment', 'payment')
      ), 0) AS payments,
      coalesce(sum(due_decrease) FILTER (
        WHERE entry_type IN ('return_credit', 'refund')
      ), 0) AS returns,
      coalesce(sum(due_increase - due_decrease) FILTER (
        WHERE entry_type IN ('adjustment', 'opening', 'reversal')
      ), 0) AS adjustments,
      count(*)::int AS total_count
    FROM ordered
  ),
  page AS (
    SELECT *
    FROM ordered
    ORDER BY occurred_at DESC, id DESC
    OFFSET (v_page - 1) * v_size
    LIMIT v_size
  )
  SELECT
    t.purchases, t.payments, t.returns, t.adjustments, t.total_count,
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'occurred_at', p.occurred_at,
        'branch_id', p.branch_id,
        'entry_type', p.entry_type,
        'reference_type', p.reference_type,
        'reference_id', p.reference_id,
        'notes', p.notes,
        'due_increase', p.due_increase,
        'due_decrease', p.due_decrease,
        'running_balance', p.running_balance
      )
      ORDER BY p.occurred_at DESC, p.id DESC
    ) FILTER (WHERE p.id IS NOT NULL), '[]'::jsonb)
  INTO v_purchases, v_payments, v_returns, v_adjustments, v_count, v_lines
  FROM totals t
  LEFT JOIN page p ON true
  GROUP BY t.purchases, t.payments, t.returns, t.adjustments, t.total_count;

  v_closing := v_opening + coalesce(v_purchases,0) - coalesce(v_payments,0) - coalesce(v_returns,0) + coalesce(v_adjustments,0);
  -- More accurate closing from last running balance in period or opening
  SELECT coalesce(
    (SELECT o.running_balance FROM (
       SELECT v_opening + sum(sl.debit - sl.credit) OVER (ORDER BY sl.occurred_at ASC, sl.id ASC) AS running_balance,
              row_number() OVER (ORDER BY sl.occurred_at DESC, sl.id DESC) AS rn
       FROM public.supplier_ledger sl
       WHERE sl.supplier_id = p_supplier_id
         AND sl.organization_id = v_org
         AND sl.deleted_at IS NULL
         AND (p_from IS NULL OR sl.occurred_at >= p_from)
         AND (p_to IS NULL OR sl.occurred_at <= p_to)
         AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id)
     ) o WHERE o.rn = 1),
    v_opening
  ) INTO v_closing;

  RETURN jsonb_build_object(
    'supplier_id', p_supplier_id,
    'opening_balance', v_opening,
    'total_purchases', coalesce(v_purchases, 0),
    'total_payments', coalesce(v_payments, 0),
    'total_returns', coalesce(v_returns, 0),
    'total_adjustments', coalesce(v_adjustments, 0),
    'closing_due', coalesce(v_closing, v_opening),
    'page', v_page,
    'page_size', v_size,
    'total_count', coalesce(v_count, 0),
    'lines', coalesce(v_lines, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_ledger_statement(uuid, timestamptz, timestamptz, uuid, text[], text, int, int) TO authenticated;

-- ---------------------------------------------------------------------------
-- Financial repair: dry-run + apply (1B)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recon_supplier_financial_dry_run(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_wrong_openings jsonb;
  v_party_vs_ledger jsonb;
  v_party_vs_invoices jsonb;
  v_orphan_ft jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('accounts.manage') THEN
    RAISE EXCEPTION 'accounts.manage required' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'ledger_id', sl.id,
    'supplier_id', sl.supplier_id,
    'supplier_name', s.name,
    'credit', sl.credit,
    'occurred_at', sl.occurred_at
  )), '[]'::jsonb)
  INTO v_wrong_openings
  FROM public.supplier_ledger sl
  JOIN public.suppliers s ON s.id = sl.supplier_id
  WHERE sl.organization_id = v_org_id
    AND sl.deleted_at IS NULL
    AND sl.entry_type = 'opening'
    AND sl.credit > 0
    AND sl.debit = 0;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'supplier_id', s.id,
    'name', s.name,
    'current_due', s.current_due,
    'ledger_sum', coalesce(x.ledger_sum, 0),
    'delta', s.current_due - coalesce(x.ledger_sum, 0)
  )), '[]'::jsonb)
  INTO v_party_vs_ledger
  FROM public.suppliers s
  LEFT JOIN LATERAL (
    SELECT sum(sl.debit - sl.credit) AS ledger_sum
    FROM public.supplier_ledger sl
    WHERE sl.supplier_id = s.id AND sl.deleted_at IS NULL
  ) x ON true
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND abs(s.current_due - coalesce(x.ledger_sum, 0)) > 0.009;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'supplier_id', s.id,
    'name', s.name,
    'party_due', s.current_due,
    'open_purchase_due', coalesce(p.open_due, 0),
    'delta', s.current_due - coalesce(p.open_due, 0)
  )), '[]'::jsonb)
  INTO v_party_vs_invoices
  FROM public.suppliers s
  LEFT JOIN LATERAL (
    SELECT sum(pu.due_total) AS open_due
    FROM public.purchases pu
    WHERE pu.supplier_id = s.id
      AND pu.organization_id = v_org_id
      AND pu.deleted_at IS NULL
      AND pu.status = 'completed'
      AND pu.due_total > 0
  ) p ON true
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND abs(s.current_due - coalesce(p.open_due, 0)) > 0.009;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'ft_id', ft.id,
    'reference', ft.reference,
    'amount', ft.amount,
    'source_id', ft.source_id,
    'created_at', ft.created_at
  )), '[]'::jsonb)
  INTO v_orphan_ft
  FROM public.financial_transactions ft
  WHERE ft.organization_id = v_org_id
    AND ft.transaction_type = 'supplier_payment'
    AND ft.status = 'posted'
    AND ft.deleted_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.supplier_ledger sl
      WHERE sl.organization_id = v_org_id
        AND sl.reference_type = 'supplier_payment'
        AND sl.reference_id = coalesce(ft.source_id, ft.id)
        AND sl.deleted_at IS NULL
    );

  RETURN jsonb_build_object(
    'mode', 'dry_run',
    'organization_id', v_org_id,
    'wrong_opening_credits', v_wrong_openings,
    'party_vs_ledger_deltas', v_party_vs_ledger,
    'party_vs_invoice_deltas', v_party_vs_invoices,
    'orphan_financial_transactions', v_orphan_ft,
    'generated_at', timezone('utc', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_supplier_opening_sign(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text := coalesce(payload->>'mode', 'dry_run');
  v_client_txn_key text := coalesce(NULLIF(btrim(payload->>'client_txn_key'), ''), 'repair-opening-' || gen_random_uuid()::text);
  r record;
  v_fixed int := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('accounts.manage') THEN
    RAISE EXCEPTION 'accounts.manage required' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT sl.*
    FROM public.supplier_ledger sl
    WHERE sl.organization_id = v_org_id
      AND sl.deleted_at IS NULL
      AND sl.entry_type = 'opening'
      AND sl.credit > 0
      AND sl.debit = 0
    ORDER BY sl.occurred_at, sl.id
  LOOP
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'ledger_id', r.id,
      'supplier_id', r.supplier_id,
      'credit', r.credit
    ));
    IF v_mode = 'apply' THEN
      UPDATE public.supplier_ledger
      SET deleted_at = timezone('utc', now()),
          notes = coalesce(notes, '') || format(' [superseded opening-sign repair %s]', v_client_txn_key),
          updated_by = v_profile_id
      WHERE id = r.id;

      PERFORM public._post_supplier_ledger_entry(
        v_org_id, r.branch_id, r.supplier_id,
        'opening', r.credit, 0,
        coalesce(r.reference_type, 'opening_repair'), coalesce(r.reference_id, r.id),
        format('Corrected opening (was credit) · %s', v_client_txn_key),
        v_profile_id
      );
      PERFORM public._sync_supplier_ledger_totals(r.supplier_id);
      v_fixed := v_fixed + 1;
    END IF;
  END LOOP;

  IF v_mode = 'apply' THEN
    PERFORM public.write_audit_log(
      v_org_id, NULL, v_profile_id,
      'supplier_repair.opening_sign', 'supplier_repair', NULL,
      NULL,
      jsonb_build_object('fixed', v_fixed, 'client_txn_key', v_client_txn_key, 'items', v_items),
      'Supplier opening sign repair',
      jsonb_build_object('source', 'repair_supplier_opening_sign')
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'fixed_count', CASE WHEN v_mode = 'apply' THEN v_fixed ELSE jsonb_array_length(v_items) END,
    'items', v_items,
    'client_txn_key', v_client_txn_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_supplier_party_sync(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text := coalesce(payload->>'mode', 'dry_run');
  v_client_txn_key text := coalesce(NULLIF(btrim(payload->>'client_txn_key'), ''), 'repair-party-sync-' || gen_random_uuid()::text);
  r record;
  v_fixed int := 0;
  v_items jsonb := '[]'::jsonb;
  v_ledger_sum numeric(14,2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('accounts.manage') THEN
    RAISE EXCEPTION 'accounts.manage required' USING ERRCODE = '42501';
  END IF;

  FOR r IN
    SELECT s.id, s.name, s.current_due,
           coalesce((
             SELECT sum(sl.debit - sl.credit)
             FROM public.supplier_ledger sl
             WHERE sl.supplier_id = s.id AND sl.deleted_at IS NULL
           ), 0) AS ledger_sum
    FROM public.suppliers s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
  LOOP
    IF abs(r.current_due - r.ledger_sum) > 0.009 THEN
      v_items := v_items || jsonb_build_array(jsonb_build_object(
        'supplier_id', r.id,
        'name', r.name,
        'current_due', r.current_due,
        'ledger_sum', greatest(0, r.ledger_sum),
        'delta', r.current_due - greatest(0, r.ledger_sum)
      ));
      IF v_mode = 'apply' THEN
        PERFORM public._sync_supplier_ledger_totals(r.id);
        v_fixed := v_fixed + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_mode = 'apply' THEN
    PERFORM public.write_audit_log(
      v_org_id, NULL, v_profile_id,
      'supplier_repair.party_sync', 'supplier_repair', NULL,
      NULL,
      jsonb_build_object('fixed', v_fixed, 'client_txn_key', v_client_txn_key, 'items', v_items),
      'Supplier party due sync from ledger',
      jsonb_build_object('source', 'repair_supplier_party_sync')
    );
  END IF;

  RETURN jsonb_build_object(
    'mode', v_mode,
    'fixed_count', CASE WHEN v_mode = 'apply' THEN v_fixed ELSE jsonb_array_length(v_items) END,
    'items', v_items,
    'client_txn_key', v_client_txn_key
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.recon_supplier_financial_dry_run(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_supplier_opening_sign(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.repair_supplier_party_sync(jsonb) TO authenticated;
