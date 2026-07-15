-- Glamourous by Mahi · Retail ERP
-- Migration 012: Harden simple retail accounting RPCs
-- - Accept flat due-collection / supplier-payment payloads from the UI
-- - Write financial_transactions for collections, supplier payments, and POS sale payments
-- - Make journal/CoA posting optional (simple retail path does not require Chart of Accounts)
-- - Seed practical income/expense categories for all orgs

--------------------------------------------------------------------------------
-- Expand retail category seeds (every org)
--------------------------------------------------------------------------------
INSERT INTO public.income_categories (organization_id, name, is_active, sort_order)
SELECT o.id, v.name, true, v.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('Other Income', 10),
  ('Delivery Income', 20),
  ('Service Charge', 30),
  ('Commission Income', 40),
  ('Investment', 50),
  ('Miscellaneous', 60),
  ('Deposit', 70)
) AS v(name, sort_order)
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.income_categories c
    WHERE c.organization_id = o.id
      AND lower(c.name) = lower(v.name)
      AND c.deleted_at IS NULL
  );

INSERT INTO public.expense_categories (organization_id, name, is_active, sort_order)
SELECT o.id, v.name, true, v.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('Shop Rent', 10),
  ('Salary', 20),
  ('Electricity', 30),
  ('Internet', 40),
  ('Courier', 50),
  ('Transport', 60),
  ('Marketing', 70),
  ('Packaging', 80),
  ('Maintenance', 90),
  ('Office Expense', 100),
  ('Staff Expense', 110),
  ('Miscellaneous', 120),
  ('Withdraw', 130)
) AS v(name, sort_order)
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.expense_categories c
    WHERE c.organization_id = o.id
      AND lower(c.name) = lower(v.name)
      AND c.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Helper: post a money movement with running balance
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._post_financial_txn(
  p_organization_id uuid,
  p_branch_id uuid,
  p_account_id uuid,
  p_transaction_type text,
  p_direction text,
  p_amount numeric,
  p_source_type text,
  p_source_id uuid,
  p_reference text,
  p_note text,
  p_created_by uuid,
  p_apply_balance boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before numeric(14, 2);
  v_after numeric(14, 2);
  v_txn_id uuid;
  v_allow_neg boolean := false;
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'account_id is required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;
  IF p_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'direction must be in or out';
  END IF;

  SELECT current_balance INTO v_before
  FROM public.financial_accounts
  WHERE id = p_account_id
    AND organization_id = p_organization_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial account not found';
  END IF;

  IF p_apply_balance THEN
    IF p_direction = 'in' THEN
      v_after := round(v_before + p_amount, 2);
    ELSE
      SELECT coalesce(settings->'simple_accounting'->>'allow_negative_balance', 'false') = 'true'
      INTO v_allow_neg
      FROM public.organizations
      WHERE id = p_organization_id;

      v_after := round(v_before - p_amount, 2);
      IF v_after < 0 AND NOT coalesce(v_allow_neg, false) THEN
        RAISE EXCEPTION 'Insufficient balance on selected account';
      END IF;
    END IF;

    UPDATE public.financial_accounts
    SET current_balance = v_after,
        updated_by = p_created_by,
        updated_at = timezone('utc', now())
    WHERE id = p_account_id;
  ELSE
    -- Balance already adjusted by caller; current row balance is after
    v_after := v_before;
    IF p_direction = 'in' THEN
      v_before := round(v_after - p_amount, 2);
    ELSE
      v_before := round(v_after + p_amount, 2);
    END IF;
  END IF;

  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, transaction_date, note, status, created_by
  ) VALUES (
    p_organization_id, p_branch_id, p_account_id, p_transaction_type, p_direction,
    p_amount, v_before, v_after,
    p_source_type, p_source_id,
    p_reference, timezone('utc', now()), p_note, 'posted', p_created_by
  )
  RETURNING id INTO v_txn_id;

  RETURN v_txn_id;
END;
$$;

REVOKE ALL ON FUNCTION public._post_financial_txn(uuid, uuid, uuid, text, text, numeric, text, uuid, text, text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._post_financial_txn(uuid, uuid, uuid, text, text, numeric, text, uuid, text, text, uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public._post_financial_txn(uuid, uuid, uuid, text, text, numeric, text, uuid, text, text, uuid, boolean) TO service_role;

--------------------------------------------------------------------------------
-- Normalize payments array from flat or nested payload
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._normalize_money_payments(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_amount numeric;
  v_account uuid;
  v_method text;
  v_ref text;
BEGIN
  IF jsonb_typeof(payload->'payments') = 'array'
     AND jsonb_array_length(payload->'payments') >= 1 THEN
    RETURN payload->'payments';
  END IF;

  v_amount := coalesce(
    NULLIF(payload->>'amount', '')::numeric,
    NULLIF(payload->'payment'->>'amount', '')::numeric
  );
  v_account := coalesce(
    NULLIF(payload->>'financial_account_id', '')::uuid,
    NULLIF(payload->'payment'->>'financial_account_id', '')::uuid
  );
  v_method := coalesce(
    NULLIF(btrim(payload->>'payment_method'), ''),
    NULLIF(btrim(payload->>'method'), ''),
    NULLIF(btrim(payload->'payment'->>'method'), ''),
    'cash'
  );
  v_ref := coalesce(
    NULLIF(payload->>'reference', ''),
    NULLIF(payload->'payment'->>'reference', '')
  );

  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN jsonb_build_array(jsonb_build_object(
    'amount', v_amount,
    'financial_account_id', v_account,
    'method', v_method,
    'reference', v_ref
  ));
END;
$$;

--------------------------------------------------------------------------------
-- collect_customer_due — simple retail friendly
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.collect_customer_due(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_method text;
  v_allow_advance boolean := false;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.post')
    OR public.user_has_permission('sales.read')
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
    v_client_txn_key := 'auto:' || gen_random_uuid()::text;
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
    RETURN jsonb_build_object(
      'collection_id', v_existing,
      'idempotent', true
    );
  END IF;

  -- Legacy journal idempotency
  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE organization_id = v_org_id
    AND entry_no = 'JE-' || v_entry_no
    AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'collection_id', v_existing,
      'journal_id', v_existing,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_customer
  FROM public.customers c
  WHERE c.id = v_customer_id
    AND c.organization_id = v_org_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
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

  FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
  LOOP
    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := (v_payment->>'financial_account_id')::uuid;
    v_method := coalesce(NULLIF(btrim(v_payment->>'method'), ''), 'cash');

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

  -- Optional double-entry mirror when CoA exists
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'bank');
  END IF;
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'mobile_money');
  END IF;
  v_recv_coa := public._coa_by_role(v_org_id, 'receivable');

  IF v_cash_coa IS NOT NULL AND v_recv_coa IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, 'JE-' || v_entry_no, (timezone('utc', now()))::date, 'posted',
      'collection', v_collection_id,
      'Customer due collection ' || v_client_txn_key,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
    LOOP
      v_pay_amount := (v_payment->>'amount')::numeric;
      v_fin_acct := (v_payment->>'financial_account_id')::uuid;
      SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id, financial_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id,
        coalesce(v_fa.chart_account_id, v_cash_coa),
        v_fin_acct,
        'Cash collected', v_pay_amount, 0, v_line_no, v_profile_id, v_profile_id
      );
    END LOOP;

    v_line_no := v_line_no + 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_recv_coa,
      'Receivable reduced', 0, v_amount, v_line_no, v_profile_id, v_profile_id
    );
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'collection.create', 'collection', v_collection_id,
    NULL,
    jsonb_build_object(
      'customer_id', v_customer_id,
      'amount', v_amount,
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
    'balance_after', v_customer.current_due,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.collect_customer_due(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.collect_customer_due(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- pay_supplier — simple retail friendly
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pay_supplier(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_line_no int := 0;
  v_fa public.financial_accounts%ROWTYPE;
  v_note text;
  v_allow_advance boolean := false;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('purchases.read')
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

  IF v_client_txn_key IS NULL THEN
    v_client_txn_key := 'auto:' || gen_random_uuid()::text;
  END IF;

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

  SELECT id INTO v_existing
  FROM public.journal_entries
  WHERE organization_id = v_org_id
    AND entry_no = 'JE-' || v_entry_no
    AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('payment_id', v_existing, 'journal_id', v_existing, 'idempotent', true);
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

  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN
    v_cash_coa := public._coa_by_role(v_org_id, 'bank');
  END IF;

  IF v_pay_coa IS NOT NULL AND v_cash_coa IS NOT NULL THEN
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, 'JE-' || v_entry_no, (timezone('utc', now()))::date, 'posted',
      'supplier_payment', v_payment_id,
      'Supplier payment ' || v_client_txn_key,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    v_line_no := 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_pay_coa,
      'Payable reduced', v_amount, 0, v_line_no, v_profile_id, v_profile_id
    );

    FOR v_payment IN SELECT * FROM jsonb_array_elements(v_payments)
    LOOP
      v_pay_amount := (v_payment->>'amount')::numeric;
      v_fin_acct := (v_payment->>'financial_account_id')::uuid;
      SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id, financial_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id,
        coalesce(v_fa.chart_account_id, v_cash_coa),
        v_fin_acct,
        'Cash paid', 0, v_pay_amount, v_line_no, v_profile_id, v_profile_id
      );
    END LOOP;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'supplier_payment.create', 'supplier_payment', v_payment_id,
    NULL,
    jsonb_build_object(
      'supplier_id', v_supplier_id,
      'amount', v_amount,
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
    'balance_after', v_supplier.current_due,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_supplier(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pay_supplier(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Wrap complete_pos_sale to also write financial_transactions for cash/bank payments
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'complete_pos_sale'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_complete_pos_sale_core'
  ) THEN
    ALTER FUNCTION public.complete_pos_sale(jsonb) RENAME TO _complete_pos_sale_core;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_pos_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_sale_id uuid;
  v_idempotent boolean;
  r record;
  v_is_due boolean;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_complete_pos_sale_core'
  ) THEN
    RAISE EXCEPTION 'POS sale core function missing';
  END IF;

  v_result := public._complete_pos_sale_core(payload);
  v_sale_id := NULLIF(v_result->>'sale_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_sale_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  FOR r IN
    SELECT
      sp.id AS payment_id,
      sp.amount,
      sp.method,
      sp.financial_account_id,
      sp.reference,
      s.organization_id,
      s.branch_id,
      s.invoice_no,
      s.created_by
    FROM public.sale_payments sp
    JOIN public.sales s ON s.id = sp.sale_id
    WHERE sp.sale_id = v_sale_id
      AND sp.financial_account_id IS NOT NULL
      AND sp.deleted_at IS NULL
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = r.organization_id
      AND lower(pm.code) = lower(r.method)
      AND pm.deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      v_is_due := (lower(r.method) IN ('due', 'credit', 'receivable'));
    END IF;

    IF v_is_due THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.source_type = 'sale'
        AND ft.source_id = v_sale_id
        AND ft.account_id = r.financial_account_id
        AND ft.amount = r.amount
        AND ft.status = 'posted'
        AND ft.deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    -- Balance already adjusted by core RPC — record ledger only
    PERFORM public._post_financial_txn(
      r.organization_id,
      r.branch_id,
      r.financial_account_id,
      'sale_payment',
      'in',
      r.amount,
      'sale',
      v_sale_id,
      coalesce(r.reference, r.invoice_no),
      'Sale payment ' || coalesce(r.invoice_no, ''),
      r.created_by,
      false
    );
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._complete_pos_sale_core(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public._complete_pos_sale_core(jsonb) TO service_role;

-- Grant accounting fine-grained perms to Owner + Super Admin (idempotent)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)
  AND p.key IN (
    'accounts.manage', 'income.create', 'expense.create', 'expense.approve',
    'customer_due.collect', 'supplier_due.pay', 'transactions.void',
    'daily_closing.create', 'daily_closing.approve', 'profit_loss.read',
    'account_settings.manage', 'accounts.read', 'accounts.post'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );
