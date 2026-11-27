-- Use the selected financial account chart mapping for each supplier payment journal credit.
-- This only changes future postings; historical journals require separate reviewed reconciliation.

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
  v_journal_lines jsonb := '[]'::jsonb;
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

  -- Serialize retries for the same organization/key before the idempotency lookup.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_org_id::text || ':' || v_client_txn_key, 0)
  );

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
    IF EXISTS (
      SELECT 1 FROM public.supplier_ledger sl
      WHERE sl.organization_id = v_org_id
        AND sl.reference_type = 'supplier_payment'
        AND sl.reference_id = coalesce(v_payment_id, v_existing)
        AND sl.supplier_id <> v_supplier_id
        AND sl.deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Payment key already belongs to another supplier';
    END IF;
    -- Durable idempotency requires the corresponding supplier ledger row.
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

    -- An orphan requires reviewed reconciliation; a retry must never alter history.
    RAISE EXCEPTION 'Payment reference requires reconciliation before retry';
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

  PERFORM public._validate_money_payment_accounts(v_org_id, v_branch_id, v_payments);

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
  IF v_pay_coa IS NULL THEN
    RAISE EXCEPTION 'Supplier payable chart account is not configured';
  END IF;

  v_journal_lines := jsonb_build_array(
    jsonb_build_object(
      'chart_account_id', v_pay_coa, 'debit', v_amount, 'credit', 0,
      'description', 'Payable reduced'
    )
  );
  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    SELECT fa.chart_account_id INTO v_cash_coa
    FROM public.financial_accounts fa
    JOIN public.chart_of_accounts coa
      ON coa.id = fa.chart_account_id
     AND coa.organization_id = v_org_id
     AND coa.deleted_at IS NULL
     AND coa.is_active
     AND coa.is_postable
     AND coa.account_type = 'asset'
    WHERE fa.id = (v_payment->>'financial_account_id')::uuid
      AND fa.organization_id = v_org_id
      AND fa.deleted_at IS NULL
      AND fa.is_active;

    IF v_cash_coa IS NULL THEN
      RAISE EXCEPTION 'Payment account has no eligible chart account';
    END IF;

    v_journal_lines := v_journal_lines || jsonb_build_array(
      jsonb_build_object(
        'chart_account_id', v_cash_coa,
        'financial_account_id', (v_payment->>'financial_account_id')::uuid,
        'debit', 0,
        'credit', (v_payment->>'amount')::numeric(14, 2),
        'description', 'Payment from selected account'
      )
    );
  END LOOP;

  v_journal_id := public._post_journal(
    v_org_id, v_branch_id,
    'JE-' || v_entry_no,
    'supplier_payment', v_payment_id,
    'Supplier payment ' || v_client_txn_key,
    v_journal_lines,
    v_profile_id
  );

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
