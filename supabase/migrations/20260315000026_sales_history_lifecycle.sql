-- Glamourous by Mahi · Retail ERP
-- Migration 026: Sales history reporting + atomic edit/void hardening
-- Depends on: 001–025

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('sales.update', 'Edit/correct completed sales atomically'),
  ('sales.print', 'Print sale invoices and thermal receipts'),
  ('accounts.period_override', 'Post/edit/void across closed accounting periods')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = v.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Super Admin')
  AND p.key IN ('sales.update', 'sales.print', 'accounts.period_override')
  AND r.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

-- Grant sales.print / sales.update to roles that already have sales.read / sales.correct
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old ON p_old.id = rp.permission_id AND p_old.deleted_at IS NULL
JOIN public.permissions p_new ON p_new.key = 'sales.print' AND p_new.deleted_at IS NULL
WHERE p_old.key = 'sales.read'
  AND rp.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = p_new.id AND x.deleted_at IS NULL
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT DISTINCT rp.role_id, p_new.id
FROM public.role_permissions rp
JOIN public.permissions p_old ON p_old.id = rp.permission_id AND p_old.deleted_at IS NULL
JOIN public.permissions p_new ON p_new.key = 'sales.update' AND p_new.deleted_at IS NULL
WHERE p_old.key IN ('sales.correct', 'sales.void')
  AND rp.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions x
    WHERE x.role_id = rp.role_id AND x.permission_id = p_new.id AND x.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Payment reversal columns
--------------------------------------------------------------------------------
ALTER TABLE public.sale_payments
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_note text;

CREATE INDEX IF NOT EXISTS sales_org_completed_at_idx
  ON public.sales (organization_id, completed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sales_org_status_payment_idx
  ON public.sales (organization_id, status, payment_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sales_salesperson_id_idx
  ON public.sales (salesperson_id)
  WHERE deleted_at IS NULL AND salesperson_id IS NOT NULL;

--------------------------------------------------------------------------------
-- Closed-period guard
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_sale_period_open(p_org_id uuid, p_sale_date date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.financial_periods fp
    WHERE fp.organization_id = p_org_id
      AND fp.deleted_at IS NULL
      AND fp.status IN ('closed', 'locked')
      AND p_sale_date BETWEEN fp.start_date AND fp.end_date
  ) AND NOT public.user_has_permission('accounts.period_override')
    AND NOT public.user_has_permission('settings.manage') THEN
    RAISE EXCEPTION 'Accounting period is closed for %', p_sale_date
      USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._assert_sale_period_open(uuid, date) FROM PUBLIC;

--------------------------------------------------------------------------------
-- Shared sales filter CTE helper (returns matching sale ids)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sales_history_match_ids(p_filters jsonb)
RETURNS TABLE (sale_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_from timestamptz;
  v_to timestamptz;
  v_search text := NULLIF(btrim(coalesce(p_filters->>'search', '')), '');
  v_branch uuid := NULLIF(p_filters->>'branch_id', '')::uuid;
  v_customer uuid := NULLIF(p_filters->>'customer_id', '')::uuid;
  v_cashier uuid := NULLIF(p_filters->>'cashier_id', '')::uuid;
  v_status text := NULLIF(btrim(coalesce(p_filters->>'status', '')), '');
  v_pay_status text := NULLIF(btrim(coalesce(p_filters->>'payment_status', '')), '');
  v_pay_method text := NULLIF(btrim(coalesce(p_filters->>'payment_method', '')), '');
  v_category uuid := NULLIF(p_filters->>'category_id', '')::uuid;
  v_due_only boolean := coalesce((p_filters->>'due_only')::boolean, false);
BEGIN
  IF auth.uid() IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
  IF NOT public.user_has_permission('sales.read') THEN
    RAISE EXCEPTION 'Missing permission sales.read' USING ERRCODE = '42501';
  END IF;

  IF NULLIF(p_filters->>'from_date', '') IS NOT NULL THEN
    v_from := (p_filters->>'from_date')::date::timestamptz;
  END IF;
  IF NULLIF(p_filters->>'to_date', '') IS NOT NULL THEN
    v_to := ((p_filters->>'to_date')::date + 1)::timestamptz;
  END IF;

  RETURN QUERY
  SELECT s.id
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND public.user_has_branch_access(s.branch_id)
    AND (v_branch IS NULL OR s.branch_id = v_branch)
    AND (v_customer IS NULL OR s.customer_id = v_customer)
    AND (v_cashier IS NULL OR s.salesperson_id = v_cashier)
    AND (v_status IS NULL OR s.status = v_status)
    AND (v_pay_status IS NULL OR s.payment_status = v_pay_status)
    AND (NOT v_due_only OR s.due_total > 0)
    AND (v_from IS NULL OR coalesce(s.completed_at, s.created_at) >= v_from)
    AND (v_to IS NULL OR coalesce(s.completed_at, s.created_at) < v_to)
    AND (v_search IS NULL OR s.invoice_no ILIKE '%' || v_search || '%')
    AND (
      v_pay_method IS NULL OR EXISTS (
        SELECT 1 FROM public.sale_payments sp
        WHERE sp.sale_id = s.id
          AND sp.deleted_at IS NULL
          AND sp.reversed_at IS NULL
          AND lower(sp.method) = lower(v_pay_method)
      )
    )
    AND (
      v_category IS NULL OR EXISTS (
        SELECT 1
        FROM public.sale_items si
        JOIN public.product_variants pv ON pv.id = si.variant_id
        JOIN public.products p ON p.id = pv.product_id
        WHERE si.sale_id = s.id
          AND si.deleted_at IS NULL
          AND p.category_id = v_category
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public._sales_history_match_ids(jsonb) FROM PUBLIC;

--------------------------------------------------------------------------------
-- Category summary helper
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sale_category_summary(p_sale_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object('name', x.category_name, 'qty', x.qty)
    ORDER BY x.qty DESC, x.category_name
  ), '[]'::jsonb)
  FROM (
    SELECT coalesce(c.name, 'Uncategorized') AS category_name, sum(si.qty)::numeric AS qty
    FROM public.sale_items si
    JOIN public.product_variants pv ON pv.id = si.variant_id
    JOIN public.products p ON p.id = pv.product_id
    LEFT JOIN public.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
    WHERE si.sale_id = p_sale_id AND si.deleted_at IS NULL
    GROUP BY coalesce(c.name, 'Uncategorized')
  ) x;
$$;

REVOKE ALL ON FUNCTION public._sale_category_summary(uuid) FROM PUBLIC;

--------------------------------------------------------------------------------
-- sales_history_list
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_history_list(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page int := greatest(coalesce((p_filters->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((p_filters->>'page_size')::int, 25), 1), 100);
  v_sort text := coalesce(NULLIF(p_filters->>'sort', ''), 'date_desc');
  v_offset int;
  v_total bigint;
  v_items jsonb;
BEGIN
  v_offset := (v_page - 1) * v_page_size;

  SELECT count(*) INTO v_total
  FROM public._sales_history_match_ids(p_filters);

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      s.id,
      s.invoice_no,
      coalesce(s.completed_at, s.created_at) AS sale_at,
      s.created_at,
      s.status,
      s.payment_status,
      s.subtotal,
      s.discount,
      s.grand_total,
      s.paid_total,
      s.due_total,
      s.change_amount,
      s.void_reason,
      s.voided_at,
      s.customer_id,
      s.branch_id,
      s.salesperson_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      b.name AS branch_name,
      pr.full_name AS cashier_name,
      (
        SELECT coalesce(sum(si.qty), 0)
        FROM public.sale_items si
        WHERE si.sale_id = s.id AND si.deleted_at IS NULL
      ) AS item_qty,
      public._sale_category_summary(s.id) AS category_summary,
      (
        SELECT string_agg(DISTINCT sp.method, ' + ' ORDER BY sp.method)
        FROM public.sale_payments sp
        WHERE sp.sale_id = s.id AND sp.deleted_at IS NULL AND sp.reversed_at IS NULL
      ) AS payment_methods
    FROM public.sales s
    JOIN public._sales_history_match_ids(p_filters) m ON m.sale_id = s.id
    LEFT JOIN public.customers c ON c.id = s.customer_id
    LEFT JOIN public.branches b ON b.id = s.branch_id
    LEFT JOIN public.profiles pr ON pr.id = s.salesperson_id
    ORDER BY
      CASE WHEN v_sort = 'date_asc' THEN coalesce(s.completed_at, s.created_at) END ASC NULLS LAST,
      CASE WHEN v_sort = 'date_desc' THEN coalesce(s.completed_at, s.created_at) END DESC NULLS LAST,
      CASE WHEN v_sort = 'total_asc' THEN s.grand_total END ASC NULLS LAST,
      CASE WHEN v_sort = 'total_desc' THEN s.grand_total END DESC NULLS LAST,
      CASE WHEN v_sort = 'invoice_asc' THEN s.invoice_no END ASC NULLS LAST,
      CASE WHEN v_sort = 'invoice_desc' THEN s.invoice_no END DESC NULLS LAST,
      coalesce(s.completed_at, s.created_at) DESC
    OFFSET v_offset
    LIMIT v_page_size
  ) t;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.sales_history_list(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_history_list(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- sales_history_kpis
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_history_kpis(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_sales', coalesce(sum(CASE WHEN s.status = 'completed' THEN s.grand_total ELSE 0 END), 0),
    'total_paid', coalesce(sum(CASE WHEN s.status = 'completed' THEN s.paid_total ELSE 0 END), 0),
    'total_due', coalesce(sum(CASE WHEN s.status = 'completed' THEN s.due_total ELSE 0 END), 0),
    'total_discount', coalesce(sum(CASE WHEN s.status = 'completed' THEN s.discount ELSE 0 END), 0),
    'total_invoices', count(*) FILTER (WHERE s.status = 'completed'),
    'returned_voided', count(*) FILTER (WHERE s.status IN ('voided', 'corrected')),
    'average_invoice', CASE
      WHEN count(*) FILTER (WHERE s.status = 'completed') > 0
      THEN round(
        coalesce(sum(CASE WHEN s.status = 'completed' THEN s.grand_total ELSE 0 END), 0)
        / count(*) FILTER (WHERE s.status = 'completed'),
        2
      )
      ELSE 0
    END,
    'total_items_sold', coalesce((
      SELECT sum(si.qty)
      FROM public.sale_items si
      JOIN public.sales sx ON sx.id = si.sale_id
      JOIN public._sales_history_match_ids(p_filters) m2 ON m2.sale_id = sx.id
      WHERE si.deleted_at IS NULL AND sx.status = 'completed'
    ), 0)
  )
  INTO v_result
  FROM public.sales s
  JOIN public._sales_history_match_ids(p_filters) m ON m.sale_id = s.id;

  RETURN coalesce(v_result, jsonb_build_object(
    'total_sales', 0, 'total_paid', 0, 'total_due', 0, 'total_discount', 0,
    'total_invoices', 0, 'returned_voided', 0, 'average_invoice', 0, 'total_items_sold', 0
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.sales_history_kpis(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_history_kpis(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- sales_history_export (same filters, capped rows for CSV/report)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_history_export(p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merged jsonb;
BEGIN
  v_merged := coalesce(p_filters, '{}'::jsonb)
    || jsonb_build_object('page', 1, 'page_size', 5000);
  RETURN public.sales_history_list(v_merged);
END;
$$;

REVOKE ALL ON FUNCTION public.sales_history_export(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sales_history_export(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Hardened void_sale (reason required; optional note via reason suffix already)
-- Replaces prior void_sale with period guard + payment reverse markers
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
    IF v_sale.due_total > 0 THEN
      UPDATE public.customers
      SET current_due = greatest(current_due - v_sale.due_total, 0),
          total_spent = greatest(total_spent - v_sale.grand_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      )
      SELECT
        v_org_id, v_sale.branch_id, v_sale.customer_id, 'return_credit',
        0, v_sale.due_total, c.current_due,
        'sale', v_sale.id,
        'Void sale ' || v_sale.invoice_no || ': ' || btrim(reason),
        v_profile_id, v_profile_id
      FROM public.customers c WHERE c.id = v_sale.customer_id;
    ELSE
      UPDATE public.customers
      SET total_spent = greatest(total_spent - v_sale.grand_total, 0),
          total_paid = greatest(total_paid - v_sale.paid_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;
    END IF;
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

REVOKE ALL ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;

--------------------------------------------------------------------------------
-- edit_sale: atomic correction without separate approval UI
-- payload: { sale_id, reason, note?, client_txn_key, customer_id?, discount?,
--            tax?, shipping?, items: [...], payments: [...] }
--------------------------------------------------------------------------------
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
    IF v_sale.due_total > 0 THEN
      UPDATE public.customers
      SET current_due = greatest(current_due - v_sale.due_total, 0),
          total_spent = greatest(total_spent - v_sale.grand_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;

      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id,
        notes, created_by, updated_by
      )
      SELECT
        v_org_id, v_sale.branch_id, v_sale.customer_id, 'adjustment',
        0, v_sale.due_total, c.current_due,
        'sale', v_sale.id,
        'Edit reverse ' || v_sale.invoice_no,
        v_profile_id, v_profile_id
      FROM public.customers c WHERE c.id = v_sale.customer_id;
    ELSE
      UPDATE public.customers
      SET total_spent = greatest(total_spent - v_sale.grand_total, 0),
          total_paid = greatest(total_paid - v_sale.paid_total, 0),
          updated_by = v_profile_id
      WHERE id = v_sale.customer_id;
    END IF;
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

REVOKE ALL ON FUNCTION public.edit_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_sale(jsonb) TO authenticated;
