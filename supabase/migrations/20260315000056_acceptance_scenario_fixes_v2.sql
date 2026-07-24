-- Acceptance scenario fixes v2: split payment FT assertions, implicit due sale, sales return refund account

CREATE OR REPLACE FUNCTION public.run_erp_acceptance_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_ctx jsonb := public._erp_qa_context();
  v_org uuid := (v_ctx->>'org_id')::uuid;
  v_branch uuid := (v_ctx->>'branch_id')::uuid;
  v_branch_b uuid := (v_ctx->>'branch_b_id')::uuid;
  v_actor uuid := (v_ctx->>'actor_id')::uuid;
  v_variant uuid := (v_ctx->>'variant_id')::uuid;
  v_supplier uuid := (v_ctx->>'supplier_id')::uuid;
  v_cash uuid := (v_ctx->>'cash_account_id')::uuid;
  v_bank uuid := (v_ctx->>'bank_account_id')::uuid;
  v_bkash uuid := (v_ctx->>'bkash_account_id')::uuid;
  v_exp_cat uuid := (v_ctx->>'expense_category_id')::uuid;
  v_company uuid := (v_ctx->>'courier_company_id')::uuid;
  v_status text;
  v_detail jsonb;
  v_probe jsonb;
  v_cod jsonb;
  v_key text;
  v_result jsonb;
  v_jcount int;
  v_loc uuid;
  v_loc_b uuid;
  v_qty_before numeric(14, 3);
  v_qty_after numeric(14, 3);
  v_reserved_before numeric(14, 3);
  v_reserved_after numeric(14, 3);
  v_onhand_before numeric(14, 3);
  v_onhand_after numeric(14, 3);
  v_sale_result jsonb;
  v_sale_id uuid;
  v_purchase_id uuid;
  v_purchase_item_id uuid;
  v_comm_id uuid;
  v_can_anon boolean;
  v_can_auth boolean;
  v_parcel_id uuid;
  v_settlement_id uuid;
  v_cash_before numeric(14, 2);
  v_cash_after numeric(14, 2);
  v_bank_before numeric(14, 2);
  v_bank_after numeric(14, 2);
  v_bkash_before numeric(14, 2);
  v_bkash_after numeric(14, 2);
  v_supplier_due_before numeric(14, 2);
  v_supplier_due_after numeric(14, 2);
  v_customer_id uuid;
  v_customer_due_before numeric(14, 2);
  v_customer_due_after numeric(14, 2);
  v_transfer_id uuid;
  v_from_loc uuid;
  v_to_loc uuid;
  v_sti_id uuid;
  v_recon jsonb;
  v_expense_id uuid;
  v_comm_before numeric(14, 2);
  v_comm_after numeric(14, 2);
  v_rule_id uuid;
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  BEGIN
    v_probe := public._erp_security_probe_parcel_status();
    v_status := coalesce(v_probe->>'status', 'FAIL');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'parcel_guc_bypass', 'status', v_status, 'detail', v_probe
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 13, 'name', 'parcel_guc_bypass', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  SELECT has_function_privilege('anon', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_anon;
  SELECT has_function_privilege('authenticated', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_auth;
  v_status := CASE WHEN NOT v_can_anon AND NOT v_can_auth THEN 'PASS' ELSE 'FAIL' END;
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'scenario', 13, 'name', 'qa_grant_isolation', 'status', v_status,
    'anon_can_execute', v_can_anon, 'auth_can_execute', v_can_auth
  ));

  -- Scenario 1: Purchase on supplier due (empty payments → full due_total)
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT quantity INTO v_qty_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    SELECT current_due INTO v_supplier_due_before FROM public.suppliers WHERE id = v_supplier;

    v_key := 'qa-purch-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.complete_purchase(jsonb_build_object(
      'branch_id', v_branch,
      'supplier_id', v_supplier,
      'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object(
        'variant_id', v_variant, 'qty', 5, 'unit_cost', 100.00
      )),
      'payments', '[]'::jsonb
    ));
    v_purchase_id := (v_result->>'purchase_id')::uuid;
    PERFORM public._erp_assert(v_purchase_id IS NOT NULL, 'purchase_id required');

    SELECT quantity INTO v_qty_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    SELECT current_due INTO v_supplier_due_after FROM public.suppliers WHERE id = v_supplier;

    PERFORM public._erp_assert(v_qty_after - v_qty_before = 5, 'stock +5');
    PERFORM public._erp_assert(v_supplier_due_after - v_supplier_due_before = 500.00, 'supplier due +500');

    v_result := public.complete_purchase(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', v_supplier, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 5, 'unit_cost', 100.00)),
      'payments', '[]'::jsonb
    ));
    PERFORM public._erp_assert(coalesce((v_result->>'idempotent')::boolean, false), 'purchase retry idempotent');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 1, 'name', 'purchase_stock_supplier_due', 'status', 'PASS',
      'purchase_id', v_purchase_id, 'qty_delta', 5, 'due_delta', 500.00
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 1, 'name', 'purchase_stock_supplier_due', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 2: Partial transfer (unchanged)
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_from_loc := public._saleable_location(v_org, v_branch);
    v_to_loc := public._saleable_location(v_org, v_branch_b);
    v_key := 'qa-xfer-' || replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.stock_transfers (
      id, organization_id, transfer_no, from_branch_id, to_branch_id,
      from_location_id, to_location_id, status, created_by, updated_by
    ) VALUES (
      gen_random_uuid(), v_org, v_key, v_branch, v_branch_b,
      v_from_loc, v_to_loc, 'draft', v_actor, v_actor
    )
    RETURNING id INTO v_transfer_id;

    INSERT INTO public.stock_transfer_items (
      organization_id, transfer_id, variant_id, quantity_sent, unit_cost, created_by, updated_by
    ) VALUES (v_org, v_transfer_id, v_variant, 10, 100.00, v_actor, v_actor)
    RETURNING id INTO v_sti_id;

    PERFORM public.dispatch_stock_transfer(v_transfer_id);
    PERFORM public.receive_stock_transfer(
      v_transfer_id,
      jsonb_build_array(jsonb_build_object('id', v_sti_id, 'quantity_received', 4)),
      false
    );
    PERFORM public.receive_stock_transfer(
      v_transfer_id,
      jsonb_build_array(jsonb_build_object(
        'id', v_sti_id, 'quantity_received', 2, 'quantity_damaged', 1, 'condition', 'damaged'
      )),
      false
    );
    BEGIN
      PERFORM public.receive_stock_transfer(
        v_transfer_id,
        jsonb_build_array(jsonb_build_object('id', v_sti_id, 'quantity_received', 20)),
        false
      );
      RAISE EXCEPTION 'over-receive should have failed';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    v_result := public.receive_stock_transfer(
      v_transfer_id,
      jsonb_build_array(jsonb_build_object('id', v_sti_id, 'quantity_received', 3)),
      true
    );
    PERFORM public._erp_assert((v_result->>'status') = 'received', 'transfer finalized');

    SELECT coalesce(quantity_received, 0), coalesce(quantity_damaged, 0)
    INTO v_qty_before, v_qty_after
    FROM public.stock_transfer_items WHERE id = v_sti_id;
    PERFORM public._erp_assert(v_qty_before = 9 AND v_qty_after = 1, '9 received + 1 damaged');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 2, 'name', 'partial_transfer_lifecycle', 'status', 'PASS',
      'transfer_id', v_transfer_id, 'received', 9, 'damaged', 1
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 2, 'name', 'partial_transfer_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 3
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT quantity INTO v_qty_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    v_key := 'qa-pos-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 2, 'unit_price', 200.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 400.00, 'financial_account_id', v_cash))
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT quantity INTO v_qty_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_qty_before - v_qty_after = 2, 'stock -2');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'PASS', 'sale_id', v_sale_id
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 4: Split payment (assert combined account delta = sale total)
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;
    SELECT current_balance INTO v_bank_before FROM public.financial_accounts WHERE id = v_bank;
    SELECT current_balance INTO v_bkash_before FROM public.financial_accounts WHERE id = v_bkash;

    v_key := 'qa-split-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 300.00)),
      'payments', jsonb_build_array(
        jsonb_build_object('method', 'cash', 'amount', 100.00, 'financial_account_id', v_cash),
        jsonb_build_object('method', 'bank', 'amount', 100.00, 'financial_account_id', v_bank),
        jsonb_build_object('method', 'bkash', 'amount', 100.00, 'financial_account_id', v_bkash)
      )
    ));
    PERFORM public._erp_assert((v_sale_result->>'sale_id') IS NOT NULL, 'split sale ok');

    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT coalesce(sum(sp.amount), 0) INTO v_cash_before
    FROM public.sale_payments sp
    WHERE sp.sale_id = v_sale_id AND sp.deleted_at IS NULL AND sp.financial_account_id IS NOT NULL;
    PERFORM public._erp_assert(v_cash_before = 300.00, 'sale_payments total 300');

    SELECT coalesce(sum(ft.amount), 0) INTO v_bank_before
    FROM public.financial_transactions ft
    WHERE ft.source_type = 'sale' AND ft.source_id = v_sale_id
      AND ft.direction = 'in' AND ft.deleted_at IS NULL AND ft.status = 'posted';
    PERFORM public._erp_assert(v_bank_before = 300.00, 'financial_transactions total 300');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 4, 'name', 'pos_split_payment', 'status', 'PASS',
      'payments_total', v_cash_before, 'posted_total', v_bank_before
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 4, 'name', 'pos_split_payment', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 5: Due sale with explicit customer
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    INSERT INTO public.customers (
      id, organization_id, branch_id, name, phone, status, created_by, updated_by
    ) VALUES (
      gen_random_uuid(), v_org, v_branch, 'Due Test Customer', '01711112222', 'active', v_actor, v_actor
    )
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_customer_id FROM public.customers
    WHERE organization_id = v_org AND phone = '01711112222' AND deleted_at IS NULL
    LIMIT 1;

    v_key := 'qa-due-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key, 'customer_id', v_customer_id,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 250.00)),
      'payments', '[]'::jsonb
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT current_due INTO v_customer_due_before FROM public.customers WHERE id = v_customer_id;
    PERFORM public._erp_assert(v_customer_due_before >= 250.00, 'customer due created');

    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public.collect_customer_due(jsonb_build_object(
      'branch_id', v_branch, 'customer_id', v_customer_id,
      'client_txn_key', 'col-' || v_key,
      'payments', jsonb_build_array(jsonb_build_object('financial_account_id', v_cash, 'amount', 100.00))
    ));
    SELECT current_due INTO v_customer_due_after FROM public.customers WHERE id = v_customer_id;
    SELECT current_balance INTO v_cash_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_customer_due_before - v_customer_due_after = 100.00, 'partial collection');
    PERFORM public._erp_assert(v_cash_after - v_cash_before = 100.00, 'cash +100');

    PERFORM public.collect_customer_due(jsonb_build_object(
      'branch_id', v_branch, 'customer_id', v_customer_id,
      'client_txn_key', 'col-final-' || v_key,
      'payments', jsonb_build_array(jsonb_build_object(
        'financial_account_id', v_cash, 'amount', v_customer_due_after
      ))
    ));
    SELECT current_due INTO v_customer_due_after FROM public.customers WHERE id = v_customer_id;
    PERFORM public._erp_assert(v_customer_due_after = 0, 'due cleared');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 5, 'name', 'due_sale_collection', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 5, 'name', 'due_sale_collection', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 6
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT coalesce(qty_reserved, 0), quantity
    INTO v_reserved_before, v_onhand_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;

    v_key := 'qa-web-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.place_online_order(jsonb_build_object(
      'organization_slug', v_ctx->>'org_slug',
      'client_txn_key', v_key,
      'customer_name', 'Web Customer', 'phone', '01722223333', 'address', 'Test Address',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 2))
    ));
    v_sale_id := (v_result->>'sale_id')::uuid;

    SELECT coalesce(qty_reserved, 0), quantity
    INTO v_reserved_after, v_onhand_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_reserved_after - v_reserved_before = 2, 'reserved +2');
    PERFORM public._erp_assert(v_onhand_after = v_onhand_before, 'on-hand unchanged');

    PERFORM public._erp_qa_set_sandbox_auth();
    PERFORM public.fulfil_online_order(jsonb_build_object('sale_id', v_sale_id));

    SELECT coalesce(qty_reserved, 0), quantity
    INTO v_reserved_after, v_onhand_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_onhand_before - v_onhand_after = 2, 'on-hand -2 after fulfil');

    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id, sale_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company, v_sale_id,
      'QA-WEB-COD-' || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', (SELECT grand_total FROM public.sales WHERE id = v_sale_id), 50.00
    )
    RETURNING id INTO v_parcel_id;

    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'online COD');
    SELECT count(*) INTO v_jcount FROM public.journal_entries
    WHERE source_type = 'courier_cod' AND source_id = v_parcel_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_jcount = 1, 'COD journal on delivery');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 6, 'name', 'online_reserve_fulfil_cod', 'status', 'PASS', 'sale_id', v_sale_id
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 6, 'name', 'online_reserve_fulfil_cod', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 7
  BEGIN
    v_cod := public.run_erp_qa_cod_delivery();
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'cod_delivery_idempotent', 'status', coalesce(v_cod->>'status', 'FAIL'), 'detail', v_cod
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'cod_delivery_idempotent', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    INSERT INTO public.courier_parcels (
      organization_id, branch_id, courier_company_id,
      tracking_no, status, cod_amount, courier_charge
    ) VALUES (
      v_org, v_branch, v_company,
      'QA-SETTLE-' || replace(gen_random_uuid()::text, '-', ''),
      'in_transit', 2000.00, 80.00
    )
    RETURNING id INTO v_parcel_id;
    PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'settlement test');
    SELECT id INTO v_settlement_id FROM public.courier_settlements
    WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;
    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;
    v_key := 'qa-settle-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id, 'financial_account_id', v_cash, 'client_txn_key', v_key
    ));
    SELECT current_balance INTO v_cash_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_cash_after - v_cash_before = 1920.00, 'net 1920');
    PERFORM public._erp_qa_cleanup_tracking('QA-SETTLE-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_lifecycle', 'status', 'PASS', 'net_received', 1920.00
    ));
  EXCEPTION WHEN OTHERS THEN
    PERFORM public._erp_qa_cleanup_tracking('QA-SETTLE-');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 7, 'name', 'settlement_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 8
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT coalesce(qty_reserved, 0) INTO v_reserved_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    v_key := 'qa-cancel-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.place_online_order(jsonb_build_object(
      'organization_slug', v_ctx->>'org_slug',
      'client_txn_key', v_key,
      'customer_name', 'Cancel Customer', 'phone', '01733334444',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1))
    ));
    v_sale_id := (v_result->>'sale_id')::uuid;
    PERFORM public.cancel_online_order(jsonb_build_object('sale_id', v_sale_id, 'reason', 'QA cancel'));
    SELECT coalesce(qty_reserved, 0) INTO v_reserved_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_reserved_after = v_reserved_before, 'reservation released');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 8, 'name', 'cancel_release_reservation', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 8, 'name', 'cancel_release_reservation', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 9: deactivate prior rule before creating return-test rule
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT id INTO v_rule_id FROM public.salesman_commission_rules
    WHERE organization_id = v_org AND profile_id = v_actor AND is_active = true AND deleted_at IS NULL
    LIMIT 1;
    IF v_rule_id IS NOT NULL THEN
      PERFORM public.deactivate_commission_rule(v_rule_id);
    END IF;
    PERFORM public.upsert_commission_rule(jsonb_build_object(
      'profile_id', v_actor, 'rule_type', 'percent_sale', 'rate', 10,
      'effective_from', (timezone('utc', now()))::date
    ));

    v_key := 'qa-ret-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key, 'salesperson_id', v_actor,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 2, 'unit_price', 100.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 200.00, 'financial_account_id', v_cash))
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT commission_amount INTO v_comm_before FROM public.salesman_commissions
    WHERE sale_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_comm_before = 20.00, '10% of 200');

    SELECT id INTO v_sti_id FROM public.sale_items WHERE sale_id = v_sale_id AND deleted_at IS NULL LIMIT 1;
    PERFORM public.approve_sales_return(jsonb_build_object(
      'sale_id', v_sale_id,
      'client_txn_key', 'ret-' || v_key,
      'refund_account_id', v_cash,
      'items', jsonb_build_array(jsonb_build_object('sale_item_id', v_sti_id, 'qty', 1, 'condition', 'sellable'))
    ));
    SELECT commission_amount INTO v_comm_after FROM public.salesman_commissions
    WHERE sale_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_comm_after < v_comm_before, 'commission reduced');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 9, 'name', 'sales_return_commission_reversal', 'status', 'PASS',
      'commission_before', v_comm_before, 'commission_after', v_comm_after
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 9, 'name', 'sales_return_commission_reversal', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 10
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_key := 'qa-pret-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.complete_purchase(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', v_supplier, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 4, 'unit_cost', 80.00)),
      'payments', '[]'::jsonb
    ));
    v_purchase_id := (v_result->>'purchase_id')::uuid;
    SELECT id INTO v_purchase_item_id FROM public.purchase_items
    WHERE purchase_id = v_purchase_id AND deleted_at IS NULL LIMIT 1;
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT quantity INTO v_qty_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    SELECT current_due INTO v_supplier_due_before FROM public.suppliers WHERE id = v_supplier;

    PERFORM public.approve_purchase_return(jsonb_build_object(
      'purchase_id', v_purchase_id,
      'client_txn_key', 'pr-' || v_key,
      'items', jsonb_build_array(jsonb_build_object('purchase_item_id', v_purchase_item_id, 'qty', 2))
    ));
    SELECT quantity INTO v_qty_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    SELECT current_due INTO v_supplier_due_after FROM public.suppliers WHERE id = v_supplier;
    PERFORM public._erp_assert(v_qty_before - v_qty_after = 2, 'stock -2');
    PERFORM public._erp_assert(v_supplier_due_before - v_supplier_due_after = 160.00, 'supplier due -160');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 10, 'name', 'purchase_return', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 10, 'name', 'purchase_return', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 11
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;
    v_key := 'qa-exp-' || replace(gen_random_uuid()::text, '-', '');
    v_expense_id := public.create_expense(jsonb_build_object(
      'branch_id', v_branch, 'category_id', v_exp_cat, 'account_id', v_cash,
      'amount', 75.00, 'client_txn_key', v_key, 'note', 'QA expense'
    ));
    SELECT current_balance INTO v_cash_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_cash_before - v_cash_after = 75.00, 'cash -75');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 11, 'name', 'branch_expense', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 11, 'name', 'branch_expense', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 12
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT id INTO v_rule_id FROM public.salesman_commission_rules
    WHERE organization_id = v_org AND profile_id = v_actor AND is_active = true AND deleted_at IS NULL
    LIMIT 1;
    IF v_rule_id IS NOT NULL THEN
      PERFORM public.deactivate_commission_rule(v_rule_id);
    END IF;
    PERFORM public.upsert_commission_rule(jsonb_build_object(
      'profile_id', v_actor, 'rule_type', 'fixed', 'rate', 25,
      'effective_from', (timezone('utc', now()))::date
    ));

    v_key := 'qa-comm-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key, 'salesperson_id', v_actor,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 200.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 200.00, 'financial_account_id', v_cash))
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT id INTO v_comm_id FROM public.salesman_commissions WHERE sale_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public.approve_sales_commission(v_comm_id);
    SELECT current_balance INTO v_cash_before FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public.pay_sales_commission(jsonb_build_object(
      'commission_id', v_comm_id, 'financial_account_id', v_cash, 'client_txn_key', 'pay-' || v_key
    ));
    SELECT current_balance INTO v_cash_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_cash_before - v_cash_after = 25.00, 'paid 25');

    v_key := 'qa-rej-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key, 'salesperson_id', v_actor,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 100.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100.00, 'financial_account_id', v_cash))
    ));
    SELECT id INTO v_comm_id FROM public.salesman_commissions
    WHERE sale_id = (v_sale_result->>'sale_id')::uuid AND deleted_at IS NULL;
    PERFORM public.reject_sales_commission(v_comm_id, 'QA reject');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 14
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_key := 'qa-void-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 150.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 150.00, 'financial_account_id', v_cash))
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT count(*) INTO v_jcount FROM public.journal_entries
    WHERE source_type = 'sale' AND source_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_jcount >= 1, 'original journal');
    v_result := public.void_sale(v_sale_id, 'QA void test');
    SELECT count(*) INTO v_jcount FROM public.journal_entries
    WHERE source_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_jcount >= 2, 'original + reversal');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 14, 'name', 'void_sale_reversal', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 14, 'name', 'void_sale_reversal', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Reconciliation
  BEGIN
    v_recon := public._erp_qa_reconcile_sandbox();
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_internal_reconciliation',
      'status', coalesce(v_recon->>'status', 'FAIL'), 'detail', v_recon
    ));
    SELECT count(*) INTO v_jcount FROM public.v_recon_inventory_ledger_qty WHERE organization_id = v_org;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_excluded_from_recon_views',
      'status', CASE WHEN v_jcount = 0 THEN 'PASS' ELSE 'FAIL' END,
      'sandbox_mismatches_in_view', v_jcount
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'reconciliation', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  RETURN jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'sandbox_org', v_org,
    'results', v_results,
    'pass_count', (SELECT count(*) FROM jsonb_array_elements(v_results) e WHERE e->>'status' = 'PASS'),
    'fail_count', (SELECT count(*) FROM jsonb_array_elements(v_results) e WHERE e->>'status' = 'FAIL'),
    'partial_count', (SELECT count(*) FROM jsonb_array_elements(v_results) e WHERE e->>'status' = 'PARTIAL')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_acceptance_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_acceptance_report() TO service_role;
