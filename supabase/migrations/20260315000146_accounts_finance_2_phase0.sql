-- Accounts & Finance 2.0 — Phase 0 financial integrity
-- 1) POS sale payments apply FA balance (apply_balance=true)
-- 2) void/edit mark sale FTs voided without double-adjusting balance
-- 3) Non-P&L cash deposit/withdrawal RPC
-- 4) close_business_day recognizes customer_collection

--------------------------------------------------------------------------------
-- complete_pos_sale: credit FA when posting sale_payment FT
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_pos_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_sale_id uuid;
  v_idempotent boolean;
  r record;
  v_is_due boolean;
  v_branch_id uuid;
  v_sp record;
BEGIN
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;

  v_result := public._complete_pos_sale_core(payload);
  v_sale_id := NULLIF(v_result->>'sale_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_sale_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_sp
  FROM public._resolve_pos_salesperson(payload, v_branch_id);

  UPDATE public.sales s
  SET salesperson_employee_id = v_sp.employee_id,
      salesperson_id = coalesce(v_sp.profile_id, s.salesperson_id),
      updated_at = timezone('utc', now())
  WHERE s.id = v_sale_id;

  PERFORM public._link_sale_commission_employees(v_sale_id);
  PERFORM public._record_commission_attribution_exception(v_sale_id);

  FOR r IN
    SELECT
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
    ORDER BY sp.created_at ASC, sp.id ASC
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

    IF v_is_due THEN CONTINUE; END IF;

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

    -- apply_balance=true so Cash & Bank reflects POS receipts
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
      true
    );
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Helper: mark sale FTs voided without a second balance adjust
-- (void_sale / edit_sale already reverse FA via payment loop)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._void_sale_financial_transactions(
  p_sale_id uuid,
  p_actor uuid,
  p_reason text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.financial_transactions ft
  SET status = 'voided',
      voided_at = timezone('utc', now()),
      voided_by = p_actor,
      void_reason = left(coalesce(NULLIF(btrim(p_reason), ''), 'Sale voided'), 500),
      updated_at = timezone('utc', now())
  WHERE ft.source_type = 'sale'
    AND ft.source_id = p_sale_id
    AND ft.deleted_at IS NULL
    AND coalesce(ft.status, 'posted') = 'posted'
    AND ft.voided_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN coalesce(v_count, 0);
END;
$$;

REVOKE ALL ON FUNCTION public._void_sale_financial_transactions(uuid, uuid, text) FROM PUBLIC;

--------------------------------------------------------------------------------
-- Patch void_sale: after FA reverse via payments, void cash-book rows (no 2nd adjust)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_sale(sale_id uuid, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_location_id uuid;
  v_is_due boolean;
  v_cogs_total numeric(14, 2) := 0;
  v_rev_journal uuid;
  v_comm_reversed numeric(14, 2) := 0;
  v_ft_voided integer := 0;
  v_sale_date date;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.void') THEN
    RAISE EXCEPTION 'Missing permission sales.void' USING ERRCODE = '42501';
  END IF;

  IF sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;
  IF reason IS NULL OR btrim(reason) = '' THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;

  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be voided';
  END IF;

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  PERFORM public._assert_sale_period_open(v_org_id, v_sale_date);

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN
    SELECT * FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
  LOOP
    v_cogs_total := v_cogs_total + round(v_item.qty * v_item.cost_price, 2);
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      v_item.qty, v_item.cost_price, 'correction', 'sale', v_sale.id,
      v_profile_id, 'Void sale restock'
    );
  END LOOP;

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL AND sp.reversed_at IS NULL
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = lower(v_payment.method)
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      v_is_due := (lower(v_payment.method) IN ('due', 'credit', 'receivable'));
    END IF;

    IF NOT v_is_due AND v_payment.financial_account_id IS NOT NULL THEN
      UPDATE public.financial_accounts
      SET current_balance = current_balance - v_payment.amount,
          updated_by = v_profile_id
      WHERE id = v_payment.financial_account_id;
    END IF;

    UPDATE public.sale_payments
    SET reversed_at = timezone('utc', now()),
        reversal_note = btrim(reason),
        updated_by = v_profile_id
    WHERE id = v_payment.id;
  END LOOP;

  -- Mark cash-book rows voided (balance already reversed above)
  v_ft_voided := public._void_sale_financial_transactions(v_sale.id, v_profile_id, reason);

  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, btrim(reason));
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
    v_profile_id
  );

  v_comm_reversed := public._reverse_remaining_sale_commissions(
    v_sale.id, 'sale_void', v_sale.id, btrim(reason), v_profile_id
  );

  UPDATE public.sales
  SET status = 'voided',
      voided_at = timezone('utc', now()),
      void_reason = btrim(reason),
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.void', 'sale', v_sale.id,
    jsonb_build_object('status', 'completed', 'grand_total', v_sale.grand_total),
    jsonb_build_object(
      'status', 'voided',
      'reason', btrim(reason),
      'reversing_journal_id', v_rev_journal,
      'commission_reversed', v_comm_reversed,
      'ft_voided', v_ft_voided
    ),
    btrim(reason),
    jsonb_build_object('source', 'void_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'status', 'voided',
    'reversing_journal_id', v_rev_journal,
    'cogs_reversed', v_cogs_total,
    'commission_reversed', v_comm_reversed,
    'ft_voided', v_ft_voided
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- Non-P&L cash deposit / withdrawal (pure cash-book movement)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_account_cash_movement(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_account_id uuid;
  v_direction text;
  v_amount numeric(14, 2);
  v_note text;
  v_client_txn_key text;
  v_reference text;
  v_txn_type text;
  v_txn_id uuid;
  v_existing uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.post')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission accounts.post or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_account_id := NULLIF(payload->>'account_id', '')::uuid;
  v_direction := lower(coalesce(NULLIF(btrim(payload->>'direction'), ''), ''));
  v_amount := coalesce(NULLIF(payload->>'amount', '')::numeric, 0);
  v_note := NULLIF(btrim(payload->>'note'), '');
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'account_id is required'; END IF;
  IF v_direction NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'direction must be in (deposit) or out (withdraw)';
  END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;
  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.financial_accounts fa
    WHERE fa.id = v_account_id
      AND fa.organization_id = v_org_id
      AND fa.deleted_at IS NULL
      AND fa.is_active = true
  ) THEN
    RAISE EXCEPTION 'Financial account not found or inactive';
  END IF;

  v_txn_type := CASE WHEN v_direction = 'in' THEN 'cash_deposit' ELSE 'cash_withdrawal' END;
  v_reference := CASE
    WHEN v_client_txn_key IS NOT NULL THEN 'CTX:' || v_client_txn_key
    ELSE NULL
  END;

  IF v_reference IS NOT NULL THEN
    SELECT id INTO v_existing
    FROM public.financial_transactions
    WHERE organization_id = v_org_id
      AND reference = v_reference
      AND deleted_at IS NULL
      AND coalesce(status, 'posted') = 'posted'
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN jsonb_build_object(
        'transaction_id', v_existing,
        'idempotent', true,
        'transaction_type', v_txn_type,
        'direction', v_direction
      );
    END IF;
  END IF;

  v_txn_id := public._post_financial_txn(
    v_org_id,
    v_branch_id,
    v_account_id,
    v_txn_type,
    v_direction,
    v_amount,
    'cash_movement',
    NULL,
    v_reference,
    coalesce(v_note, CASE WHEN v_direction = 'in' THEN 'Cash deposit' ELSE 'Cash withdrawal' END),
    v_profile_id,
    true
  );

  RETURN jsonb_build_object(
    'transaction_id', v_txn_id,
    'idempotent', false,
    'transaction_type', v_txn_type,
    'direction', v_direction,
    'amount', v_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.post_account_cash_movement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.post_account_cash_movement(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- close_business_day: include customer_collection (+ cash deposit/withdrawal)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_business_day(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_closing_date date;
  v_opening_cash numeric(14, 2);
  v_cash_sales numeric(14, 2);
  v_cash_collections numeric(14, 2);
  v_other_cash_income numeric(14, 2);
  v_cash_expenses numeric(14, 2);
  v_supplier_cash_payments numeric(14, 2);
  v_cash_transfers_net numeric(14, 2);
  v_counted_cash numeric(14, 2);
  v_expected numeric(14, 2);
  v_difference numeric(14, 2);
  v_note text;
  v_diff_reason text;
  v_existing uuid;
  v_closing_id uuid;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_computed_in numeric(14, 2);
  v_computed_out numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('daily_closing.create')
    OR public.user_has_permission('accounts.manage')
    OR public.user_has_permission('accounts.post')
  ) THEN
    RAISE EXCEPTION 'Missing permission daily_closing.create, accounts.manage, or accounts.post'
      USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_closing_date := NULLIF(payload->>'closing_date', '')::date;
  v_counted_cash := coalesce(NULLIF(payload->>'counted_cash', '')::numeric, 0);
  v_note := NULLIF(payload->>'note', '');
  v_diff_reason := NULLIF(payload->>'difference_reason', '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_closing_date IS NULL THEN RAISE EXCEPTION 'closing_date is required'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing
  FROM public.daily_closings
  WHERE branch_id = v_branch_id
    AND closing_date = v_closing_date
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Daily closing already exists for branch % on %', v_branch_id, v_closing_date;
  END IF;

  v_day_start := (v_closing_date::timestamp AT TIME ZONE 'Asia/Dhaka');
  v_day_end := v_day_start + interval '1 day';

  IF payload ? 'opening_cash' AND NULLIF(payload->>'opening_cash', '') IS NOT NULL THEN
    v_opening_cash := (payload->>'opening_cash')::numeric;
  ELSE
    SELECT coalesce(sum(fa.opening_balance), 0) INTO v_opening_cash
    FROM public.financial_accounts fa
    WHERE fa.organization_id = v_org_id
      AND fa.deleted_at IS NULL
      AND fa.account_kind = 'cash'
      AND (fa.branch_id IS NULL OR fa.branch_id = v_branch_id);
  END IF;

  IF payload ? 'cash_sales' AND NULLIF(payload->>'cash_sales', '') IS NOT NULL THEN
    v_cash_sales := (payload->>'cash_sales')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_sales
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('sale_payment', 'pos_payment', 'sale')
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_collections' AND NULLIF(payload->>'cash_collections', '') IS NOT NULL THEN
    v_cash_collections := (payload->>'cash_collections')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_collections
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'in'
      AND ft.transaction_type IN (
        'customer_collection',
        'customer_due_collection',
        'due_collection',
        'collection'
      )
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'other_cash_income' AND NULLIF(payload->>'other_cash_income', '') IS NOT NULL THEN
    v_other_cash_income := (payload->>'other_cash_income')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_other_cash_income
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('income', 'other_income', 'cash_deposit')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_expenses' AND NULLIF(payload->>'cash_expenses', '') IS NOT NULL THEN
    v_cash_expenses := (payload->>'cash_expenses')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_expenses
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'out'
      AND ft.transaction_type IN ('expense', 'cash_withdrawal')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'supplier_cash_payments' AND NULLIF(payload->>'supplier_cash_payments', '') IS NOT NULL THEN
    v_supplier_cash_payments := (payload->>'supplier_cash_payments')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_supplier_cash_payments
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND fa.account_kind = 'cash'
      AND ft.direction = 'out'
      AND ft.transaction_type IN ('supplier_payment', 'purchase_payment')
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_transfers_net' AND NULLIF(payload->>'cash_transfers_net', '') IS NOT NULL THEN
    v_cash_transfers_net := (payload->>'cash_transfers_net')::numeric;
  ELSE
    SELECT
      coalesce(sum(CASE WHEN ft.direction = 'in' THEN ft.amount ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ft.direction = 'out' THEN ft.amount ELSE 0 END), 0)
    INTO v_computed_in, v_computed_out
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'transfer'
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
    v_cash_transfers_net := coalesce(v_computed_in, 0) - coalesce(v_computed_out, 0);
  END IF;

  v_expected := round(
    coalesce(v_opening_cash, 0)
    + coalesce(v_cash_sales, 0)
    + coalesce(v_cash_collections, 0)
    + coalesce(v_other_cash_income, 0)
    - coalesce(v_cash_expenses, 0)
    - coalesce(v_supplier_cash_payments, 0)
    + coalesce(v_cash_transfers_net, 0),
    2
  );

  IF payload ? 'expected_cash' AND NULLIF(payload->>'expected_cash', '') IS NOT NULL THEN
    v_expected := (payload->>'expected_cash')::numeric;
  ELSIF payload ? 'expected_closing' AND NULLIF(payload->>'expected_closing', '') IS NOT NULL THEN
    v_expected := (payload->>'expected_closing')::numeric;
  END IF;

  v_difference := round(v_counted_cash - v_expected, 2);

  IF abs(v_difference) > 0.01 AND (v_diff_reason IS NULL OR length(btrim(v_diff_reason)) = 0) THEN
    RAISE EXCEPTION 'difference_reason is required when |difference| > 0.01 (difference=%)',
      v_difference;
  END IF;

  IF v_diff_reason IS NOT NULL THEN
    v_note := coalesce(v_note || E'\n', '') || 'Difference reason: ' || v_diff_reason;
  END IF;

  INSERT INTO public.daily_closings (
    organization_id, branch_id, closing_date,
    opening_cash, cash_sales, cash_collections, other_cash_income,
    cash_expenses, supplier_cash_payments, cash_transfers_net,
    expected_closing, counted_cash, difference, note,
    closed_by, status, closed_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_closing_date,
    coalesce(v_opening_cash, 0), coalesce(v_cash_sales, 0),
    coalesce(v_cash_collections, 0), coalesce(v_other_cash_income, 0),
    coalesce(v_cash_expenses, 0), coalesce(v_supplier_cash_payments, 0),
    coalesce(v_cash_transfers_net, 0),
    v_expected, v_counted_cash, v_difference, v_note,
    v_profile_id, 'closed', timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_closing_id;

  RETURN v_closing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_business_day(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(jsonb) TO authenticated;
