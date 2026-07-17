-- Reconciliation dry-run/apply RPCs, views, and report helpers
-- Production rollout: invoke dry-run only; apply remains installed but unused.

--------------------------------------------------------------------------------
-- Views
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_recon_inventory_without_ledger AS
SELECT
  ib.organization_id,
  sl.branch_id,
  ib.variant_id,
  ib.location_id,
  ib.quantity,
  coalesce(ib.qty_reserved, 0) AS qty_reserved,
  ib.id AS inventory_balance_id
FROM public.inventory_balances ib
JOIN public.stock_locations sl ON sl.id = ib.location_id
WHERE ib.deleted_at IS NULL
  AND ib.quantity <> 0
  AND NOT EXISTS (
    SELECT 1 FROM public.stock_ledger l
    WHERE l.organization_id = ib.organization_id
      AND l.variant_id = ib.variant_id
      AND l.location_id = ib.location_id
      AND l.deleted_at IS NULL
  );

CREATE OR REPLACE VIEW public.v_recon_customer_due_vs_sales AS
SELECT
  c.organization_id,
  c.id AS customer_id,
  c.name,
  c.current_due AS customer_due,
  coalesce((
    SELECT sum(s.due_total)
    FROM public.sales s
    WHERE s.customer_id = c.id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
  ), 0) AS open_sale_due,
  c.current_due - coalesce((
    SELECT sum(s.due_total)
    FROM public.sales s
    WHERE s.customer_id = c.id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
  ), 0) AS delta
FROM public.customers c
WHERE c.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_recon_supplier_due_vs_purchases AS
SELECT
  s.organization_id,
  s.id AS supplier_id,
  s.name,
  s.current_due AS supplier_due,
  coalesce((
    SELECT sum(p.due_total)
    FROM public.purchases p
    WHERE p.supplier_id = s.id
      AND p.deleted_at IS NULL
      AND p.status = 'completed'
  ), 0) AS open_purchase_due,
  s.current_due - coalesce((
    SELECT sum(p.due_total)
    FROM public.purchases p
    WHERE p.supplier_id = s.id
      AND p.deleted_at IS NULL
      AND p.status = 'completed'
  ), 0) AS delta
FROM public.suppliers s
WHERE s.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_recon_financial_running_balance AS
SELECT
  fa.organization_id,
  fa.id AS account_id,
  fa.name,
  fa.current_balance,
  (
    SELECT ft.balance_after
    FROM public.financial_transactions ft
    WHERE ft.account_id = fa.id
      AND ft.deleted_at IS NULL
      AND coalesce(ft.status, 'posted') = 'posted'
      AND ft.voided_at IS NULL
    ORDER BY ft.created_at DESC, ft.id DESC
    LIMIT 1
  ) AS last_txn_balance_after,
  fa.current_balance - coalesce((
    SELECT ft.balance_after
    FROM public.financial_transactions ft
    WHERE ft.account_id = fa.id
      AND ft.deleted_at IS NULL
      AND coalesce(ft.status, 'posted') = 'posted'
      AND ft.voided_at IS NULL
    ORDER BY ft.created_at DESC, ft.id DESC
    LIMIT 1
  ), fa.opening_balance) AS delta
FROM public.financial_accounts fa
WHERE fa.deleted_at IS NULL;

CREATE OR REPLACE VIEW public.v_recon_unbalanced_journals AS
SELECT
  je.organization_id,
  je.id AS journal_entry_id,
  je.entry_no,
  je.source_type,
  je.source_id,
  coalesce(sum(jl.debit), 0) AS total_debit,
  coalesce(sum(jl.credit), 0) AS total_credit,
  coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0) AS delta
FROM public.journal_entries je
LEFT JOIN public.journal_lines jl
  ON jl.journal_entry_id = je.id AND jl.deleted_at IS NULL
WHERE je.deleted_at IS NULL
  AND je.status = 'posted'
GROUP BY je.organization_id, je.id, je.entry_no, je.source_type, je.source_id
HAVING abs(coalesce(sum(jl.debit), 0) - coalesce(sum(jl.credit), 0)) > 0.009;

--------------------------------------------------------------------------------
-- Batch helpers (match 030 schema)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._recon_start_batch(
  p_org_id uuid,
  p_batch_type text,
  p_mode text,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.reconciliation_batches (
    organization_id, batch_type, mode, status, summary, created_by
  ) VALUES (
    p_org_id, p_batch_type, p_mode, 'running', '{}'::jsonb, p_actor
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._recon_finish_batch(
  p_batch_id uuid,
  p_ok boolean,
  p_summary jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.reconciliation_batches
  SET status = CASE WHEN p_ok THEN 'completed' ELSE 'failed' END,
      summary = coalesce(p_summary, '{}'::jsonb),
      completed_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  WHERE id = p_batch_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._recon_add_result(
  p_org_id uuid,
  p_batch_id uuid,
  p_check_key text,
  p_entity_type text,
  p_entity_id uuid,
  p_message text,
  p_before jsonb,
  p_after jsonb,
  p_difference jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.reconciliation_results (
    organization_id, batch_id, check_key, entity_type, entity_id,
    before_value, after_value, difference, message
  ) VALUES (
    p_org_id, p_batch_id, p_check_key, p_entity_type, p_entity_id,
    p_before, p_after, p_difference, p_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public._recon_start_batch(uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recon_finish_batch(uuid, boolean, jsonb)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._recon_add_result(uuid, uuid, text, text, uuid, text, jsonb, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;

--------------------------------------------------------------------------------
-- Opening stock ledger dry-run / apply (quantity unchanged)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recon_opening_stock_ledger(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text;
  v_batch_id uuid;
  r record;
  v_count int := 0;
  v_qty_total numeric(14, 3) := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('reconciliation.run')
    OR public.user_has_permission('reconciliation.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation permission' USING ERRCODE = '42501';
  END IF;

  v_mode := lower(coalesce(NULLIF(payload->>'mode', ''), 'dry_run'));
  IF v_mode NOT IN ('dry_run', 'apply') THEN
    RAISE EXCEPTION 'mode must be dry_run or apply';
  END IF;
  IF v_mode = 'apply' AND NOT (
    public.user_has_permission('reconciliation.apply')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation.apply permission' USING ERRCODE = '42501';
  END IF;

  v_batch_id := public._recon_start_batch(
    v_org_id, 'opening_stock_ledger', v_mode, v_profile_id
  );

  FOR r IN
    SELECT * FROM public.v_recon_inventory_without_ledger v
    WHERE v.organization_id = v_org_id
    ORDER BY v.variant_id, v.location_id
  LOOP
    v_count := v_count + 1;
    v_qty_total := v_qty_total + r.quantity;
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'inventory_balance_id', r.inventory_balance_id,
      'variant_id', r.variant_id,
      'location_id', r.location_id,
      'quantity', r.quantity
    ));

    PERFORM public._recon_add_result(
      v_org_id, v_batch_id, 'missing_opening_ledger',
      'inventory_balance', r.inventory_balance_id,
      'Balance has quantity but no stock_ledger history',
      jsonb_build_object('quantity', r.quantity),
      CASE WHEN v_mode = 'apply'
        THEN jsonb_build_object('quantity', r.quantity, 'ledger', 'opening')
        ELSE NULL END,
      NULL
    );

    IF v_mode = 'apply' THEN
      INSERT INTO public.stock_ledger (
        organization_id, branch_id, variant_id, location_id,
        quantity_delta, quantity_before, quantity_after, unit_cost,
        movement_type, reference_type, reference_id, notes,
        created_by, updated_by
      ) VALUES (
        v_org_id, r.branch_id, r.variant_id, r.location_id,
        r.quantity, 0, r.quantity, NULL,
        'opening', 'reconciliation', v_batch_id,
        'Opening stock ledger backfill (quantity unchanged)',
        v_profile_id, v_profile_id
      );
    END IF;
  END LOOP;

  PERFORM public._recon_finish_batch(
    v_batch_id, true,
    jsonb_build_object(
      'affected_balances', v_count,
      'qty_total', v_qty_total,
      'mode', v_mode
    )
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'mode', v_mode,
    'affected_balances', v_count,
    'qty_total', v_qty_total,
    'items', CASE WHEN v_count <= 200 THEN v_items ELSE jsonb_build_array(
      jsonb_build_object('truncated', true, 'count', v_count)
    ) END
  );
END;
$$;

--------------------------------------------------------------------------------
-- Opening AR/AP documents dry-run / apply
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recon_opening_party_balances(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text;
  v_batch_id uuid;
  r record;
  v_customers int := 0;
  v_suppliers int := 0;
  v_ar_total numeric(14, 2) := 0;
  v_ap_total numeric(14, 2) := 0;
  v_equity uuid;
  v_recv uuid;
  v_pay uuid;
  v_doc_id uuid;
  v_branch_id uuid;
  v_doc_no text;
  v_je uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('reconciliation.run')
    OR public.user_has_permission('reconciliation.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation permission' USING ERRCODE = '42501';
  END IF;

  v_mode := lower(coalesce(NULLIF(payload->>'mode', ''), 'dry_run'));
  IF v_mode = 'apply' AND NOT (
    public.user_has_permission('reconciliation.apply')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation.apply permission' USING ERRCODE = '42501';
  END IF;

  v_batch_id := public._recon_start_batch(
    v_org_id, 'opening_party_balances', v_mode, v_profile_id
  );

  v_equity := public._coa_by_role(v_org_id, 'opening_balance_equity');
  v_recv := public._coa_by_role(v_org_id, 'receivable');
  v_pay := public._coa_by_role(v_org_id, 'payable');

  SELECT b.id INTO v_branch_id
  FROM public.branches b
  WHERE b.organization_id = v_org_id AND b.deleted_at IS NULL AND b.is_active
  ORDER BY b.is_central DESC, b.created_at
  LIMIT 1;

  FOR r IN
    SELECT c.*
    FROM public.customers c
    WHERE c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND c.current_due > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.opening_balance_documents d
        WHERE d.organization_id = v_org_id
          AND d.document_type = 'customer_opening_balance'
          AND d.party_id = c.id
          AND d.deleted_at IS NULL
      )
      AND coalesce((
        SELECT sum(s.due_total) FROM public.sales s
        WHERE s.customer_id = c.id AND s.deleted_at IS NULL AND s.status = 'completed'
      ), 0) = 0
  LOOP
    v_customers := v_customers + 1;
    v_ar_total := v_ar_total + r.current_due;

    PERFORM public._recon_add_result(
      v_org_id, v_batch_id, 'opening_ar_without_document',
      'customer', r.id,
      'Customer due has no supporting sales or opening document',
      jsonb_build_object('current_due', r.current_due),
      CASE WHEN v_mode = 'apply'
        THEN jsonb_build_object('opening_document', true, 'amount', r.current_due)
        ELSE NULL END,
      NULL
    );

    IF v_mode = 'apply' THEN
      v_doc_no := 'OB-AR-' || replace(r.id::text, '-', '');
      INSERT INTO public.opening_balance_documents (
        organization_id, branch_id, document_type, party_id, amount,
        document_no, client_txn_key, notes, created_by, updated_by
      ) VALUES (
        v_org_id, coalesce(r.branch_id, v_branch_id),
        'customer_opening_balance', r.id, r.current_due,
        v_doc_no, 'ob-cust:' || r.id::text,
        'Opening AR reconciliation', v_profile_id, v_profile_id
      )
      RETURNING id INTO v_doc_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      ) VALUES (
        v_org_id, coalesce(r.branch_id, v_branch_id), r.id, 'opening',
        r.current_due, 0, r.current_due,
        'opening_balance_document', v_doc_id,
        'Opening AR', v_profile_id, v_profile_id
      );

      IF v_equity IS NOT NULL AND v_recv IS NOT NULL THEN
        v_je := public._post_journal(
          v_org_id, coalesce(r.branch_id, v_branch_id),
          'JE-' || v_doc_no,
          'opening_balance', v_doc_id,
          'Opening AR ' || r.name,
          jsonb_build_array(
            jsonb_build_object('chart_account_id', v_recv, 'debit', r.current_due, 'credit', 0),
            jsonb_build_object('chart_account_id', v_equity, 'debit', 0, 'credit', r.current_due)
          ),
          v_profile_id
        );
        UPDATE public.opening_balance_documents
        SET journal_entry_id = v_je WHERE id = v_doc_id;
      END IF;
    END IF;
  END LOOP;

  FOR r IN
    SELECT s.*
    FROM public.suppliers s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND s.current_due > 0
      AND NOT EXISTS (
        SELECT 1 FROM public.opening_balance_documents d
        WHERE d.organization_id = v_org_id
          AND d.document_type = 'supplier_opening_balance'
          AND d.party_id = s.id
          AND d.deleted_at IS NULL
      )
      AND coalesce((
        SELECT sum(p.due_total) FROM public.purchases p
        WHERE p.supplier_id = s.id AND p.deleted_at IS NULL AND p.status = 'completed'
      ), 0) = 0
  LOOP
    v_suppliers := v_suppliers + 1;
    v_ap_total := v_ap_total + r.current_due;

    PERFORM public._recon_add_result(
      v_org_id, v_batch_id, 'opening_ap_without_document',
      'supplier', r.id,
      'Supplier due has no supporting purchases or opening document',
      jsonb_build_object('current_due', r.current_due),
      CASE WHEN v_mode = 'apply'
        THEN jsonb_build_object('opening_document', true, 'amount', r.current_due)
        ELSE NULL END,
      NULL
    );

    IF v_mode = 'apply' THEN
      v_doc_no := 'OB-AP-' || replace(r.id::text, '-', '');
      INSERT INTO public.opening_balance_documents (
        organization_id, branch_id, document_type, party_id, amount,
        document_no, client_txn_key, notes, created_by, updated_by
      ) VALUES (
        v_org_id, coalesce(r.branch_id, v_branch_id),
        'supplier_opening_balance', r.id, r.current_due,
        v_doc_no, 'ob-supp:' || r.id::text,
        'Opening AP reconciliation', v_profile_id, v_profile_id
      )
      RETURNING id INTO v_doc_id;

      INSERT INTO public.supplier_ledger (
        organization_id, branch_id, supplier_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      ) VALUES (
        v_org_id, coalesce(r.branch_id, v_branch_id), r.id, 'opening',
        0, r.current_due, r.current_due,
        'opening_balance_document', v_doc_id,
        'Opening AP', v_profile_id, v_profile_id
      );

      IF v_equity IS NOT NULL AND v_pay IS NOT NULL THEN
        v_je := public._post_journal(
          v_org_id, coalesce(r.branch_id, v_branch_id),
          'JE-' || v_doc_no,
          'opening_balance', v_doc_id,
          'Opening AP ' || r.name,
          jsonb_build_array(
            jsonb_build_object('chart_account_id', v_equity, 'debit', r.current_due, 'credit', 0),
            jsonb_build_object('chart_account_id', v_pay, 'debit', 0, 'credit', r.current_due)
          ),
          v_profile_id
        );
        UPDATE public.opening_balance_documents
        SET journal_entry_id = v_je WHERE id = v_doc_id;
      END IF;
    END IF;
  END LOOP;

  PERFORM public._recon_finish_batch(
    v_batch_id, true,
    jsonb_build_object(
      'customers', v_customers,
      'suppliers', v_suppliers,
      'ar_total', v_ar_total,
      'ap_total', v_ap_total,
      'mode', v_mode
    )
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'mode', v_mode,
    'customers', v_customers,
    'suppliers', v_suppliers,
    'ar_total', v_ar_total,
    'ap_total', v_ap_total
  );
END;
$$;

--------------------------------------------------------------------------------
-- Rebuild financial running balances
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recon_rebuild_financial_running_balances(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text;
  v_batch_id uuid;
  a record;
  t record;
  v_running numeric(14, 2);
  v_before numeric(14, 2);
  v_accounts int := 0;
  v_txns int := 0;
  v_mismatches int := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('reconciliation.run')
    OR public.user_has_permission('reconciliation.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation permission' USING ERRCODE = '42501';
  END IF;

  v_mode := lower(coalesce(NULLIF(payload->>'mode', ''), 'dry_run'));
  IF v_mode = 'apply' AND NOT (
    public.user_has_permission('reconciliation.apply')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation.apply permission' USING ERRCODE = '42501';
  END IF;

  v_batch_id := public._recon_start_batch(
    v_org_id, 'financial_running_balances', v_mode, v_profile_id
  );

  FOR a IN
    SELECT * FROM public.financial_accounts
    WHERE organization_id = v_org_id AND deleted_at IS NULL
    ORDER BY name
  LOOP
    v_accounts := v_accounts + 1;
    v_running := coalesce(a.opening_balance, 0);

    FOR t IN
      SELECT *
      FROM public.financial_transactions
      WHERE account_id = a.id
        AND deleted_at IS NULL
        AND coalesce(status, 'posted') = 'posted'
        AND voided_at IS NULL
      ORDER BY created_at ASC, id ASC
      FOR UPDATE
    LOOP
      v_txns := v_txns + 1;
      v_before := v_running;
      IF t.direction = 'in' THEN
        v_running := round(v_running + t.amount, 2);
      ELSE
        v_running := round(v_running - t.amount, 2);
      END IF;

      IF t.balance_after IS DISTINCT FROM v_running
         OR t.balance_before IS DISTINCT FROM v_before THEN
        v_mismatches := v_mismatches + 1;
        PERFORM public._recon_add_result(
          v_org_id, v_batch_id, 'running_balance_mismatch',
          'financial_transaction', t.id,
          'Transaction running balance does not match reconstructed chain',
          jsonb_build_object('balance_before', t.balance_before, 'balance_after', t.balance_after),
          jsonb_build_object('balance_before', v_before, 'balance_after', v_running),
          jsonb_build_object('delta_after', v_running - coalesce(t.balance_after, 0))
        );

        IF v_mode = 'apply' THEN
          UPDATE public.financial_transactions
          SET balance_before = v_before,
              balance_after = v_running
          WHERE id = t.id;
        END IF;
      END IF;
    END LOOP;

    IF a.current_balance IS DISTINCT FROM v_running THEN
      PERFORM public._recon_add_result(
        v_org_id, v_batch_id, 'account_balance_mismatch',
        'financial_account', a.id,
        'Account current_balance differs from reconstructed running total',
        jsonb_build_object('current_balance', a.current_balance),
        jsonb_build_object('reconstructed', v_running),
        jsonb_build_object('delta', v_running - a.current_balance)
      );

      IF v_mode = 'apply' THEN
        UPDATE public.financial_accounts
        SET current_balance = v_running, updated_by = v_profile_id
        WHERE id = a.id;
      END IF;
    END IF;
  END LOOP;

  PERFORM public._recon_finish_batch(
    v_batch_id, true,
    jsonb_build_object(
      'accounts', v_accounts,
      'transactions_scanned', v_txns,
      'mismatches', v_mismatches,
      'mode', v_mode
    )
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'mode', v_mode,
    'accounts', v_accounts,
    'transactions_scanned', v_txns,
    'mismatches', v_mismatches
  );
END;
$$;

--------------------------------------------------------------------------------
-- Partial sale summary repair
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recon_repair_partial_sale_summaries(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_mode text;
  v_batch_id uuid;
  r record;
  v_count int := 0;
  v_paid_sum numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('reconciliation.run')
    OR public.user_has_permission('reconciliation.read')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation permission' USING ERRCODE = '42501';
  END IF;

  v_mode := lower(coalesce(NULLIF(payload->>'mode', ''), 'dry_run'));
  IF v_mode = 'apply' AND NOT public.user_has_permission('reconciliation.apply') THEN
    RAISE EXCEPTION 'Missing reconciliation.apply permission' USING ERRCODE = '42501';
  END IF;

  v_batch_id := public._recon_start_batch(
    v_org_id, 'partial_sale_summaries', v_mode, v_profile_id
  );

  FOR r IN
    SELECT s.*, c.total_paid AS customer_total_paid
    FROM public.sales s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.due_total > 0
      AND s.paid_total > 0
  LOOP
    SELECT coalesce(sum(sp.amount), 0) INTO v_paid_sum
    FROM public.sale_payments sp
    WHERE sp.sale_id = r.id
      AND sp.deleted_at IS NULL
      AND lower(sp.method) NOT IN ('due', 'credit', 'receivable');

    IF r.paid_total IS DISTINCT FROM v_paid_sum
       OR r.customer_total_paid < v_paid_sum THEN
      v_count := v_count + 1;
      PERFORM public._recon_add_result(
        v_org_id, v_batch_id, 'partial_sale_summary_mismatch',
        'sale', r.id,
        'Partial sale paid totals inconsistent with payments/customer summary',
        jsonb_build_object(
          'sale_paid_total', r.paid_total,
          'payments_sum', v_paid_sum,
          'customer_total_paid', r.customer_total_paid,
          'invoice_no', r.invoice_no
        ),
        jsonb_build_object(
          'sale_paid_total', v_paid_sum,
          'due_total', greatest(r.grand_total - v_paid_sum, 0)
        ),
        NULL
      );

      IF v_mode = 'apply' THEN
        UPDATE public.sales
        SET paid_total = v_paid_sum,
            due_total = greatest(grand_total - v_paid_sum, 0),
            payment_status = CASE
              WHEN greatest(grand_total - v_paid_sum, 0) = 0 THEN 'paid'
              WHEN v_paid_sum > 0 THEN 'partial'
              ELSE 'unpaid'
            END,
            updated_by = v_profile_id
        WHERE id = r.id;

        UPDATE public.customers c
        SET total_paid = greatest(
          c.total_paid,
          (
            SELECT coalesce(sum(s2.paid_total), 0)
            FROM public.sales s2
            WHERE s2.customer_id = c.id
              AND s2.deleted_at IS NULL
              AND s2.status = 'completed'
          )
        ),
        updated_by = v_profile_id
        WHERE c.id = r.customer_id;
      END IF;
    END IF;
  END LOOP;

  PERFORM public._recon_finish_batch(
    v_batch_id, true,
    jsonb_build_object('affected_sales', v_count, 'mode', v_mode)
  );

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'mode', v_mode,
    'affected_sales', v_count
  );
END;
$$;

--------------------------------------------------------------------------------
-- Unified reconciliation report
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_reconciliation_report(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('reconciliation.read')
    OR public.user_has_permission('accounts.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation.read permission' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'inventory_without_ledger_count', (
      SELECT count(*) FROM public.v_recon_inventory_without_ledger
      WHERE organization_id = v_org_id
    ),
    'inventory_without_ledger_qty', (
      SELECT coalesce(sum(quantity), 0) FROM public.v_recon_inventory_without_ledger
      WHERE organization_id = v_org_id
    ),
    'customer_due_deltas', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'customer_id', customer_id, 'name', name,
        'customer_due', customer_due, 'open_sale_due', open_sale_due, 'delta', delta
      )), '[]'::jsonb)
      FROM public.v_recon_customer_due_vs_sales
      WHERE organization_id = v_org_id AND abs(delta) > 0.009
    ),
    'supplier_due_deltas', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'supplier_id', supplier_id, 'name', name,
        'supplier_due', supplier_due, 'open_purchase_due', open_purchase_due, 'delta', delta
      )), '[]'::jsonb)
      FROM public.v_recon_supplier_due_vs_purchases
      WHERE organization_id = v_org_id AND abs(delta) > 0.009
    ),
    'financial_balance_deltas', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'account_id', account_id, 'name', name,
        'current_balance', current_balance,
        'last_txn_balance_after', last_txn_balance_after,
        'delta', delta
      )), '[]'::jsonb)
      FROM public.v_recon_financial_running_balance
      WHERE organization_id = v_org_id AND abs(coalesce(delta, 0)) > 0.009
    ),
    'unbalanced_journals', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'journal_entry_id', journal_entry_id, 'entry_no', entry_no,
        'total_debit', total_debit, 'total_credit', total_credit, 'delta', delta
      )), '[]'::jsonb)
      FROM public.v_recon_unbalanced_journals
      WHERE organization_id = v_org_id
    ),
    'negative_stock_count', (
      SELECT count(*) FROM public.inventory_balances
      WHERE organization_id = v_org_id AND deleted_at IS NULL AND quantity < 0
    ),
    'active_reservations', (
      SELECT count(*) FROM public.inventory_reservations
      WHERE organization_id = v_org_id AND status = 'active' AND deleted_at IS NULL
    ),
    'recent_batches', (
      SELECT coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'batch_type', batch_type, 'mode', mode, 'status', status,
        'summary', summary, 'created_at', created_at, 'completed_at', completed_at
      ) ORDER BY created_at DESC), '[]'::jsonb)
      FROM (
        SELECT *
        FROM public.reconciliation_batches
        WHERE organization_id = v_org_id AND deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 20
      ) b
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.recon_opening_stock_ledger(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recon_opening_stock_ledger(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.recon_opening_party_balances(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recon_opening_party_balances(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.recon_rebuild_financial_running_balances(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recon_rebuild_financial_running_balances(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.recon_repair_partial_sale_summaries(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recon_repair_partial_sale_summaries(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.get_reconciliation_report(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reconciliation_report(jsonb) TO authenticated;
