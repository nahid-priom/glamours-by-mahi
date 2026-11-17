-- Accounts & Finance 2.0 — Phase 3b due dates + Phase 4 P&L report RPCs
-- Additive only: nullable due_date; no overdue backfill from sale/purchase date.

--------------------------------------------------------------------------------
-- Nullable due dates on open documents
--------------------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE INDEX IF NOT EXISTS sales_org_due_date_idx
  ON public.sales (organization_id, due_date)
  WHERE deleted_at IS NULL AND due_total > 0;

CREATE INDEX IF NOT EXISTS purchases_org_due_date_idx
  ON public.purchases (organization_id, due_date)
  WHERE deleted_at IS NULL AND due_total > 0;

--------------------------------------------------------------------------------
-- Party due aging (invoice remaining due_total; undated when due_date IS NULL)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_party_due_aging(p_party text DEFAULT 'customer')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_party text := lower(coalesce(NULLIF(btrim(p_party), ''), 'customer'));
  v_as_of date := (timezone('Asia/Dhaka', now()))::date;
  v_total numeric(14, 2) := 0;
  v_undated numeric(14, 2) := 0;
  v_current numeric(14, 2) := 0;
  v_overdue numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.read')
    OR public.user_has_permission('accounts.manage')
    OR public.user_has_permission('customer_due.collect')
    OR public.user_has_permission('supplier_due.pay')
  ) THEN
    RAISE EXCEPTION 'Missing accounts read permission' USING ERRCODE = '42501';
  END IF;

  IF v_party NOT IN ('customer', 'supplier') THEN
    RAISE EXCEPTION 'p_party must be customer or supplier';
  END IF;

  IF v_party = 'customer' THEN
    SELECT
      coalesce(sum(s.due_total), 0),
      coalesce(sum(s.due_total) FILTER (WHERE s.due_date IS NULL), 0),
      coalesce(sum(s.due_total) FILTER (WHERE s.due_date IS NOT NULL AND s.due_date >= v_as_of), 0),
      coalesce(sum(s.due_total) FILTER (WHERE s.due_date IS NOT NULL AND s.due_date < v_as_of), 0)
    INTO v_total, v_undated, v_current, v_overdue
    FROM public.sales s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.due_total > 0;
  ELSE
    SELECT
      coalesce(sum(p.due_total), 0),
      coalesce(sum(p.due_total) FILTER (WHERE p.due_date IS NULL), 0),
      coalesce(sum(p.due_total) FILTER (WHERE p.due_date IS NOT NULL AND p.due_date >= v_as_of), 0),
      coalesce(sum(p.due_total) FILTER (WHERE p.due_date IS NOT NULL AND p.due_date < v_as_of), 0)
    INTO v_total, v_undated, v_current, v_overdue
    FROM public.purchases p
    WHERE p.organization_id = v_org_id
      AND p.deleted_at IS NULL
      AND p.status = 'completed'
      AND p.due_total > 0;
  END IF;

  RETURN jsonb_build_object(
    'party', v_party,
    'total_due', v_total,
    'undated', v_undated,
    'current', v_current,
    'overdue', v_overdue,
    'due_date_supported', true,
    'as_of', v_as_of
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_party_due_aging(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_party_due_aging(text) TO authenticated;

--------------------------------------------------------------------------------
-- Profit & Loss report (snapshot COGS from sale_items.cost_price)
-- Other income/expense from income_entries / expense_entries only (cash deposit/withdraw are FT-only).
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_profit_loss_report(
  p_from date,
  p_to date,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_sales numeric(14, 2) := 0;
  v_returns numeric(14, 2) := 0;
  v_net_sales numeric(14, 2) := 0;
  v_product_cost numeric(14, 2) := 0;
  v_other_income numeric(14, 2) := 0;
  v_expenses numeric(14, 2) := 0;
  v_gross_profit numeric(14, 2) := 0;
  v_net_profit numeric(14, 2) := 0;
  v_by_branch jsonb := '[]'::jsonb;
  v_by_product jsonb := '[]'::jsonb;
  v_by_sale jsonb := '[]'::jsonb;
  v_trend jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.read')
    OR public.user_has_permission('profit_loss.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing profit_loss.read or accounts.read' USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(sum(s.grand_total), 0)
  INTO v_sales
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT coalesce(sum(sr.total), 0)
  INTO v_returns
  FROM public.sale_returns sr
  WHERE sr.organization_id = v_org_id
    AND sr.deleted_at IS NULL
    AND sr.status IN ('approved', 'completed')
    AND sr.created_at::date BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR sr.branch_id = p_branch_id);

  SELECT coalesce(sum(round(si.qty * si.cost_price, 2)), 0)
  INTO v_product_cost
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND si.deleted_at IS NULL
    AND s.status = 'completed'
    AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT coalesce(sum(ie.amount), 0)
  INTO v_other_income
  FROM public.income_entries ie
  WHERE ie.organization_id = v_org_id
    AND ie.deleted_at IS NULL
    AND ie.status = 'posted'
    AND ie.entry_date BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR ie.branch_id = p_branch_id);

  SELECT coalesce(sum(ee.amount), 0)
  INTO v_expenses
  FROM public.expense_entries ee
  WHERE ee.organization_id = v_org_id
    AND ee.deleted_at IS NULL
    AND ee.status = 'posted'
    AND ee.entry_date BETWEEN p_from AND p_to
    AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id);

  v_net_sales := v_sales - v_returns;
  v_gross_profit := v_net_sales - v_product_cost;
  v_net_profit := v_gross_profit + v_other_income - v_expenses;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.branch_name), '[]'::jsonb)
  INTO v_by_branch
  FROM (
    SELECT
      b.id AS branch_id,
      b.name AS branch_name,
      coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.organization_id = v_org_id
          AND s.branch_id = b.id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
          AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
      ), 0) - coalesce((
        SELECT sum(sr.total)
        FROM public.sale_returns sr
        WHERE sr.organization_id = v_org_id
          AND sr.branch_id = b.id
          AND sr.deleted_at IS NULL
          AND sr.status IN ('approved', 'completed')
          AND sr.created_at::date BETWEEN p_from AND p_to
      ), 0) AS net_sales,
      coalesce((
        SELECT sum(round(si.qty * si.cost_price, 2))
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.organization_id = v_org_id
          AND s.branch_id = b.id
          AND s.deleted_at IS NULL
          AND si.deleted_at IS NULL
          AND s.status = 'completed'
          AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
      ), 0) AS product_cost,
      coalesce((
        SELECT sum(ee.amount)
        FROM public.expense_entries ee
        WHERE ee.organization_id = v_org_id
          AND ee.branch_id = b.id
          AND ee.deleted_at IS NULL
          AND ee.status = 'posted'
          AND ee.entry_date BETWEEN p_from AND p_to
      ), 0) AS expenses,
      coalesce((
        SELECT sum(ie.amount)
        FROM public.income_entries ie
        WHERE ie.organization_id = v_org_id
          AND ie.branch_id = b.id
          AND ie.deleted_at IS NULL
          AND ie.status = 'posted'
          AND ie.entry_date BETWEEN p_from AND p_to
      ), 0) AS other_income
    FROM public.branches b
    WHERE b.organization_id = v_org_id
      AND b.deleted_at IS NULL
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
  ) base
  CROSS JOIN LATERAL (
    SELECT
      base.branch_id,
      base.branch_name,
      base.net_sales,
      base.product_cost,
      base.net_sales - base.product_cost AS gross_profit,
      base.expenses,
      base.other_income,
      base.net_sales - base.product_cost + base.other_income - base.expenses AS operating_profit
  ) x
  WHERE x.net_sales <> 0 OR x.product_cost <> 0 OR x.expenses <> 0 OR x.other_income <> 0;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.gross_profit DESC), '[]'::jsonb)
  INTO v_by_product
  FROM (
    SELECT
      p.id AS product_id,
      coalesce(p.name, 'Product') AS product_name,
      sum(si.qty) AS qty,
      sum(si.line_total) AS revenue,
      sum(round(si.qty * si.cost_price, 2)) AS cost,
      sum(si.line_total) - sum(round(si.qty * si.cost_price, 2)) AS gross_profit
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    JOIN public.product_variants pv ON pv.id = si.variant_id
    JOIN public.products p ON p.id = pv.product_id
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND si.deleted_at IS NULL
      AND s.status = 'completed'
      AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name
    ORDER BY 6 DESC
    LIMIT 50
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.sale_date DESC), '[]'::jsonb)
  INTO v_by_sale
  FROM (
    SELECT
      s.id AS sale_id,
      s.invoice_no,
      coalesce(s.completed_at::date, s.created_at::date) AS sale_date,
      s.grand_total AS net_sales,
      coalesce((
        SELECT sum(round(si.qty * si.cost_price, 2))
        FROM public.sale_items si
        WHERE si.sale_id = s.id AND si.deleted_at IS NULL
      ), 0) AS product_cost,
      s.grand_total - coalesce((
        SELECT sum(round(si.qty * si.cost_price, 2))
        FROM public.sale_items si
        WHERE si.sale_id = s.id AND si.deleted_at IS NULL
      ), 0) AS gross_profit
    FROM public.sales s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND coalesce(s.completed_at::date, s.created_at::date) BETWEEN p_from AND p_to
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    ORDER BY coalesce(s.completed_at, s.created_at) DESC
    LIMIT 100
  ) x;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb)
  INTO v_trend
  FROM (
    SELECT
      d::date AS date,
      to_char(d::date, 'Mon DD') AS label,
      coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.organization_id = v_org_id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
          AND coalesce(s.completed_at::date, s.created_at::date) = d::date
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ), 0) AS income,
      coalesce((
        SELECT sum(ee.amount)
        FROM public.expense_entries ee
        WHERE ee.organization_id = v_org_id
          AND ee.deleted_at IS NULL
          AND ee.status = 'posted'
          AND ee.entry_date = d::date
          AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
      ), 0) AS expense,
      coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.organization_id = v_org_id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
          AND coalesce(s.completed_at::date, s.created_at::date) = d::date
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ), 0) - coalesce((
        SELECT sum(round(si.qty * si.cost_price, 2))
        FROM public.sale_items si
        JOIN public.sales s ON s.id = si.sale_id
        WHERE s.organization_id = v_org_id
          AND s.deleted_at IS NULL
          AND si.deleted_at IS NULL
          AND s.status = 'completed'
          AND coalesce(s.completed_at::date, s.created_at::date) = d::date
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ), 0) - coalesce((
        SELECT sum(ee.amount)
        FROM public.expense_entries ee
        WHERE ee.organization_id = v_org_id
          AND ee.deleted_at IS NULL
          AND ee.status = 'posted'
          AND ee.entry_date = d::date
          AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
      ), 0) AS profit
    FROM generate_series(least(p_from, p_to), least(p_to, p_from + 61), '1 day'::interval) AS d
  ) x;

  RETURN jsonb_build_object(
    'net_sales', v_net_sales,
    'product_cost', v_product_cost,
    'gross_profit', v_gross_profit,
    'other_income', v_other_income,
    'expenses', v_expenses,
    'net_profit', v_net_profit,
    'from', p_from,
    'to', p_to,
    'by_branch', coalesce(v_by_branch, '[]'::jsonb),
    'by_product', coalesce(v_by_product, '[]'::jsonb),
    'by_sale', coalesce(v_by_sale, '[]'::jsonb),
    'trend', coalesce(v_trend, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profit_loss_report(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report(date, date, uuid) TO authenticated;
