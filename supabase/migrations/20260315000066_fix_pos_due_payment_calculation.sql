-- Fix due/credit sales when receivable payment fully covers the invoice total
-- Bug: ELSE branch treated due_paid >= grand_total as "fully paid cash" and rejected valid due sales.

CREATE OR REPLACE FUNCTION public._complete_pos_sale_core(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_org_id uuid := public.current_organization_id();
  v_branch_id uuid;
  v_customer_id uuid;
  v_client_txn_key text;
  v_existing_sale public.sales%ROWTYPE;
  v_sale_id uuid;
  v_invoice_no text;
  v_item jsonb;
  v_payment jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_location_id uuid;
  v_balance public.inventory_balances%ROWTYPE;
  v_qty numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_total numeric(14, 2);
  v_cost_price numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_shipping numeric(14, 2) := 0;
  v_grand_total numeric(14, 2) := 0;
  v_paid_total numeric(14, 2) := 0;
  v_due_total numeric(14, 2) := 0;
  v_change_amount numeric(14, 2) := 0;
  v_cogs_total numeric(14, 2) := 0;
  v_payment_status text;
  v_seq bigint;
  v_qty_before numeric(14, 3);
  v_qty_after numeric(14, 3);
  v_cash_coa uuid;
  v_recv_coa uuid;
  v_sales_coa uuid;
  v_cogs_coa uuid;
  v_inv_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_pay_amount numeric(14, 2);
  v_non_due_paid numeric(14, 2) := 0;
  v_due_paid numeric(14, 2) := 0;
  v_is_due boolean;
  v_method text;
  v_fin_acct uuid;
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization context missing' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('pos.create')
     AND current_setting('app.skip_pos_permission', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Missing permission pos.create' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  IF v_branch_id IS NULL THEN
    RAISE EXCEPTION 'branch_id is required';
  END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = v_branch_id
      AND b.organization_id = v_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid branch';
  END IF;

  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  IF v_client_txn_key IS NULL THEN
    RAISE EXCEPTION 'client_txn_key is required for idempotency';
  END IF;

  -- Idempotency: return existing completed sale
  SELECT * INTO v_existing_sale
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'sale_id', v_existing_sale.id,
      'invoice_no', v_existing_sale.invoice_no,
      'idempotent', true
    );
  END IF;

  v_customer_id := NULLIF(payload->>'customer_id', '')::uuid;
  IF v_customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = v_customer_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid customer_id';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  v_discount := coalesce((payload->>'discount')::numeric, 0);
  v_tax := coalesce((payload->>'tax')::numeric, 0);
  v_shipping := coalesce((payload->>'shipping')::numeric, 0);

  IF v_discount < 0 OR v_tax < 0 OR v_shipping < 0 THEN
    RAISE EXCEPTION 'discount/tax/shipping cannot be negative';
  END IF;

  -- Default saleable location for branch
  SELECT sl.id INTO v_location_id
  FROM public.stock_locations sl
  WHERE sl.branch_id = v_branch_id
    AND sl.organization_id = v_org_id
    AND sl.location_type = 'saleable'
    AND sl.deleted_at IS NULL
    AND sl.is_active = true
  ORDER BY sl.is_default DESC, sl.created_at ASC
  LIMIT 1;

  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  -- Lock inventory balances and validate stock; also compute line totals server-side
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);

    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid item qty';
    END IF;
    IF v_unit_price < 0 OR v_line_discount < 0 THEN
      RAISE EXCEPTION 'Invalid item price/discount';
    END IF;

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL
      AND pv.is_active = true
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
    END IF;

    -- Prefer client unit_price only after override permission; otherwise use list price
    IF v_item ? 'unit_price' AND (v_item->>'unit_price') IS NOT NULL THEN
      IF v_unit_price <> v_variant.selling_price
         AND NOT public.user_has_permission('pos.price_override') THEN
        -- silently use catalog price when override not allowed
        v_unit_price := v_variant.selling_price;
      END IF;
    ELSE
      v_unit_price := v_variant.selling_price;
    END IF;

    IF v_line_discount > 0 AND NOT public.user_has_permission('pos.discount') THEN
      RAISE EXCEPTION 'Missing permission pos.discount';
    END IF;

    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);
    IF v_line_total < 0 THEN
      RAISE EXCEPTION 'Line total cannot be negative';
    END IF;

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.organization_id = v_org_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory balance for variant %', v_variant.id;
    END IF;

    IF v_balance.quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for variant % (have %, need %)',
        v_variant.id, v_balance.quantity, v_qty;
    END IF;

    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
    v_cogs_total := v_cogs_total + round(v_qty * v_cost_price, 2);
  END LOOP;

  -- Header discount permission
  IF v_discount > 0 AND NOT public.user_has_permission('pos.discount') THEN
    RAISE EXCEPTION 'Missing permission pos.discount';
  END IF;

  v_grand_total := round(v_subtotal - v_discount + v_tax + v_shipping, 2);
  IF v_grand_total < 0 THEN
    RAISE EXCEPTION 'grand_total cannot be negative';
  END IF;

  -- Validate payments and compute paid/due/change
  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'payments array is required';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_method = '' OR v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment method/amount';
    END IF;

    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      -- fallback: method name 'due' treated as receivable
      v_is_due := (v_method IN ('due', 'credit', 'receivable'));
    END IF;

    IF v_is_due THEN
      IF v_customer_id IS NULL THEN
        RAISE EXCEPTION 'Due payment requires a customer';
      END IF;
      v_due_paid := v_due_paid + v_pay_amount;
    ELSE
      v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
      IF v_fin_acct IS NULL THEN
        RAISE EXCEPTION 'financial_account_id required for method %', v_method;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.financial_accounts fa
        WHERE fa.id = v_fin_acct
          AND fa.organization_id = v_org_id
          AND fa.deleted_at IS NULL
          AND fa.is_active = true
      ) THEN
        RAISE EXCEPTION 'Invalid financial_account_id';
      END IF;
      v_non_due_paid := v_non_due_paid + v_pay_amount;
    END IF;
  END LOOP;

  v_paid_total := v_non_due_paid;
  -- Cash tendered may exceed grand_total → change
  IF v_paid_total + v_due_paid < v_grand_total THEN
    -- remaining unpaid becomes due only if customer present and gap equals due portion
    IF v_customer_id IS NULL THEN
      RAISE EXCEPTION 'Payments do not cover grand_total';
    END IF;
    v_due_total := round(v_grand_total - v_paid_total, 2);
    -- if due payments were declared, they must match remaining
    IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
      RAISE EXCEPTION 'Due payment amount must equal remaining balance';
    END IF;
    IF v_due_paid = 0 THEN
      -- implicit due for remaining
      v_due_total := round(v_grand_total - v_paid_total, 2);
    END IF;
  ELSIF v_paid_total > v_grand_total THEN
    v_change_amount := round(v_paid_total - v_grand_total, 2);
    v_paid_total := v_grand_total;
    v_due_total := 0;
  ELSE
    -- Fully covered by declared payments (cash-only, due-only, or split)
    IF v_paid_total >= v_grand_total THEN
      v_due_total := 0;
      IF v_due_paid > 0 THEN
        RAISE EXCEPTION 'Due payment not allowed when fully paid in cash/bank';
      END IF;
    ELSE
      v_due_total := round(v_grand_total - v_paid_total, 2);
      IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
        RAISE EXCEPTION 'Due payment amount must equal remaining balance';
      END IF;
    END IF;
  END IF;

  IF v_due_total > 0 AND v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Due requires a customer';
  END IF;

  IF v_due_total <= 0 AND v_paid_total >= v_grand_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid_total > 0 AND v_due_total > 0 THEN
    v_payment_status := 'partial';
  ELSIF v_paid_total = 0 AND v_due_total > 0 THEN
    v_payment_status := 'unpaid';
  ELSE
    v_payment_status := 'paid';
  END IF;

  -- Invoice number (org-scoped advisory lock for concurrent POS)
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':sale_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1
  INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL;

  v_invoice_no := 'INV-' || lpad(v_seq::text, 6, '0');

  BEGIN
    INSERT INTO public.sales (
      organization_id, branch_id, invoice_no, customer_id, salesperson_id,
      status, payment_status, subtotal, discount, tax, shipping, grand_total,
      paid_total, due_total, change_amount, client_txn_key, version,
      note, completed_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_invoice_no, v_customer_id, v_profile_id,
      'completed', v_payment_status, v_subtotal, v_discount, v_tax, v_shipping, v_grand_total,
      v_paid_total, v_due_total, v_change_amount, v_client_txn_key, 1,
      NULLIF(payload->>'note', ''), timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_sale_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- Concurrent idempotent retry won the race
      SELECT s.id, s.invoice_no INTO v_sale_id, v_invoice_no
      FROM public.sales s
      WHERE s.organization_id = v_org_id
        AND s.client_txn_key = v_client_txn_key
        AND s.deleted_at IS NULL;

      IF v_sale_id IS NULL THEN
        RAISE;
      END IF;

      RETURN jsonb_build_object(
        'sale_id', v_sale_id,
        'invoice_no', v_invoice_no,
        'idempotent', true
      );
  END;

  -- Insert items + reduce stock (second pass with known totals)
  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL;

    v_unit_price := coalesce((v_item->>'unit_price')::numeric, v_variant.selling_price);
    IF v_unit_price <> v_variant.selling_price
       AND NOT public.user_has_permission('pos.price_override') THEN
      v_unit_price := v_variant.selling_price;
    END IF;

    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.organization_id = v_org_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory balance for variant %', v_variant.id;
    END IF;

    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price, created_by, updated_by
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      v_line_discount, v_line_total, v_cost_price, v_profile_id, v_profile_id
    );

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      -v_qty, 0, 'sale', 'sale', v_sale_id,
      v_profile_id, 'POS sale ' || v_invoice_no
    );
  END LOOP;

  -- Payments
  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    INSERT INTO public.sale_payments (
      organization_id, sale_id, method, amount,
      financial_account_id, reference, created_by, updated_by
    ) VALUES (
      v_org_id,
      v_sale_id,
      btrim(v_payment->>'method'),
      (v_payment->>'amount')::numeric,
      NULLIF(v_payment->>'financial_account_id', '')::uuid,
      NULLIF(v_payment->>'reference', ''),
      v_profile_id,
      v_profile_id
    );
  END LOOP;

  IF v_customer_id IS NOT NULL THEN
    PERFORM public._apply_customer_sale_canonical_ledger(v_sale_id, v_profile_id);
  END IF;

  -- Stub balanced journal if chart accounts exist
  SELECT id INTO v_sales_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'sales_revenue' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cogs_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'cogs' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_inv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'inventory_asset' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_recv_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role = 'receivable' AND deleted_at IS NULL LIMIT 1;
  SELECT id INTO v_cash_coa FROM public.chart_of_accounts
  WHERE organization_id = v_org_id AND system_role IN ('cash', 'bank') AND deleted_at IS NULL
  ORDER BY CASE system_role WHEN 'cash' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_sales_coa IS NOT NULL AND (v_cash_coa IS NOT NULL OR v_recv_coa IS NOT NULL) THEN
    v_entry_no := 'JE-SALE-' || replace(v_sale_id::text, '-', '');

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'sale', v_sale_id, 'POS sale ' || v_invoice_no, timezone('utc', now()),
      v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    -- Dr cash / receivable
    IF v_paid_total > 0 AND v_cash_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_cash_coa,
        'Cash/bank received', v_paid_total, 0, 1, v_profile_id, v_profile_id
      );
    END IF;

    IF v_due_total > 0 AND v_recv_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_recv_coa,
        'Customer receivable', v_due_total, 0, 2, v_profile_id, v_profile_id
      );
    END IF;

    -- Cr sales revenue
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_sales_coa,
      'Sales revenue', 0, v_grand_total, 3, v_profile_id, v_profile_id
    );

    -- Dr COGS / Cr inventory
    IF v_cogs_total > 0 AND v_cogs_coa IS NOT NULL AND v_inv_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES
        (v_org_id, v_journal_id, v_cogs_coa, 'Cost of goods sold', v_cogs_total, 0, 4, v_profile_id, v_profile_id),
        (v_org_id, v_journal_id, v_inv_coa, 'Inventory relief', 0, v_cogs_total, 5, v_profile_id, v_profile_id);
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id,
    v_branch_id,
    v_profile_id,
    'sale.create',
    'sale',
    v_sale_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'grand_total', v_grand_total,
      'paid_total', v_paid_total,
      'due_total', v_due_total,
      'client_txn_key', v_client_txn_key
    ),
    NULL,
    jsonb_build_object('source', 'complete_pos_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale_id,
    'invoice_no', v_invoice_no,
    'idempotent', false,
    'grand_total', v_grand_total,
    'paid_total', v_paid_total,
    'due_total', v_due_total,
    'change_amount', v_change_amount
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;



REVOKE ALL ON FUNCTION public._complete_pos_sale_core(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._complete_pos_sale_core(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public._complete_purchase_core(payload jsonb)
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
  v_client_txn_key text;
  v_existing public.purchases%ROWTYPE;
  v_purchase_id uuid;
  v_invoice_no text;
  v_item jsonb;
  v_payment jsonb;
  v_variant public.product_variants%ROWTYPE;
  v_location_id uuid;
  v_qty numeric(14, 3);
  v_unit_cost numeric(14, 2);
  v_line_discount numeric(14, 2);
  v_line_total numeric(14, 2);
  v_subtotal numeric(14, 2) := 0;
  v_discount numeric(14, 2) := 0;
  v_tax numeric(14, 2) := 0;
  v_shipping numeric(14, 2) := 0;
  v_grand_total numeric(14, 2) := 0;
  v_paid_total numeric(14, 2) := 0;
  v_due_total numeric(14, 2) := 0;
  v_non_due_paid numeric(14, 2) := 0;
  v_due_paid numeric(14, 2) := 0;
  v_is_due boolean;
  v_method text;
  v_fin_acct uuid;
  v_pay_amount numeric(14, 2);
  v_payment_status text;
  v_seq bigint;
  v_inv_coa uuid;
  v_pay_coa uuid;
  v_cash_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_line_no int := 0;
  v_supplier public.suppliers%ROWTYPE;
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('purchases.create') THEN
    RAISE EXCEPTION 'Missing permission purchases.create' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_supplier_id := NULLIF(payload->>'supplier_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_supplier_id IS NULL THEN RAISE EXCEPTION 'supplier_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required for idempotency'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM public.purchases p
  WHERE p.organization_id = v_org_id
    AND p.client_txn_key = v_client_txn_key
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'purchase_id', v_existing.id,
      'invoice_no', v_existing.invoice_no,
      'idempotent', true
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.suppliers s
    WHERE s.id = v_supplier_id AND s.organization_id = v_org_id AND s.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Invalid supplier_id';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one purchase item is required';
  END IF;

  v_discount := coalesce((payload->>'discount')::numeric, 0);
  v_tax := coalesce((payload->>'tax')::numeric, 0);
  v_shipping := coalesce((payload->>'shipping')::numeric, 0);
  IF v_discount < 0 OR v_tax < 0 OR v_shipping < 0 THEN
    RAISE EXCEPTION 'discount/tax/shipping cannot be negative';
  END IF;

  v_location_id := public._saleable_location(v_org_id, v_branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid item qty'; END IF;
    IF v_unit_cost < 0 OR v_line_discount < 0 THEN RAISE EXCEPTION 'Invalid item cost/discount'; END IF;

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid
      AND pv.organization_id = v_org_id
      AND pv.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant not found: %', v_item->>'variant_id';
    END IF;

    v_line_total := round((v_qty * v_unit_cost) - v_line_discount, 2);
    IF v_line_total < 0 THEN RAISE EXCEPTION 'Line total cannot be negative'; END IF;
    v_subtotal := v_subtotal + round(v_qty * v_unit_cost, 2);

    -- Lock inventory row early
    PERFORM public._ensure_inventory_balance(v_org_id, v_variant.id, v_location_id, v_profile_id);
  END LOOP;

  v_grand_total := round(v_subtotal - v_discount + v_tax + v_shipping, 2);
  IF v_grand_total < 0 THEN RAISE EXCEPTION 'grand_total cannot be negative'; END IF;

  IF jsonb_typeof(payload->'payments') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'payments array is required (may be empty)';
  END IF;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    v_pay_amount := (v_payment->>'amount')::numeric;
    IF v_method = '' OR v_pay_amount IS NULL OR v_pay_amount <= 0 THEN
      RAISE EXCEPTION 'Invalid payment method/amount';
    END IF;

    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id
      AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL
      AND pm.is_active = true;

    IF NOT FOUND THEN
      v_is_due := (v_method IN ('due', 'credit', 'payable'));
    END IF;

    IF v_is_due THEN
      v_due_paid := v_due_paid + v_pay_amount;
    ELSE
      v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
      IF v_fin_acct IS NULL THEN
        RAISE EXCEPTION 'financial_account_id required for method %', v_method;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.financial_accounts fa
        WHERE fa.id = v_fin_acct AND fa.organization_id = v_org_id
          AND fa.deleted_at IS NULL AND fa.is_active = true
      ) THEN
        RAISE EXCEPTION 'Invalid financial_account_id';
      END IF;
      v_non_due_paid := v_non_due_paid + v_pay_amount;
    END IF;
  END LOOP;

  v_paid_total := v_non_due_paid;
  IF v_paid_total + v_due_paid < v_grand_total THEN
    v_due_total := round(v_grand_total - v_paid_total, 2);
    IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
      RAISE EXCEPTION 'Due payment amount must equal remaining balance';
    END IF;
  ELSIF v_paid_total > v_grand_total THEN
    RAISE EXCEPTION 'Paid amount cannot exceed grand_total for purchases';
  ELSE
    IF v_paid_total >= v_grand_total THEN
      v_due_total := 0;
      IF v_due_paid > 0 THEN
        RAISE EXCEPTION 'Due payment not allowed when fully paid';
      END IF;
    ELSE
      v_due_total := round(v_grand_total - v_paid_total, 2);
      IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
        RAISE EXCEPTION 'Due payment amount must equal remaining balance';
      END IF;
    END IF;
  END IF;

  IF v_due_total <= 0 AND v_paid_total >= v_grand_total THEN
    v_payment_status := 'paid';
  ELSIF v_paid_total > 0 AND v_due_total > 0 THEN
    v_payment_status := 'partial';
  ELSE
    v_payment_status := 'unpaid';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':purchase_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(p.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1
  INTO v_seq
  FROM public.purchases p
  WHERE p.organization_id = v_org_id AND p.deleted_at IS NULL;

  v_invoice_no := 'PO-' || lpad(v_seq::text, 6, '0');

  BEGIN
    INSERT INTO public.purchases (
      organization_id, branch_id, invoice_no, supplier_id,
      status, payment_status, subtotal, discount, tax, shipping, grand_total,
      paid_total, due_total, client_txn_key, note, completed_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_invoice_no, v_supplier_id,
      'completed', v_payment_status, v_subtotal, v_discount, v_tax, v_shipping, v_grand_total,
      v_paid_total, v_due_total, v_client_txn_key, NULLIF(payload->>'note', ''),
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_purchase_id;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT p.id, p.invoice_no INTO v_purchase_id, v_invoice_no
      FROM public.purchases p
      WHERE p.organization_id = v_org_id AND p.client_txn_key = v_client_txn_key AND p.deleted_at IS NULL;
      IF v_purchase_id IS NULL THEN RAISE; END IF;
      RETURN jsonb_build_object('purchase_id', v_purchase_id, 'invoice_no', v_invoice_no, 'idempotent', true);
  END;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_qty := (v_item->>'qty')::numeric;
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    v_line_discount := coalesce((v_item->>'line_discount')::numeric, 0);
    v_line_total := round((v_qty * v_unit_cost) - v_line_discount, 2);

    SELECT * INTO v_variant
    FROM public.product_variants pv
    WHERE pv.id = (v_item->>'variant_id')::uuid;

    INSERT INTO public.purchase_items (
      organization_id, purchase_id, variant_id, qty, unit_cost,
      line_discount, line_total, created_by, updated_by
    ) VALUES (
      v_org_id, v_purchase_id, v_variant.id, v_qty, v_unit_cost,
      v_line_discount, v_line_total, v_profile_id, v_profile_id
    );

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      v_qty, v_unit_cost, 'purchase', 'purchase', v_purchase_id, v_profile_id, NULL
    );

    UPDATE public.product_variants
    SET purchase_price = v_unit_cost,
        updated_by = v_profile_id
    WHERE id = v_variant.id;
  END LOOP;

  FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
  LOOP
    v_method := lower(btrim(coalesce(v_payment->>'method', '')));
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = v_org_id AND lower(pm.code) = v_method
      AND pm.deleted_at IS NULL AND pm.is_active = true;
    IF NOT FOUND THEN
      v_is_due := (v_method IN ('due', 'credit', 'payable'));
    END IF;
    IF v_is_due THEN CONTINUE; END IF;

    v_pay_amount := (v_payment->>'amount')::numeric;
    v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;

    INSERT INTO public.purchase_payments (
      organization_id, purchase_id, method, amount,
      financial_account_id, reference, created_by, updated_by
    ) VALUES (
      v_org_id, v_purchase_id, btrim(v_payment->>'method'), v_pay_amount,
      v_fin_acct, NULLIF(v_payment->>'reference', ''), v_profile_id, v_profile_id
    );

    UPDATE public.financial_accounts
    SET current_balance = current_balance - v_pay_amount,
        updated_by = v_profile_id
    WHERE id = v_fin_acct;
  END LOOP;

  PERFORM public._apply_supplier_purchase_canonical_ledger(v_purchase_id, v_profile_id);

  v_inv_coa := public._coa_by_role(v_org_id, 'inventory_asset');
  v_pay_coa := public._coa_by_role(v_org_id, 'payable');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');
  IF v_cash_coa IS NULL THEN v_cash_coa := public._coa_by_role(v_org_id, 'bank'); END IF;

  IF v_inv_coa IS NOT NULL AND (v_pay_coa IS NOT NULL OR v_cash_coa IS NOT NULL) THEN
    v_entry_no := 'JE-PO-' || replace(v_purchase_id::text, '-', '');
    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'purchase', v_purchase_id, 'Purchase ' || v_invoice_no,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    v_line_no := 1;
    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_inv_coa,
      'Inventory received', v_grand_total, 0, v_line_no, v_profile_id, v_profile_id
    );

    IF v_paid_total > 0 AND v_cash_coa IS NOT NULL THEN
      FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
      LOOP
        v_method := lower(btrim(coalesce(v_payment->>'method', '')));
        SELECT coalesce(pm.is_due, false) INTO v_is_due
        FROM public.payment_methods pm
        WHERE pm.organization_id = v_org_id AND lower(pm.code) = v_method
          AND pm.deleted_at IS NULL AND pm.is_active = true;
        IF NOT FOUND THEN v_is_due := (v_method IN ('due', 'credit', 'payable')); END IF;
        IF v_is_due THEN CONTINUE; END IF;

        v_pay_amount := (v_payment->>'amount')::numeric;
        v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
        SELECT * INTO v_fa FROM public.financial_accounts WHERE id = v_fin_acct;
        v_line_no := v_line_no + 1;
        INSERT INTO public.journal_lines (
          organization_id, journal_entry_id, chart_account_id, financial_account_id,
          description, debit, credit, line_no, created_by, updated_by
        ) VALUES (
          v_org_id, v_journal_id, coalesce(v_fa.chart_account_id, v_cash_coa), v_fin_acct,
          'Cash/bank payment', 0, v_pay_amount, v_line_no, v_profile_id, v_profile_id
        );
      END LOOP;
    END IF;

    IF v_due_total > 0 AND v_pay_coa IS NOT NULL THEN
      v_line_no := v_line_no + 1;
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_pay_coa,
        'Accounts payable', 0, v_due_total, v_line_no, v_profile_id, v_profile_id
      );
    END IF;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'purchase.create', 'purchase', v_purchase_id,
    NULL,
    jsonb_build_object(
      'invoice_no', v_invoice_no,
      'grand_total', v_grand_total,
      'paid_total', v_paid_total,
      'due_total', v_due_total,
      'client_txn_key', v_client_txn_key
    ),
    NULL,
    jsonb_build_object('source', 'complete_purchase')
  );

  RETURN jsonb_build_object(
    'purchase_id', v_purchase_id,
    'invoice_no', v_invoice_no,
    'grand_total', v_grand_total,
    'paid_total', v_paid_total,
    'due_total', v_due_total,
    'idempotent', false
  );
END;
$$;



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

  IF v_amount > v_customer.current_due THEN
    IF NOT coalesce(v_allow_advance, false) THEN
      RAISE EXCEPTION 'Collection amount % exceeds customer due %', v_amount, v_customer.current_due;
    END IF;
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

  PERFORM public._post_customer_ledger_entry(
    v_org_id, v_branch_id, v_customer_id,
    'collection', 0, v_amount,
    'collection', v_collection_id,
    coalesce(v_note, 'Due collection ' || v_client_txn_key),
    v_profile_id,
    v_amount, 0
  );

  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;

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
  v_rev_journal uuid;
  v_cogs_total numeric(14, 2) := 0;
  v_sale_date date;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.void') THEN
    RAISE EXCEPTION 'Missing permission sales.void' USING ERRCODE = '42501';
  END IF;

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

  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, btrim(reason));
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
    v_profile_id
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
    jsonb_build_object('status', 'voided', 'reason', btrim(reason), 'reversing_journal_id', v_rev_journal),
    btrim(reason),
    jsonb_build_object('source', 'void_sale')
  );

  RETURN jsonb_build_object(
    'sale_id', v_sale.id,
    'status', 'voided',
    'reversing_journal_id', v_rev_journal,
    'cogs_reversed', v_cogs_total
  );
END;
$$;



CREATE OR REPLACE FUNCTION public.edit_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sale_id uuid;
  v_sale public.sales%ROWTYPE;
  v_item public.sale_items%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_location_id uuid;
  v_is_due boolean;
  v_rev_journal uuid;
  v_new_sale jsonb;
  v_new_sale_id uuid;
  v_merged_payload jsonb;
  v_reason text;
  v_client_txn_key text;
  v_sale_date date;
  v_existing uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.update')
    OR public.user_has_permission('sales.correct')
  ) THEN
    RAISE EXCEPTION 'Missing permission sales.update' USING ERRCODE = '42501';
  END IF;

  v_sale_id := NULLIF(payload->>'sale_id', '')::uuid;
  v_reason := NULLIF(btrim(coalesce(payload->>'reason', '')), '');
  v_client_txn_key := NULLIF(btrim(coalesce(payload->>'client_txn_key', '')), '');

  IF v_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'Edit reason is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;

  -- Idempotency: if corrected sale already created with this key, return it
  SELECT s.id INTO v_existing
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.client_txn_key = v_client_txn_key
    AND s.deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'original_sale_id', v_sale_id,
      'new_sale_id', v_existing,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = v_sale_id
    AND s.organization_id = v_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;
  IF v_sale.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed sales can be edited';
  END IF;

  v_sale_date := coalesce(v_sale.completed_at, v_sale.created_at)::date;
  PERFORM public._assert_sale_period_open(v_org_id, v_sale_date);

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'items') < 1 THEN
    RAISE EXCEPTION 'At least one sale item is required';
  END IF;

  INSERT INTO public.sale_versions (
    organization_id, sale_id, version, snapshot, reason, created_by, updated_by
  ) VALUES (
    v_org_id, v_sale.id, v_sale.version,
    to_jsonb(v_sale) || jsonb_build_object(
      'items', coalesce((
        SELECT jsonb_agg(to_jsonb(si)) FROM public.sale_items si
        WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
      ), '[]'::jsonb),
      'payments', coalesce((
        SELECT jsonb_agg(to_jsonb(sp)) FROM public.sale_payments sp
        WHERE sp.sale_id = v_sale.id AND sp.deleted_at IS NULL
      ), '[]'::jsonb)
    ),
    v_reason,
    v_profile_id, v_profile_id
  );

  v_location_id := public._saleable_location(v_org_id, v_sale.branch_id);
  IF v_location_id IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  FOR v_item IN
    SELECT * FROM public.sale_items si
    WHERE si.sale_id = v_sale.id AND si.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id, v_sale.branch_id, v_item.variant_id, v_location_id,
      v_item.qty, v_item.cost_price, 'correction', 'sale', v_sale.id,
      v_profile_id, 'Edit reverse restock'
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
      AND pm.deleted_at IS NULL AND pm.is_active = true;
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
        reversal_note = v_reason,
        updated_by = v_profile_id
    WHERE id = v_payment.id;
  END LOOP;

  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, v_reason);
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Edit reverse ' || v_sale.invoice_no || ': ' || v_reason,
    v_profile_id
  );

  UPDATE public.sales
  SET status = 'corrected',
      updated_by = v_profile_id
  WHERE id = v_sale.id;

  v_merged_payload := jsonb_build_object(
    'branch_id', v_sale.branch_id,
    'customer_id', coalesce(NULLIF(payload->>'customer_id', '')::uuid, v_sale.customer_id),
    'client_txn_key', v_client_txn_key,
    'note', coalesce(payload->>'note', payload->>'reason'),
    'discount', coalesce((payload->>'discount')::numeric, 0),
    'tax', coalesce((payload->>'tax')::numeric, v_sale.tax),
    'shipping', coalesce((payload->>'shipping')::numeric, v_sale.shipping),
    'items', payload->'items',
    'payments', coalesce(payload->'payments', '[]'::jsonb)
  );

  PERFORM set_config('app.skip_pos_permission', '1', true);
  v_new_sale := public.complete_pos_sale(v_merged_payload);
  v_new_sale_id := (v_new_sale->>'sale_id')::uuid;

  UPDATE public.sales
  SET previous_sale_id = v_sale.id,
      corrected_from_id = v_sale.id,
      version = v_sale.version + 1,
      updated_by = v_profile_id
  WHERE id = v_new_sale_id;

  PERFORM public.write_audit_log(
    v_org_id, v_sale.branch_id, v_profile_id,
    'sale.edit', 'sale', v_sale.id,
    jsonb_build_object(
      'status', 'completed',
      'grand_total', v_sale.grand_total,
      'paid_total', v_sale.paid_total,
      'due_total', v_sale.due_total
    ),
    jsonb_build_object(
      'status', 'corrected',
      'new_sale_id', v_new_sale_id,
      'new_invoice_no', v_new_sale->>'invoice_no',
      'new_grand_total', v_new_sale->>'grand_total',
      'reason', v_reason,
      'note', payload->>'note'
    ),
    v_reason,
    jsonb_build_object('source', 'edit_sale')
  );

  RETURN jsonb_build_object(
    'original_sale_id', v_sale.id,
    'new_sale_id', v_new_sale_id,
    'new_invoice_no', v_new_sale->>'invoice_no',
    'reversing_journal_id', v_rev_journal,
    'idempotent', false
  );
END;
$$;




--------------------------------------------------------------------------------
-- Historical backfill: rebuild canonical customer/supplier ledgers for all parties
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sync_customer_ledger_totals(p_customer_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.customers c
  SET current_due = greatest(0, coalesce((
        SELECT sum(cl.debit - cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
      ), 0)),
      total_spent = coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.customer_id = c.id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
      ), 0),
      total_paid = coalesce((
        SELECT sum(cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
          AND cl.entry_type IN ('sale_payment', 'collection')
      ), 0)
  WHERE c.deleted_at IS NULL
    AND (p_customer_id IS NULL OR c.id = p_customer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public._sync_supplier_ledger_totals(p_supplier_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.suppliers s
  SET current_due = greatest(0, coalesce((
        SELECT sum(sl.debit - sl.credit)
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id
          AND sl.deleted_at IS NULL
      ), 0))
  WHERE s.deleted_at IS NULL
    AND (p_supplier_id IS NULL OR s.id = p_supplier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_customer_sale_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  UPDATE public.customer_ledger cl
  SET deleted_at = timezone('utc', now()),
      notes = coalesce(cl.notes, '') || ' [superseded by canonical backfill]'
  FROM public.sales s
  WHERE cl.reference_type = 'sale'
    AND cl.reference_id = s.id
    AND cl.entry_type = 'sale_due'
    AND cl.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND s.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_ledger inv
      WHERE inv.customer_id = s.customer_id
        AND inv.reference_type = 'sale'
        AND inv.reference_id = s.id
        AND inv.entry_type = 'sale_invoice'
        AND inv.deleted_at IS NULL
    );

  FOR r IN
    SELECT s.id AS sale_id, s.created_by
    FROM public.sales s
    WHERE s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.customer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_ledger cl
        WHERE cl.customer_id = s.customer_id
          AND cl.reference_type = 'sale'
          AND cl.reference_id = s.id
          AND cl.entry_type = 'sale_invoice'
          AND cl.deleted_at IS NULL
      )
    ORDER BY s.created_at, s.id
  LOOP
    PERFORM public._apply_customer_sale_canonical_ledger(
      r.sale_id,
      coalesce(r.created_by, public.current_profile_id()),
      true
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public._sync_customer_ledger_totals();

  RETURN jsonb_build_object('sales_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_customer_collection_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      ft.organization_id,
      ft.branch_id,
      ft.source_id AS collection_id,
      (al.after_data->>'customer_id')::uuid AS customer_id,
      sum(ft.amount) AS amount,
      max(coalesce(ft.note, al.reason, 'Due collection backfill')) AS notes,
      (array_agg(coalesce(ft.created_by, al.actor_id) ORDER BY ft.transaction_date))[1] AS actor
    FROM public.financial_transactions ft
    JOIN public.audit_logs al
      ON al.entity_type = 'collection'
     AND al.entity_id = ft.source_id
     AND al.action = 'collection.create'
    WHERE ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'customer_collection'
      AND ft.source_type = 'collection'
      AND ft.source_id IS NOT NULL
      AND (al.after_data->>'customer_id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.customer_ledger cl
        WHERE cl.reference_type = 'collection'
          AND cl.reference_id = ft.source_id
          AND cl.entry_type = 'collection'
          AND cl.deleted_at IS NULL
      )
    GROUP BY ft.organization_id, ft.branch_id, ft.source_id, (al.after_data->>'customer_id')::uuid
    ORDER BY min(ft.transaction_date), ft.source_id
  LOOP
    PERFORM public._post_customer_ledger_entry(
      r.organization_id, r.branch_id, r.customer_id,
      'collection', 0, r.amount,
      'collection', r.collection_id,
      r.notes,
      r.actor,
      0, 0,
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('collections_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_supplier_purchase_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  UPDATE public.supplier_ledger sl
  SET deleted_at = timezone('utc', now()),
      notes = coalesce(sl.notes, '') || ' [superseded by canonical backfill]'
  FROM public.purchases p
  WHERE sl.reference_type = 'purchase'
    AND sl.reference_id = p.id
    AND sl.entry_type = 'purchase_due'
    AND sl.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.supplier_ledger inv
      WHERE inv.supplier_id = p.supplier_id
        AND inv.reference_type = 'purchase'
        AND inv.reference_id = p.id
        AND inv.entry_type = 'purchase_invoice'
        AND inv.deleted_at IS NULL
    );

  FOR r IN
    SELECT p.id AS purchase_id, p.created_by
    FROM public.purchases p
    WHERE p.deleted_at IS NULL
      AND p.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_ledger sl
        WHERE sl.supplier_id = p.supplier_id
          AND sl.reference_type = 'purchase'
          AND sl.reference_id = p.id
          AND sl.entry_type = 'purchase_invoice'
          AND sl.deleted_at IS NULL
      )
    ORDER BY p.created_at, p.id
  LOOP
    PERFORM public._apply_supplier_purchase_canonical_ledger(
      r.purchase_id,
      coalesce(r.created_by, public.current_profile_id()),
      true
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public._sync_supplier_ledger_totals();

  RETURN jsonb_build_object('purchases_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_supplier_payment_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      ft.organization_id,
      ft.branch_id,
      ft.source_id AS payment_id,
      (al.after_data->>'supplier_id')::uuid AS supplier_id,
      sum(ft.amount) AS amount,
      max(coalesce(ft.note, al.reason, 'Supplier payment backfill')) AS notes,
      (array_agg(coalesce(ft.created_by, al.actor_id) ORDER BY ft.transaction_date))[1] AS actor
    FROM public.financial_transactions ft
    JOIN public.audit_logs al
      ON al.entity_type = 'supplier_payment'
     AND al.entity_id = ft.source_id
     AND al.action = 'supplier_payment.create'
    WHERE ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'supplier_payment'
      AND ft.source_type = 'supplier_payment'
      AND ft.source_id IS NOT NULL
      AND (al.after_data->>'supplier_id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_ledger sl
        WHERE sl.reference_type = 'supplier_payment'
          AND sl.reference_id = ft.source_id
          AND sl.entry_type = 'supplier_payment'
          AND sl.deleted_at IS NULL
      )
    GROUP BY ft.organization_id, ft.branch_id, ft.source_id, (al.after_data->>'supplier_id')::uuid
    ORDER BY min(ft.transaction_date), ft.source_id
  LOOP
    PERFORM public._post_supplier_ledger_entry(
      r.organization_id, r.branch_id, r.supplier_id,
      'supplier_payment', 0, r.amount,
      'supplier_payment', r.payment_id,
      r.notes,
      r.actor,
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('supplier_payments_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_all_party_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sales jsonb;
  v_collections jsonb;
  v_purchases jsonb;
  v_payments jsonb;
  v_opening jsonb;
BEGIN
  v_sales := public.backfill_canonical_customer_sale_ledgers();
  v_collections := public.backfill_canonical_customer_collection_ledgers();
  v_purchases := public.backfill_canonical_supplier_purchase_ledgers();
  v_payments := public.backfill_canonical_supplier_payment_ledgers();
  v_opening := public.backfill_party_opening_ledgers();

  PERFORM public._sync_customer_ledger_totals();
  PERFORM public._sync_supplier_ledger_totals();

  RETURN jsonb_build_object(
    'sales', v_sales,
    'collections', v_collections,
    'purchases', v_purchases,
    'supplier_payments', v_payments,
    'opening', v_opening
  );
END;
$$;

SELECT public.backfill_all_party_ledgers();

REVOKE ALL ON FUNCTION public._sync_customer_ledger_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_supplier_ledger_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_customer_sale_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_customer_collection_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_supplier_purchase_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_supplier_payment_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_all_party_ledgers() FROM PUBLIC;


REVOKE ALL ON FUNCTION public._complete_purchase_core(jsonb) FROM PUBLIC, anon, authenticated;
