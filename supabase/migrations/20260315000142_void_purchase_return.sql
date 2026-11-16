-- void_purchase_return: full reverse of approve_purchase_return
-- Restocks inventory, restores supplier/purchase due, voids cash refund FTs, reverses journal.

CREATE OR REPLACE FUNCTION public.void_purchase_return(return_id uuid, reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_return public.purchase_returns%ROWTYPE;
  v_purchase public.purchases%ROWTYPE;
  v_item public.purchase_return_items%ROWTYPE;
  v_txn public.financial_transactions%ROWTYPE;
  v_loc uuid;
  v_reason text;
  v_due_reduce numeric(14, 2) := 0;
  v_cash_voided numeric(14, 2) := 0;
  v_new_due numeric(14, 2);
  v_rev_journal uuid;
  v_fa_delta numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('purchases.return')
    OR public.user_has_permission('purchases.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission for purchase return void' USING ERRCODE = '42501';
  END IF;

  v_reason := NULLIF(btrim(reason), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Void reason is required';
  END IF;

  IF return_id IS NULL THEN
    RAISE EXCEPTION 'return_id is required';
  END IF;

  SELECT * INTO v_return
  FROM public.purchase_returns pr
  WHERE pr.id = return_id
    AND pr.organization_id = v_org_id
    AND pr.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase return not found';
  END IF;

  IF NOT public.user_has_branch_access(v_return.branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_return.status = 'cancelled' THEN
    RETURN jsonb_build_object(
      'purchase_return_id', v_return.id,
      'status', 'cancelled',
      'idempotent', true
    );
  END IF;

  IF v_return.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed purchase returns can be voided';
  END IF;

  SELECT * INTO v_purchase
  FROM public.purchases p
  WHERE p.id = v_return.purchase_id
    AND p.organization_id = v_org_id
    AND p.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Linked purchase not found';
  END IF;

  v_loc := public._saleable_location(v_org_id, v_return.branch_id);
  IF v_loc IS NULL THEN
    RAISE EXCEPTION 'No saleable stock location for branch';
  END IF;

  -- Restock each returned line (approve moved stock out with purchase_return)
  FOR v_item IN
    SELECT *
    FROM public.purchase_return_items pri
    WHERE pri.purchase_return_id = v_return.id
      AND pri.deleted_at IS NULL
  LOOP
    PERFORM public._adjust_inventory(
      v_org_id,
      v_return.branch_id,
      v_item.variant_id,
      v_loc,
      v_item.qty,
      v_item.unit_cost,
      'correction',
      'purchase_return',
      v_return.id,
      v_profile_id,
      'Void purchase return restock: ' || v_reason
    );
  END LOOP;

  -- Restore supplier due from original return_credit ledger rows
  SELECT coalesce(sum(sl.credit), 0) INTO v_due_reduce
  FROM public.supplier_ledger sl
  WHERE sl.organization_id = v_org_id
    AND sl.reference_type = 'purchase_return'
    AND sl.reference_id = v_return.id
    AND sl.entry_type = 'return_credit'
    AND sl.deleted_at IS NULL;

  IF v_due_reduce > 0 THEN
    PERFORM public._post_supplier_ledger_entry(
      v_org_id,
      v_return.branch_id,
      v_return.supplier_id,
      'reversal',
      v_due_reduce,
      0,
      'purchase_return',
      v_return.id,
      'Void purchase return ' || v_return.return_no || ': ' || v_reason,
      v_profile_id,
      false
    );

    v_new_due := coalesce(v_purchase.due_total, 0) + v_due_reduce;
    UPDATE public.purchases
    SET due_total = v_new_due,
        payment_status = CASE
          WHEN v_new_due <= 0 AND coalesce(paid_total, 0) >= coalesce(grand_total, 0) THEN 'paid'
          WHEN coalesce(paid_total, 0) > 0 THEN 'partial'
          ELSE 'unpaid'
        END,
        updated_by = v_profile_id
    WHERE id = v_purchase.id;
  END IF;

  -- Void cash refund financial transactions (approve posted direction 'in')
  FOR v_txn IN
    SELECT *
    FROM public.financial_transactions ft
    WHERE ft.organization_id = v_org_id
      AND ft.source_type = 'purchase_return'
      AND ft.source_id = v_return.id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
    FOR UPDATE
  LOOP
    IF v_txn.direction = 'in' THEN
      v_fa_delta := -v_txn.amount;
    ELSE
      v_fa_delta := v_txn.amount;
    END IF;

    PERFORM public.adjust_financial_account_balance(v_txn.account_id, v_fa_delta);

    UPDATE public.financial_transactions
    SET status = 'voided',
        voided_at = timezone('utc', now()),
        voided_by = v_profile_id,
        void_reason = v_reason
    WHERE id = v_txn.id;

    v_cash_voided := v_cash_voided + v_txn.amount;
  END LOOP;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id,
    v_return.branch_id,
    'purchase_return',
    v_return.id,
    'Void purchase return ' || v_return.return_no || ': ' || v_reason,
    v_profile_id
  );

  UPDATE public.purchase_returns
  SET status = 'cancelled',
      reason = coalesce(v_return.reason, '') || CASE
        WHEN v_return.reason IS NULL OR btrim(v_return.reason) = '' THEN v_reason
        ELSE ' | void: ' || v_reason
      END,
      updated_by = v_profile_id
  WHERE id = v_return.id;

  PERFORM public.write_audit_log(
    v_org_id, v_return.branch_id, v_profile_id,
    'purchase_return.void', 'purchase_return', v_return.id,
    jsonb_build_object('status', 'completed', 'total', v_return.total),
    jsonb_build_object(
      'status', 'cancelled',
      'reason', v_reason,
      'due_restored', v_due_reduce,
      'cash_voided', v_cash_voided,
      'reversing_journal_id', v_rev_journal
    ),
    v_reason,
    jsonb_build_object('source', 'void_purchase_return')
  );

  RETURN jsonb_build_object(
    'purchase_return_id', v_return.id,
    'status', 'cancelled',
    'due_restored', v_due_reduce,
    'cash_voided', v_cash_voided,
    'reversing_journal_id', v_rev_journal,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.void_purchase_return(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_purchase_return(uuid, text) TO authenticated;
