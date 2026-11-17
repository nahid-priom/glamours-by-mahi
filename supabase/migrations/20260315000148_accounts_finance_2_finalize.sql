-- Accounts & Finance 2.0 finalization
-- 1) Period cash-flow aggregate (no 200-row client truncation)
-- 2) P&L trend: daily / weekly / monthly by range (no silent 62-day cut)

--------------------------------------------------------------------------------
-- Period cash flow KPIs (external in/out; transfer volume separate)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_accounts_period_cash_flow(
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
  v_from_ts timestamptz;
  v_to_ts timestamptz;
  v_money_in numeric(14, 2) := 0;
  v_money_out numeric(14, 2) := 0;
  v_transfer_volume numeric(14, 2) := 0;
  v_txn_count integer := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('accounts.read')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing accounts.read' USING ERRCODE = '42501';
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Invalid date range';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  -- Inclusive Asia/Dhaka calendar days (aligned with FE toQueryBounds)
  v_from_ts := ((p_from::text || ' 00:01:00')::timestamp AT TIME ZONE 'Asia/Dhaka');
  v_to_ts := ((p_to::text || ' 23:59:59.999')::timestamp AT TIME ZONE 'Asia/Dhaka');

  SELECT
    coalesce(sum(ft.amount) FILTER (
      WHERE ft.direction = 'in'
        AND NOT (
          lower(coalesce(ft.transaction_type, '')) IN ('transfer', 'account_transfer')
          OR lower(coalesce(ft.source_type, '')) LIKE '%transfer%'
          OR lower(coalesce(ft.transaction_type, '')) LIKE '%transfer%'
        )
    ), 0),
    coalesce(sum(ft.amount) FILTER (
      WHERE ft.direction = 'out'
        AND NOT (
          lower(coalesce(ft.transaction_type, '')) IN ('transfer', 'account_transfer')
          OR lower(coalesce(ft.source_type, '')) LIKE '%transfer%'
          OR lower(coalesce(ft.transaction_type, '')) LIKE '%transfer%'
        )
    ), 0),
    coalesce(sum(ft.amount) FILTER (
      WHERE lower(coalesce(ft.transaction_type, '')) IN ('transfer', 'account_transfer')
         OR lower(coalesce(ft.source_type, '')) LIKE '%transfer%'
         OR lower(coalesce(ft.transaction_type, '')) LIKE '%transfer%'
    ), 0),
    count(*)::integer
  INTO v_money_in, v_money_out, v_transfer_volume, v_txn_count
  FROM public.financial_transactions ft
  WHERE ft.organization_id = v_org_id
    AND ft.deleted_at IS NULL
    AND ft.status = 'posted'
    AND ft.transaction_date >= v_from_ts
    AND ft.transaction_date <= v_to_ts
    AND (p_branch_id IS NULL OR ft.branch_id = p_branch_id);

  RETURN jsonb_build_object(
    'money_in', v_money_in,
    'money_out', v_money_out,
    'transfer_volume', v_transfer_volume,
    'net_cash_flow', v_money_in - v_money_out,
    'txn_count', v_txn_count,
    'from', p_from,
    'to', p_to,
    'branch_id', p_branch_id,
    'complete', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_accounts_period_cash_flow(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_accounts_period_cash_flow(date, date, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- P&L report: adaptive trend grain (replace prior 62-day silent cap)
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
  v_day_span integer;
  v_grain text;
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

  v_day_span := (p_to - p_from) + 1;
  IF v_day_span <= 62 THEN
    v_grain := 'day';
  ELSIF v_day_span <= 180 THEN
    v_grain := 'week';
  ELSE
    v_grain := 'month';
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

  IF v_grain = 'day' THEN
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
      FROM generate_series(p_from, p_to, '1 day'::interval) AS d
    ) x;
  ELSIF v_grain = 'week' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb)
    INTO v_trend
    FROM (
      SELECT
        date_trunc('week', d::timestamp)::date AS date,
        to_char(date_trunc('week', d::timestamp)::date, 'Mon DD') AS label,
        coalesce(sum(day_income), 0) AS income,
        coalesce(sum(day_expense), 0) AS expense,
        coalesce(sum(day_profit), 0) AS profit
      FROM (
        SELECT
          d::date AS d,
          coalesce((
            SELECT sum(s.grand_total) FROM public.sales s
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) AS day_income,
          coalesce((
            SELECT sum(ee.amount) FROM public.expense_entries ee
            WHERE ee.organization_id = v_org_id AND ee.deleted_at IS NULL AND ee.status = 'posted'
              AND ee.entry_date = d::date
              AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
          ), 0) AS day_expense,
          coalesce((
            SELECT sum(s.grand_total) FROM public.sales s
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) - coalesce((
            SELECT sum(round(si.qty * si.cost_price, 2))
            FROM public.sale_items si JOIN public.sales s ON s.id = si.sale_id
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND si.deleted_at IS NULL
              AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) - coalesce((
            SELECT sum(ee.amount) FROM public.expense_entries ee
            WHERE ee.organization_id = v_org_id AND ee.deleted_at IS NULL AND ee.status = 'posted'
              AND ee.entry_date = d::date
              AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
          ), 0) AS day_profit
        FROM generate_series(p_from, p_to, '1 day'::interval) AS d
      ) daily
      GROUP BY 1, 2
    ) x;
  ELSE
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.date), '[]'::jsonb)
    INTO v_trend
    FROM (
      SELECT
        date_trunc('month', d::timestamp)::date AS date,
        to_char(date_trunc('month', d::timestamp)::date, 'Mon YYYY') AS label,
        coalesce(sum(day_income), 0) AS income,
        coalesce(sum(day_expense), 0) AS expense,
        coalesce(sum(day_profit), 0) AS profit
      FROM (
        SELECT
          d::date AS d,
          coalesce((
            SELECT sum(s.grand_total) FROM public.sales s
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) AS day_income,
          coalesce((
            SELECT sum(ee.amount) FROM public.expense_entries ee
            WHERE ee.organization_id = v_org_id AND ee.deleted_at IS NULL AND ee.status = 'posted'
              AND ee.entry_date = d::date
              AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
          ), 0) AS day_expense,
          coalesce((
            SELECT sum(s.grand_total) FROM public.sales s
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) - coalesce((
            SELECT sum(round(si.qty * si.cost_price, 2))
            FROM public.sale_items si JOIN public.sales s ON s.id = si.sale_id
            WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL AND si.deleted_at IS NULL
              AND s.status = 'completed'
              AND coalesce(s.completed_at::date, s.created_at::date) = d::date
              AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          ), 0) - coalesce((
            SELECT sum(ee.amount) FROM public.expense_entries ee
            WHERE ee.organization_id = v_org_id AND ee.deleted_at IS NULL AND ee.status = 'posted'
              AND ee.entry_date = d::date
              AND (p_branch_id IS NULL OR ee.branch_id = p_branch_id)
          ), 0) AS day_profit
        FROM generate_series(p_from, p_to, '1 day'::interval) AS d
      ) daily
      GROUP BY 1, 2
    ) x;
  END IF;

  RETURN jsonb_build_object(
    'net_sales', v_net_sales,
    'product_cost', v_product_cost,
    'gross_profit', v_gross_profit,
    'other_income', v_other_income,
    'expenses', v_expenses,
    'net_profit', v_net_profit,
    'from', p_from,
    'to', p_to,
    'trend_grain', v_grain,
    'trend_covers_full_range', true,
    'by_branch', coalesce(v_by_branch, '[]'::jsonb),
    'by_product', coalesce(v_by_product, '[]'::jsonb),
    'by_sale', coalesce(v_by_sale, '[]'::jsonb),
    'trend', coalesce(v_trend, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_profit_loss_report(date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profit_loss_report(date, date, uuid) TO authenticated;
