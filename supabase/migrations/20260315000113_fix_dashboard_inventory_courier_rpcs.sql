-- Fix runtime failures reported on dashboard / products / courier report:
-- 1) get_dashboard_overview: sales.cogs_total does not exist → derive from sale_items.cost_price
-- 2) list_products_with_inventory_summary: CTE "filtered" not visible across statements
-- 3) get_courier_report: nested aggregate in jsonb_agg ORDER BY

--------------------------------------------------------------------------------
-- list_products_with_inventory_summary
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_products_with_inventory_summary(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_search text := nullif(btrim(payload->>'search'), '');
  v_category uuid := NULLIF(payload->>'category_id', '')::uuid;
  v_status text := nullif(btrim(payload->>'status'), '');
  v_stock_status text := lower(nullif(btrim(payload->>'stock_status'), ''));
  v_page int := greatest(coalesce((payload->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((payload->>'page_size')::int, 24), 1), 100);
  v_offset int := (v_page - 1) * v_page_size;
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('products.read') THEN
    RAISE EXCEPTION 'Missing permission products.read' USING ERRCODE = '42501';
  END IF;

  IF v_branch IS NOT NULL AND NOT public.user_has_branch_access(v_branch) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  WITH stock AS (
    SELECT
      pv.product_id,
      count(DISTINCT pv.id) FILTER (WHERE pv.deleted_at IS NULL) AS variant_count,
      coalesce(sum(ib.quantity), 0) AS total_stock,
      coalesce(sum(ib.quantity * coalesce(pv.purchase_price, 0)), 0) AS stock_cost,
      coalesce(sum(ib.quantity * coalesce(pv.selling_price, 0)), 0) AS stock_value
    FROM public.product_variants pv
    LEFT JOIN public.inventory_balances ib
      ON ib.variant_id = pv.id
     AND ib.organization_id = v_org
     AND ib.deleted_at IS NULL
    LEFT JOIN public.stock_locations sl ON sl.id = ib.location_id
    WHERE pv.organization_id = v_org
      AND pv.deleted_at IS NULL
      AND (v_branch IS NULL OR sl.branch_id = v_branch OR sl.branch_id IS NULL)
    GROUP BY pv.product_id
  ),
  filtered AS (
    SELECT
      p.id,
      p.name,
      p.base_sku,
      p.status,
      p.reorder_level,
      p.is_active,
      p.category_id,
      c.name AS category_name,
      coalesce(st.variant_count, 0) AS variant_count,
      coalesce(st.total_stock, 0) AS total_stock,
      coalesce(st.stock_cost, 0) AS stock_cost,
      coalesce(st.stock_value, 0) AS stock_value,
      CASE
        WHEN coalesce(st.total_stock, 0) <= 0 THEN 'out_of_stock'
        WHEN p.reorder_level > 0 AND coalesce(st.total_stock, 0) <= p.reorder_level THEN 'low_stock'
        ELSE 'in_stock'
      END AS stock_status,
      (
        SELECT pi.storage_path
        FROM public.product_images pi
        WHERE pi.product_id = p.id AND pi.deleted_at IS NULL
        ORDER BY pi.is_cover DESC, pi.sort_order ASC
        LIMIT 1
      ) AS cover_path
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id
    LEFT JOIN stock st ON st.product_id = p.id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND (v_search IS NULL OR p.name ILIKE '%' || v_search || '%' OR p.base_sku ILIKE '%' || v_search || '%')
      AND (v_category IS NULL OR p.category_id = v_category)
      AND (v_status IS NULL OR p.status::text = v_status)
      AND (
        v_stock_status IS NULL
        OR (v_stock_status = 'out_of_stock' AND coalesce(st.total_stock, 0) <= 0)
        OR (v_stock_status = 'low_stock' AND coalesce(st.total_stock, 0) > 0
            AND p.reorder_level > 0 AND coalesce(st.total_stock, 0) <= p.reorder_level)
        OR (v_stock_status = 'in_stock' AND coalesce(st.total_stock, 0) > coalesce(p.reorder_level, 0))
      )
  )
  SELECT
    (SELECT count(*) FROM filtered),
    coalesce((
      SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name)
      FROM (
        SELECT *
        FROM filtered
        ORDER BY name
        OFFSET v_offset
        LIMIT v_page_size
      ) f
    ), '[]'::jsonb)
  INTO v_total, v_items;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_products_with_inventory_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_products_with_inventory_summary(jsonb) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- get_courier_report
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_courier_report(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_from timestamptz := coalesce((payload->>'from')::timestamptz, date_trunc('month', timezone('utc', now())));
  v_to timestamptz := coalesce((payload->>'to')::timestamptz, timezone('utc', now()));
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_company uuid := NULLIF(payload->>'courier_company_id', '')::uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('courier.read') THEN
    RAISE EXCEPTION 'Missing permission courier.read' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total_parcels', count(*),
        'booked', count(*) FILTER (WHERE cp.status IN ('booked', 'pending')),
        'in_transit', count(*) FILTER (WHERE cp.status IN ('in_transit', 'out_for_delivery', 'shipped')),
        'delivered', count(*) FILTER (WHERE cp.status = 'delivered'),
        'returned', count(*) FILTER (WHERE cp.status IN ('returned', 'returning')),
        'cancelled', count(*) FILTER (WHERE cp.status = 'cancelled'),
        'cod_collected', coalesce(sum(cp.cod_amount) FILTER (WHERE cp.status = 'delivered'), 0)
      )
      FROM public.courier_parcels cp
      WHERE cp.organization_id = v_org
        AND cp.deleted_at IS NULL
        AND cp.created_at >= v_from
        AND cp.created_at <= v_to
        AND (v_branch IS NULL OR cp.branch_id = v_branch)
        AND (v_company IS NULL OR cp.courier_company_id = v_company)
    ),
    'by_company', coalesce((
      SELECT jsonb_agg(row_obj ORDER BY (row_obj->>'parcels')::bigint DESC)
      FROM (
        SELECT jsonb_build_object(
          'courier_company_id', cc.id,
          'name', cc.name,
          'parcels', count(cp.id),
          'delivered', count(*) FILTER (WHERE cp.status = 'delivered'),
          'returned', count(*) FILTER (WHERE cp.status IN ('returned', 'returning'))
        ) AS row_obj
        FROM public.courier_companies cc
        LEFT JOIN public.courier_parcels cp
          ON cp.courier_company_id = cc.id
         AND cp.organization_id = v_org
         AND cp.deleted_at IS NULL
         AND cp.created_at >= v_from
         AND cp.created_at <= v_to
         AND (v_branch IS NULL OR cp.branch_id = v_branch)
        WHERE cc.organization_id = v_org
          AND cc.deleted_at IS NULL
          AND (v_company IS NULL OR cc.id = v_company)
        GROUP BY cc.id, cc.name
      ) company_rows
    ), '[]'::jsonb),
    'recent_syncs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'provider_id', l.provider_id,
        'action', l.action,
        'success', l.success,
        'error_message', l.error_message,
        'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM (
        SELECT l.id, l.provider_id, l.action, l.success, l.error_message, l.created_at
        FROM public.courier_sync_logs l
        WHERE l.organization_id = v_org
          AND l.created_at >= v_from
          AND l.created_at <= v_to
        ORDER BY l.created_at DESC
        LIMIT 20
      ) l
    ), '[]'::jsonb),
    'from', v_from,
    'to', v_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_courier_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_courier_report(jsonb) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- get_dashboard_overview — fix branch COGS (no sales.cogs_total column)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_overview(
  p_branch_id uuid DEFAULT NULL,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_today_start timestamptz := date_trunc('day', timezone('utc', now()));
  v_today_end timestamptz := v_today_start + interval '1 day' - interval '1 millisecond';
  v_range_from timestamptz := coalesce(p_date_from, v_today_start);
  v_range_to timestamptz := coalesce(p_date_to, v_today_end);
  v_prev_from timestamptz := v_range_from - (v_range_to - v_range_from + interval '1 millisecond');
  v_prev_to timestamptz := v_range_from - interval '1 millisecond';
  v_today_sales numeric := 0;
  v_today_collection numeric := 0;
  v_yesterday_sales numeric := 0;
  v_yesterday_collection numeric := 0;
  v_today_expenses numeric := 0;
  v_yesterday_expenses numeric := 0;
  v_customer_due numeric := 0;
  v_supplier_due numeric := 0;
  v_low_stock_count int := 0;
  v_stock_valuation numeric := NULL;
  v_stock_cost numeric := NULL;
  v_online_orders int := 0;
  v_returns_today int := 0;
  v_profit_today numeric := 0;
  v_sales_overview jsonb := '[]'::jsonb;
  v_channel jsonb := '[]'::jsonb;
  v_channel_total numeric := 0;
  v_order_statuses jsonb;
  v_top_products jsonb := '[]'::jsonb;
  v_branch_perf jsonb := '[]'::jsonb;
  v_low_stock jsonb := '[]'::jsonb;
  v_cash_flow jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_recent jsonb := '[]'::jsonb;
  v_attendance jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('dashboard.read') THEN
    RAISE EXCEPTION 'Missing permission dashboard.read' USING ERRCODE = '42501';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  SELECT
    coalesce(sum(s.grand_total), 0),
    coalesce(sum(s.paid_total), 0)
  INTO v_today_sales, v_today_collection
  FROM public.sales s
  WHERE s.organization_id = v_org
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND s.created_at >= v_range_from
    AND s.created_at <= v_range_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT
    coalesce(sum(s.grand_total), 0),
    coalesce(sum(s.paid_total), 0)
  INTO v_yesterday_sales, v_yesterday_collection
  FROM public.sales s
  WHERE s.organization_id = v_org
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND s.created_at >= v_prev_from
    AND s.created_at <= v_prev_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  IF to_regclass('public.expense_entries') IS NOT NULL THEN
    EXECUTE format(
      $q$
      SELECT coalesce(sum(e.amount), 0)
      FROM public.expense_entries e
      WHERE e.organization_id = %L::uuid
        AND e.deleted_at IS NULL
        AND e.status = 'posted'
        AND e.entry_date >= %L::date
        AND e.entry_date <= %L::date
      $q$,
      v_org,
      v_range_from::date,
      v_range_to::date
    ) INTO v_today_expenses;
    EXECUTE format(
      $q$
      SELECT coalesce(sum(e.amount), 0)
      FROM public.expense_entries e
      WHERE e.organization_id = %L::uuid
        AND e.deleted_at IS NULL
        AND e.status = 'posted'
        AND e.entry_date >= %L::date
        AND e.entry_date <= %L::date
      $q$,
      v_org,
      v_prev_from::date,
      v_prev_to::date
    ) INTO v_yesterday_expenses;
  END IF;

  SELECT coalesce(sum(c.current_due), 0) INTO v_customer_due
  FROM public.customers c
  WHERE c.organization_id = v_org AND c.deleted_at IS NULL;

  SELECT coalesce(sum(sup.current_due), 0) INTO v_supplier_due
  FROM public.suppliers sup
  WHERE sup.organization_id = v_org AND sup.deleted_at IS NULL;

  WITH variant_stock AS (
    SELECT
      pv.product_id,
      coalesce(sum(ib.quantity), 0) AS qty
    FROM public.product_variants pv
    JOIN public.inventory_balances ib
      ON ib.variant_id = pv.id
     AND ib.organization_id = v_org
     AND ib.deleted_at IS NULL
    LEFT JOIN public.stock_locations sl ON sl.id = ib.location_id
    WHERE pv.organization_id = v_org
      AND pv.deleted_at IS NULL
      AND pv.is_active = true
      AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id OR sl.branch_id IS NULL)
    GROUP BY pv.product_id
  )
  SELECT count(*)::int INTO v_low_stock_count
  FROM public.products p
  JOIN variant_stock vs ON vs.product_id = p.id
  WHERE p.organization_id = v_org
    AND p.deleted_at IS NULL
    AND p.is_active = true
    AND p.reorder_level > 0
    AND vs.qty > 0
    AND vs.qty <= p.reorder_level;

  IF to_regprocedure('public.get_inventory_valuation_summary(jsonb)') IS NOT NULL THEN
    BEGIN
      SELECT
        (v->>'total_stock_value')::numeric,
        (v->>'total_stock_purchase_cost')::numeric
      INTO v_stock_valuation, v_stock_cost
      FROM (
        SELECT public.get_inventory_valuation_summary(
          jsonb_build_object('branch_id', p_branch_id)
        ) AS v
      ) x;
    EXCEPTION WHEN OTHERS THEN
      v_stock_valuation := NULL;
      v_stock_cost := NULL;
    END;
  END IF;

  SELECT count(*)::int INTO v_online_orders
  FROM public.sales s
  WHERE s.organization_id = v_org
    AND s.deleted_at IS NULL
    AND coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
    AND s.created_at >= v_range_from
    AND s.created_at <= v_range_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT count(*)::int INTO v_returns_today
  FROM public.sale_returns sr
  JOIN public.sales s ON s.id = sr.sale_id
  WHERE sr.organization_id = v_org
    AND sr.deleted_at IS NULL
    AND sr.status = 'completed'
    AND sr.created_at >= v_range_from
    AND sr.created_at <= v_range_to
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  v_profit_today := v_today_collection - v_today_expenses;

  SELECT coalesce(jsonb_agg(day_row ORDER BY day_row->>'date'), '[]'::jsonb)
  INTO v_sales_overview
  FROM (
    SELECT jsonb_build_object(
      'date', d::date::text,
      'label', to_char(d, 'Dy'),
      'sales', coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.organization_id = v_org AND s.deleted_at IS NULL AND s.status = 'completed'
          AND s.created_at >= d AND s.created_at < d + interval '1 day'
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ), 0),
      'collection', coalesce((
        SELECT sum(s.paid_total)
        FROM public.sales s
        WHERE s.organization_id = v_org AND s.deleted_at IS NULL AND s.status = 'completed'
          AND s.created_at >= d AND s.created_at < d + interval '1 day'
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      ), 0)
    ) AS day_row
    FROM generate_series(
      (v_range_to - interval '6 days')::date,
      v_range_to::date,
      interval '1 day'
    ) AS d
  ) days;

  SELECT
    coalesce(jsonb_agg(jsonb_build_object(
      'channel', ch.channel,
      'sales', ch.sales,
      'count', ch.cnt
    ) ORDER BY ch.sales DESC), '[]'::jsonb),
    coalesce(sum(ch.sales), 0)
  INTO v_channel, v_channel_total
  FROM (
    SELECT
      coalesce(nullif(btrim(s.channel), ''), 'other') AS channel,
      sum(s.grand_total) AS sales,
      count(*) AS cnt
    FROM public.sales s
    WHERE s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.created_at >= v_range_from
      AND s.created_at <= v_range_to
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY coalesce(nullif(btrim(s.channel), ''), 'other')
  ) ch;

  SELECT jsonb_build_object(
    'pending', count(*) FILTER (WHERE coalesce(s.fulfilment_status, s.status) IN ('new', 'pending_approval', 'draft')),
    'readyToShip', count(*) FILTER (WHERE s.fulfilment_status IN ('approved', 'ready_to_ship', 'packed')),
    'courierBooked', count(*) FILTER (WHERE s.fulfilment_status IN ('courier_booked', 'booked')),
    'inTransit', count(*) FILTER (WHERE s.fulfilment_status IN ('in_transit', 'shipped', 'out_for_delivery')),
    'deliveredToday', count(*) FILTER (
      WHERE s.fulfilment_status IN ('delivered', 'confirmed')
         OR (s.status = 'completed' AND s.completed_at >= v_today_start)
    ),
    'returnedToday', count(*) FILTER (
      WHERE s.fulfilment_status IN ('returned', 'return_requested')
         OR s.status = 'returned'
    )
  ) INTO v_order_statuses
  FROM public.sales s
  WHERE s.organization_id = v_org
    AND s.deleted_at IS NULL
    AND coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id);

  SELECT coalesce(jsonb_agg(row_to_json(tp)::jsonb ORDER BY tp.revenue DESC), '[]'::jsonb)
  INTO v_top_products
  FROM (
    SELECT
      row_number() OVER (ORDER BY sum(si.line_total) DESC) AS rank,
      p.id AS "productId",
      p.name,
      sum(si.qty) AS qty,
      sum(si.line_total) AS revenue,
      coalesce((
        SELECT pi.storage_path
        FROM public.product_images pi
        WHERE pi.product_id = p.id AND pi.deleted_at IS NULL
        ORDER BY pi.is_cover DESC, pi.sort_order ASC
        LIMIT 1
      ), '') AS image
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    JOIN public.product_variants pv ON pv.id = si.variant_id
    JOIN public.products p ON p.id = pv.product_id
    WHERE si.organization_id = v_org
      AND si.deleted_at IS NULL
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.created_at >= v_range_from
      AND s.created_at <= v_range_to
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    GROUP BY p.id, p.name
    LIMIT 8
  ) tp;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'sales', coalesce(bs.sales, 0),
    'collection', coalesce(bs.collection, 0),
    'profit', coalesce(bs.collection, 0) - coalesce(bs.cogs, 0)
  ) ORDER BY coalesce(bs.sales, 0) DESC), '[]'::jsonb)
  INTO v_branch_perf
  FROM public.branches b
  LEFT JOIN LATERAL (
    SELECT
      sum(s.grand_total) AS sales,
      sum(s.paid_total) AS collection,
      coalesce((
        SELECT sum(round(si.qty * coalesce(si.cost_price, 0), 2))
        FROM public.sale_items si
        JOIN public.sales s2 ON s2.id = si.sale_id
        WHERE s2.branch_id = b.id
          AND s2.organization_id = v_org
          AND s2.deleted_at IS NULL
          AND s2.status = 'completed'
          AND s2.created_at >= v_range_from
          AND s2.created_at <= v_range_to
          AND si.deleted_at IS NULL
      ), 0) AS cogs
    FROM public.sales s
    WHERE s.branch_id = b.id
      AND s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.created_at >= v_range_from
      AND s.created_at <= v_range_to
  ) bs ON true
  WHERE b.organization_id = v_org
    AND b.deleted_at IS NULL
    AND b.is_active = true
    AND (p_branch_id IS NULL OR b.id = p_branch_id);

  SELECT coalesce(jsonb_agg(row_to_json(ls)::jsonb), '[]'::jsonb)
  INTO v_low_stock
  FROM (
    SELECT
      p.id AS "productId",
      p.name AS "productName",
      coalesce(b.name, 'All') AS "branchName",
      vs.qty,
      coalesce((
        SELECT pi.storage_path FROM public.product_images pi
        WHERE pi.product_id = p.id AND pi.deleted_at IS NULL
        ORDER BY pi.is_cover DESC LIMIT 1
      ), '') AS image
    FROM public.products p
    JOIN LATERAL (
      SELECT coalesce(sum(ib.quantity), 0) AS qty, max(sl.branch_id) AS branch_id
      FROM public.product_variants pv
      JOIN public.inventory_balances ib ON ib.variant_id = pv.id AND ib.deleted_at IS NULL
      LEFT JOIN public.stock_locations sl ON sl.id = ib.location_id
      WHERE pv.product_id = p.id AND pv.deleted_at IS NULL
        AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id)
    ) vs ON true
    LEFT JOIN public.branches b ON b.id = vs.branch_id
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND p.reorder_level > 0
      AND vs.qty > 0
      AND vs.qty <= p.reorder_level
    ORDER BY vs.qty ASC
    LIMIT 5
  ) ls;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', d->>'date',
    'label', d->>'label',
    'income', (d->>'collection')::numeric,
    'expense', 0,
    'profit', (d->>'collection')::numeric
  ) ORDER BY d->>'date'), '[]'::jsonb)
  INTO v_cash_flow
  FROM jsonb_array_elements(v_sales_overview) AS d;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', fa.id,
    'name', fa.name,
    'balance', fa.current_balance
  ) ORDER BY fa.name), '[]'::jsonb)
  INTO v_accounts
  FROM public.financial_accounts fa
  WHERE fa.organization_id = v_org
    AND fa.deleted_at IS NULL
    AND fa.is_active = true
    AND (p_branch_id IS NULL OR fa.branch_id = p_branch_id OR fa.branch_id IS NULL)
  LIMIT 8;

  SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT
      s.id,
      'Sale completed' AS action,
      coalesce(c.name, 'Walk-in') AS "userName",
      s.invoice_no || ' · ৳' || round(s.grand_total)::text AS details,
      s.created_at
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id
    WHERE s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND s.status = 'completed'
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
    ORDER BY s.created_at DESC
    LIMIT 8
  ) r;

  v_attendance := jsonb_build_object(
    'present', 0,
    'late', 0,
    'absent', 0,
    'leave', 0,
    'employees', '[]'::jsonb
  );

  IF to_regprocedure('public.get_today_attendance_summary(uuid)') IS NOT NULL THEN
    BEGIN
      v_attendance := public.get_today_attendance_summary(p_branch_id);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'kpis', jsonb_build_object(
      'todaySales', v_today_sales,
      'todayCollection', v_today_collection,
      'todayExpenses', v_today_expenses,
      'netCashFlow', v_today_collection - v_today_expenses,
      'customerDue', v_customer_due,
      'supplierDue', v_supplier_due,
      'lowStockCount', v_low_stock_count,
      'stockValuation', v_stock_valuation,
      'stockCost', v_stock_cost,
      'onlineOrders', v_online_orders,
      'returnsToday', v_returns_today,
      'profitToday', v_profit_today,
      'trends', jsonb_build_object(
        'sales', CASE WHEN v_yesterday_sales = 0 THEN CASE WHEN v_today_sales > 0 THEN 100 ELSE 0 END
          ELSE round(((v_today_sales - v_yesterday_sales) / v_yesterday_sales) * 1000) / 10 END,
        'collection', CASE WHEN v_yesterday_collection = 0 THEN CASE WHEN v_today_collection > 0 THEN 100 ELSE 0 END
          ELSE round(((v_today_collection - v_yesterday_collection) / v_yesterday_collection) * 1000) / 10 END,
        'expenses', CASE WHEN v_yesterday_expenses = 0 THEN CASE WHEN v_today_expenses > 0 THEN 100 ELSE 0 END
          ELSE round(((v_today_expenses - v_yesterday_expenses) / v_yesterday_expenses) * 1000) / 10 END,
        'netCashFlow', CASE
          WHEN (v_yesterday_collection - v_yesterday_expenses) = 0 THEN
            CASE WHEN (v_today_collection - v_today_expenses) > 0 THEN 100 ELSE 0 END
          ELSE round((
            ((v_today_collection - v_today_expenses) - (v_yesterday_collection - v_yesterday_expenses))
            / nullif(v_yesterday_collection - v_yesterday_expenses, 0)
          ) * 1000) / 10 END
      )
    ),
    'salesOverview', v_sales_overview,
    'channelPerformance', v_channel,
    'channelTotal', v_channel_total,
    'orderStatuses', v_order_statuses,
    'topProducts', v_top_products,
    'branchPerformance', v_branch_perf,
    'lowStockProducts', v_low_stock,
    'cashFlowTrend', v_cash_flow,
    'attendanceToday', v_attendance,
    'recentActivity', v_recent,
    'accounts', v_accounts,
    'refreshedAt', timezone('utc', now())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_overview(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_overview(uuid, timestamptz, timestamptz) TO authenticated, service_role;
