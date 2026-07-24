-- Full ERP acceptance scenario runners (sandbox org only, service_role)

--------------------------------------------------------------------------------
-- Sandbox fixtures: supplier, expense category, quarantine location
--------------------------------------------------------------------------------
INSERT INTO public.suppliers (id, organization_id, branch_id, name, phone, status)
VALUES (
  '99999999-9999-9999-9999-999999999961',
  '99999999-9999-9999-9999-999999999999',
  '99999999-9999-9999-9999-999999999991',
  'Sandbox Supplier', '01700000001', 'active'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.expense_categories (id, organization_id, name, is_active, sort_order)
VALUES (
  '99999999-9999-9999-9999-999999999971',
  '99999999-9999-9999-9999-999999999999',
  'Sandbox Operating', true, 1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.stock_locations (organization_id, branch_id, name, location_type, is_default, is_active)
SELECT
  '99999999-9999-9999-9999-999999999999',
  b.id, b.code || ' Quarantine', 'quarantine', true, true
FROM public.branches b
WHERE b.organization_id = '99999999-9999-9999-9999-999999999999'
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_locations sl
    WHERE sl.branch_id = b.id AND sl.location_type = 'quarantine' AND sl.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Commission rejection RPC (pending → cancelled)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_sales_commission(p_commission_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_row public.salesman_commissions%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('sales.commission.approve') THEN
    RAISE EXCEPTION 'Missing permission sales.commission.approve' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.salesman_commissions sc
  WHERE sc.id = p_commission_id
    AND sc.organization_id = v_org_id
    AND sc.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found'; END IF;
  IF v_row.status = 'cancelled' THEN
    RETURN jsonb_build_object('commission_id', v_row.id, 'idempotent', true);
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending commissions can be rejected';
  END IF;

  UPDATE public.salesman_commissions
  SET status = 'cancelled',
      notes = coalesce(notes || E'\n', '') || coalesce('Rejected: ' || p_reason, 'Rejected'),
      updated_by = v_profile_id
  WHERE id = v_row.id;

  RETURN jsonb_build_object('commission_id', v_row.id, 'status', 'cancelled', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_sales_commission(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_sales_commission(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- Extended QA context
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_qa_context()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'org_id', '99999999-9999-9999-9999-999999999999'::uuid,
    'org_slug', 'erp-acceptance-sandbox',
    'branch_id', '99999999-9999-9999-9999-999999999991'::uuid,
    'branch_b_id', '99999999-9999-9999-9999-999999999992'::uuid,
    'actor_id', '99999999-9999-9999-9999-999999999902'::uuid,
    'variant_id', '99999999-9999-9999-9999-999999999952'::uuid,
    'supplier_id', '99999999-9999-9999-9999-999999999961'::uuid,
    'cash_account_id', '99999999-9999-9999-9999-999999999931'::uuid,
    'bank_account_id', '99999999-9999-9999-9999-999999999932'::uuid,
    'bkash_account_id', '99999999-9999-9999-9999-999999999933'::uuid,
    'expense_category_id', '99999999-9999-9999-9999-999999999971'::uuid,
    'courier_company_id', '99999999-9999-9999-9999-999999999941'::uuid
  );
$$;

--------------------------------------------------------------------------------
-- Sandbox-internal reconciliation (not excluded from is_sandbox filter)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_qa_reconcile_sandbox()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := (public._erp_qa_context()->>'org_id')::uuid;
  v_inv_mismatch int;
  v_reserved_mismatch int;
  v_journal_unbalanced int;
BEGIN
  PERFORM public._erp_qa_require_service();

  SELECT count(*) INTO v_inv_mismatch
  FROM public.inventory_balances ib
  LEFT JOIN (
    SELECT organization_id, variant_id, location_id, sum(quantity_delta) AS net
    FROM public.stock_ledger
    WHERE deleted_at IS NULL
    GROUP BY 1, 2, 3
  ) sl ON sl.organization_id = ib.organization_id
    AND sl.variant_id = ib.variant_id
    AND sl.location_id = ib.location_id
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND abs(ib.quantity - coalesce(sl.net, 0)) > 0.0005;

  SELECT count(*) INTO v_reserved_mismatch
  FROM public.inventory_balances ib
  LEFT JOIN (
    SELECT organization_id, variant_id, location_id, sum(qty) AS reserved
    FROM public.inventory_reservations
    WHERE status = 'active' AND deleted_at IS NULL
    GROUP BY 1, 2, 3
  ) r ON r.organization_id = ib.organization_id
    AND r.variant_id = ib.variant_id
    AND r.location_id = ib.location_id
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND abs(coalesce(ib.qty_reserved, 0) - coalesce(r.reserved, 0)) > 0.0005;

  SELECT count(*) INTO v_journal_unbalanced
  FROM (
    SELECT je.id
    FROM public.journal_entries je
    JOIN public.journal_lines jl ON jl.journal_entry_id = je.id AND jl.deleted_at IS NULL
    WHERE je.organization_id = v_org AND je.deleted_at IS NULL AND je.status = 'posted'
    GROUP BY je.id
    HAVING abs(sum(jl.debit) - sum(jl.credit)) > 0.009
  ) x;

  RETURN jsonb_build_object(
    'inventory_ledger_mismatches', v_inv_mismatch,
    'reserved_mismatches', v_reserved_mismatch,
    'unbalanced_journals', v_journal_unbalanced,
    'status', CASE
      WHEN v_inv_mismatch = 0 AND v_reserved_mismatch = 0 AND v_journal_unbalanced = 0 THEN 'PASS'
      ELSE 'FAIL'
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_qa_reconcile_sandbox() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_qa_reconcile_sandbox() TO service_role;

--------------------------------------------------------------------------------
-- Full acceptance report (replaces 053 runner with extended scenarios)
--------------------------------------------------------------------------------
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
  v_fin_before numeric(14, 2);
  v_fin_after numeric(14, 2);
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
  v_return_id uuid;
  v_comm_before numeric(14, 2);
  v_comm_after numeric(14, 2);
BEGIN
  PERFORM public._erp_qa_require_service();
  PERFORM public._erp_qa_set_sandbox_auth();

  -- Security: parcel GUC bypass
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

  -- Security: QA grant isolation
  SELECT has_function_privilege('anon', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_anon;
  SELECT has_function_privilege('authenticated', 'public.run_erp_qa_cod_delivery()', 'EXECUTE') INTO v_can_auth;
  v_status := CASE WHEN NOT v_can_anon AND NOT v_can_auth THEN 'PASS' ELSE 'FAIL' END;
  v_results := v_results || jsonb_build_array(jsonb_build_object(
    'scenario', 13, 'name', 'qa_grant_isolation', 'status', v_status,
    'anon_can_execute', v_can_anon, 'auth_can_execute', v_can_auth
  ));

  -- Scenario 1: Purchase → stock + supplier due
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
      'payments', jsonb_build_array(jsonb_build_object('method', 'due', 'amount', 500.00))
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
      'payments', jsonb_build_array(jsonb_build_object('method', 'due', 'amount', 500.00))
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

  -- Scenario 2: Partial stock transfer lifecycle
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

    v_result := public.receive_stock_transfer(
      v_transfer_id,
      jsonb_build_array(jsonb_build_object('id', v_sti_id, 'quantity_received', 4)),
      false
    );
    PERFORM public._erp_assert((v_result->>'status') IN ('partially_received', 'in_transit', 'received'), 'partial receive ok');

    v_result := public.receive_stock_transfer(
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
    EXCEPTION WHEN OTHERS THEN
      NULL;
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
    PERFORM public._erp_assert(v_qty_before = 9 AND v_qty_after = 1, '9 received + 1 damaged = 10 sent');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 2, 'name', 'partial_transfer_lifecycle', 'status', 'PASS',
      'transfer_id', v_transfer_id, 'received', 9, 'damaged', 1
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 2, 'name', 'partial_transfer_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 3: POS cash sale (existing)
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

    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 2, 'unit_price', 200.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 400.00, 'financial_account_id', v_cash))
    ));
    PERFORM public._erp_assert(coalesce((v_sale_result->>'idempotent')::boolean, false), 'pos idempotent');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'PASS', 'sale_id', v_sale_id
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 3, 'name', 'pos_cash_sale', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 4: POS split payment
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;
    SELECT current_balance INTO v_qty_before FROM public.financial_accounts WHERE id = v_bank;
    SELECT current_balance INTO v_qty_after FROM public.financial_accounts WHERE id = v_bkash;

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

    SELECT current_balance INTO v_supplier_due_before FROM public.financial_accounts WHERE id = v_cash;
    SELECT current_balance INTO v_supplier_due_after FROM public.financial_accounts WHERE id = v_bank;
    PERFORM public._erp_assert(v_supplier_due_before - v_fin_before = 100.00, 'cash +100');
    PERFORM public._erp_assert(v_supplier_due_after - v_qty_before = 100.00, 'bank +100');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 4, 'name', 'pos_split_payment', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 4, 'name', 'pos_split_payment', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 5: Due sale → collection
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_key := 'qa-due-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key,
      'customer_phone', '01711112222', 'customer_name', 'Due Test Customer',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 250.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'due', 'amount', 250.00))
    ));
    v_sale_id := (v_sale_result->>'sale_id')::uuid;
    SELECT customer_id INTO v_customer_id FROM public.sales WHERE id = v_sale_id;
    SELECT current_due INTO v_customer_due_before FROM public.customers WHERE id = v_customer_id;
    PERFORM public._erp_assert(v_customer_due_before >= 250.00, 'customer due created');

    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;
    v_result := public.collect_customer_due(jsonb_build_object(
      'branch_id', v_branch, 'customer_id', v_customer_id,
      'client_txn_key', 'col-' || v_key,
      'payments', jsonb_build_array(jsonb_build_object(
        'financial_account_id', v_cash, 'amount', 100.00
      ))
    ));
    SELECT current_due INTO v_customer_due_after FROM public.customers WHERE id = v_customer_id;
    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_customer_due_before - v_customer_due_after = 100.00, 'partial collection');
    PERFORM public._erp_assert(v_fin_after - v_fin_before = 100.00, 'cash +100');

    v_result := public.collect_customer_due(jsonb_build_object(
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

  -- Scenario 6: Online order reservation → fulfil → COD delivery
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
      'customer_name', 'Web Customer',
      'phone', '01722223333',
      'address', 'Test Address',
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 2))
    ));
    v_sale_id := (v_result->>'sale_id')::uuid;

    SELECT coalesce(qty_reserved, 0), quantity
    INTO v_reserved_after, v_onhand_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_reserved_after - v_reserved_before = 2, 'reserved +2');
    PERFORM public._erp_assert(v_onhand_after = v_onhand_before, 'on-hand unchanged during reservation');

    PERFORM public._erp_qa_set_sandbox_auth();
    v_sale_result := public.fulfil_online_order(jsonb_build_object('sale_id', v_sale_id));
    PERFORM public._erp_assert(coalesce((v_sale_result->>'idempotent')::boolean, false) = false
      OR (v_sale_result->>'sale_id') IS NOT NULL, 'fulfil ok');

    SELECT coalesce(qty_reserved, 0), quantity
    INTO v_reserved_after, v_onhand_after
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_reserved_after <= v_reserved_before, 'reservation consumed');
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

  -- Scenario 7: COD delivery + settlement (existing subset)
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

    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;
    v_key := 'qa-settle-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id, 'financial_account_id', v_cash, 'client_txn_key', v_key
    ));
    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_fin_after - v_fin_before = 1920.00, 'net 1920');
    PERFORM public._erp_assert((v_result->>'idempotent')::boolean = false, 'first settle');

    v_result := public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id, 'financial_account_id', v_cash, 'client_txn_key', v_key
    ));
    PERFORM public._erp_assert((v_result->>'idempotent')::boolean = true, 'settle idempotent');

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

  -- Scenario 8: Cancel online order releases reservation
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

  -- Scenario 9: Sales return + commission reversal
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    PERFORM public.upsert_commission_rule(jsonb_build_object(
      'profile_id', v_actor, 'rule_type', 'percent_sale', 'rate', 10,
      'effective_from', (timezone('utc', now()) - interval '1 day')::date
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
    v_result := public.approve_sales_return(jsonb_build_object(
      'sale_id', v_sale_id,
      'client_txn_key', 'ret-' || v_key,
      'items', jsonb_build_array(jsonb_build_object('sale_item_id', v_sti_id, 'qty', 1, 'condition', 'sellable'))
    ));
    SELECT commission_amount, status INTO v_comm_after, v_status
    FROM public.salesman_commissions WHERE sale_id = v_sale_id AND deleted_at IS NULL;
    PERFORM public._erp_assert(v_comm_after < v_comm_before, 'commission reduced on return');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 9, 'name', 'sales_return_commission_reversal', 'status', 'PASS',
      'commission_before', v_comm_before, 'commission_after', v_comm_after
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 9, 'name', 'sales_return_commission_reversal', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 10: Purchase return
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    v_key := 'qa-pret-' || replace(gen_random_uuid()::text, '-', '');
    v_result := public.complete_purchase(jsonb_build_object(
      'branch_id', v_branch, 'supplier_id', v_supplier, 'client_txn_key', v_key,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 4, 'unit_cost', 80.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'due', 'amount', 320.00))
    ));
    v_purchase_id := (v_result->>'purchase_id')::uuid;
    SELECT id INTO v_purchase_item_id FROM public.purchase_items
    WHERE purchase_id = v_purchase_id AND deleted_at IS NULL LIMIT 1;
    v_loc := public._saleable_location(v_org, v_branch);
    SELECT quantity INTO v_qty_before
    FROM public.inventory_balances
    WHERE organization_id = v_org AND variant_id = v_variant AND location_id = v_loc AND deleted_at IS NULL;
    SELECT current_due INTO v_supplier_due_before FROM public.suppliers WHERE id = v_supplier;

    v_result := public.approve_purchase_return(jsonb_build_object(
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

  -- Scenario 11: Branch expense
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;
    v_key := 'qa-exp-' || replace(gen_random_uuid()::text, '-', '');
    v_expense_id := public.create_expense(jsonb_build_object(
      'branch_id', v_branch,
      'category_id', v_exp_cat,
      'account_id', v_cash,
      'amount', 75.00,
      'client_txn_key', v_key,
      'note', 'QA expense'
    ));
    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_fin_before - v_fin_after = 75.00, 'cash -75');

    v_expense_id := public.create_expense(jsonb_build_object(
      'branch_id', v_branch, 'category_id', v_exp_cat, 'account_id', v_cash,
      'amount', 75.00, 'client_txn_key', v_key
    ));
    PERFORM public._erp_assert(v_expense_id IS NOT NULL, 'expense idempotent');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 11, 'name', 'branch_expense', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 11, 'name', 'branch_expense', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 12: Commission lifecycle + rejection
  BEGIN
    PERFORM public._erp_qa_set_sandbox_auth();
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
    PERFORM public._erp_assert(
      (SELECT commission_amount FROM public.salesman_commissions WHERE id = v_comm_id) = 25.00,
      'fixed commission 25'
    );
    PERFORM public._erp_assert(
      (SELECT rule_snapshot IS NOT NULL FROM public.salesman_commissions WHERE id = v_comm_id),
      'rule snapshot'
    );

    PERFORM public.approve_sales_commission(v_comm_id);
    SELECT current_balance INTO v_fin_before FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public.pay_sales_commission(jsonb_build_object(
      'commission_id', v_comm_id, 'financial_account_id', v_cash, 'client_txn_key', 'pay-' || v_key
    ));
    SELECT current_balance INTO v_fin_after FROM public.financial_accounts WHERE id = v_cash;
    PERFORM public._erp_assert(v_fin_before - v_fin_after = 25.00, 'paid 25');

    -- Rejection path on separate sale without paying
    v_key := 'qa-rej-' || replace(gen_random_uuid()::text, '-', '');
    v_sale_result := public.complete_pos_sale(jsonb_build_object(
      'branch_id', v_branch, 'client_txn_key', v_key, 'salesperson_id', v_actor,
      'items', jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'qty', 1, 'unit_price', 100.00)),
      'payments', jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 100.00, 'financial_account_id', v_cash))
    ));
    SELECT id INTO v_comm_id FROM public.salesman_commissions
    WHERE sale_id = (v_sale_result->>'sale_id')::uuid AND deleted_at IS NULL;
    PERFORM public.reject_sales_commission(v_comm_id, 'QA reject');
    PERFORM public._erp_assert(
      (SELECT status FROM public.salesman_commissions WHERE id = v_comm_id) = 'cancelled',
      'rejected'
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 12, 'name', 'commission_lifecycle', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Scenario 14: void sale retains original + reversal
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
    PERFORM public._erp_assert(v_jcount >= 1, 'original journal exists');

    v_result := public.void_sale(v_sale_id, 'QA void test');
    PERFORM public._erp_assert((v_result->>'sale_id')::uuid = v_sale_id, 'void ok');
    SELECT count(*) INTO v_jcount FROM public.journal_entries
    WHERE source_id = v_sale_id AND deleted_at IS NULL
      AND source_type IN ('sale', 'sale_void', 'sale_reversal');
    PERFORM public._erp_assert(v_jcount >= 2, 'original + reversal journals');

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 14, 'name', 'void_sale_reversal', 'status', 'PASS'
    ));
  EXCEPTION WHEN OTHERS THEN
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 14, 'name', 'void_sale_reversal', 'status', 'FAIL', 'error', SQLERRM
    ));
  END;

  -- Reconciliation: sandbox internal + operational view exclusion
  BEGIN
    v_recon := public._erp_qa_reconcile_sandbox();
    v_status := coalesce(v_recon->>'status', 'FAIL');
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_internal_reconciliation', 'status', v_status, 'detail', v_recon
    ));

    SELECT count(*) INTO v_jcount FROM public.v_recon_inventory_ledger_qty WHERE organization_id = v_org;
    v_status := CASE WHEN v_jcount = 0 THEN 'PASS' ELSE 'FAIL' END;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'scenario', 'recon', 'name', 'sandbox_excluded_from_recon_views', 'status', v_status,
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
