-- Glamourous by Mahi · POS sale core routes stock through WAC engine
-- Replaces direct inventory_balances updates with _adjust_inventory (migration 039).

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

    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
    v_cogs_total := v_cogs_total + round(v_qty * v_cost_price, 2);

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
    v_due_total := 0;
    IF v_due_paid > 0 THEN
      RAISE EXCEPTION 'Due payment not allowed when fully paid in cash/bank';
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

  -- Customer ledger if due
  IF v_due_total > 0 THEN
    UPDATE public.customers
    SET current_due = current_due + v_due_total,
        total_spent = total_spent + v_grand_total,
        updated_by = v_profile_id
    WHERE id = v_customer_id;

    INSERT INTO public.customer_ledger (
      organization_id, branch_id, customer_id, entry_type,
      debit, credit, balance_after, reference_type, reference_id,
      notes, created_by, updated_by
    )
    SELECT
      v_org_id, v_branch_id, v_customer_id, 'sale_due',
      v_due_total, 0,
      c.current_due,
      'sale', v_sale_id,
      'POS sale due ' || v_invoice_no,
      v_profile_id, v_profile_id
    FROM public.customers c
    WHERE c.id = v_customer_id;
  ELSIF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET total_spent = total_spent + v_grand_total,
        total_paid = total_paid + v_paid_total,
        updated_by = v_profile_id
    WHERE id = v_customer_id;
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

COMMENT ON FUNCTION public._complete_pos_sale_core(jsonb) IS
  'POS sale core: WAC cost snapshot on sale_items, stock via _adjust_inventory.';
