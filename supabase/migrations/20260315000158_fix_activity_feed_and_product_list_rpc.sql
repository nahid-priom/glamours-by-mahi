-- Fix two PostgREST-visible RPC failures of the same class as low-stock max(uuid):
-- 1) list_activity_feed: CREATE TEMP TABLE is illegal in STABLE functions → VOLATILE
-- 2) list_products_with_inventory_summary: CTE "filtered" referenced across statements
--    (relation "filtered" does not exist) → single-statement RETURN

--------------------------------------------------------------------------------
-- 1. Activity feed
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_activity_feed(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_limit int := LEAST(GREATEST(coalesce((payload->>'limit')::int, 40), 1), 100);
  v_offset int := GREATEST(coalesce((payload->>'offset')::int, 0), 0);
  v_from timestamptz := NULLIF(payload->>'from', '')::timestamptz;
  v_to timestamptz := NULLIF(payload->>'to', '')::timestamptz;
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_actor uuid := NULLIF(payload->>'actor_id', '')::uuid;
  v_module text := lower(nullif(btrim(payload->>'module'), ''));
  v_search text := nullif(btrim(payload->>'search'), '');
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('audit.read') THEN
    RAISE EXCEPTION 'Missing permission audit.read' USING ERRCODE = '42501';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_activity_feed_scoped (
    id uuid,
    created_at timestamptz,
    branch_id uuid,
    actor_id uuid,
    action text,
    entity_type text,
    entity_id uuid,
    reason text,
    before_data jsonb,
    after_data jsonb,
    request_meta jsonb,
    actor_name text,
    branch_name text,
    module text
  ) ON COMMIT DROP;

  DELETE FROM tmp_activity_feed_scoped;

  INSERT INTO tmp_activity_feed_scoped (
    id, created_at, branch_id, actor_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_meta, actor_name, branch_name, module
  )
  SELECT
    a.id,
    a.created_at,
    a.branch_id,
    a.actor_id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.reason,
    a.before_data,
    a.after_data,
    a.request_meta,
    p.full_name AS actor_name,
    b.name AS branch_name,
    CASE
      WHEN a.action LIKE 'sale.%'
        OR a.action LIKE 'online_order.%'
        OR a.entity_type IN ('sale', 'sale_return', 'exchange') THEN 'sales'
      WHEN a.action LIKE 'product.%' OR a.entity_type = 'product' THEN 'products'
      WHEN a.action LIKE 'inventory.%'
        OR a.action LIKE 'stock.%'
        OR a.entity_type IN ('stock_adjustment', 'stock_transfer', 'inventory') THEN 'inventory'
      WHEN a.action LIKE 'purchase.%' OR a.entity_type LIKE 'purchase%' THEN 'purchases'
      WHEN a.action LIKE 'customer.%' OR a.entity_type = 'customer' THEN 'customers'
      WHEN a.action LIKE 'commission.%'
        OR a.entity_type LIKE 'salesman_commission%' THEN 'commissions'
      WHEN a.action LIKE 'courier.%' OR a.entity_type LIKE 'courier%' THEN 'courier'
      WHEN a.action LIKE 'hr.%'
        OR a.action LIKE 'payroll.%'
        OR a.entity_type LIKE 'employee%'
        OR a.entity_type LIKE 'payroll%' THEN 'hr'
      WHEN a.action LIKE 'account.%'
        OR a.action LIKE 'journal.%'
        OR a.action LIKE 'expense.%'
        OR a.action LIKE 'income.%'
        OR a.entity_type LIKE 'financial%'
        OR a.entity_type LIKE 'journal%' THEN 'accounts'
      ELSE 'other'
    END AS module
  FROM public.audit_logs a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  LEFT JOIN public.branches b ON b.id = a.branch_id
  WHERE a.organization_id = v_org
    AND (v_from IS NULL OR a.created_at >= v_from)
    AND (v_to IS NULL OR a.created_at <= v_to)
    AND (v_branch IS NULL OR a.branch_id = v_branch)
    AND (v_actor IS NULL OR a.actor_id = v_actor)
    AND (
      v_search IS NULL
      OR a.action ILIKE '%' || v_search || '%'
      OR a.entity_type ILIKE '%' || v_search || '%'
      OR coalesce(a.reason, '') ILIKE '%' || v_search || '%'
      OR coalesce(p.full_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(a.after_data->>'invoice_no', '') ILIKE '%' || v_search || '%'
    );

  SELECT count(*) INTO v_total
  FROM tmp_activity_feed_scoped s
  WHERE v_module IS NULL OR v_module = 'all' OR s.module = v_module;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.branch_id,
      s.branch_name,
      s.actor_id,
      s.actor_name,
      s.action,
      s.entity_type,
      s.entity_id,
      s.reason,
      s.module,
      s.before_data,
      s.after_data,
      s.request_meta
    FROM tmp_activity_feed_scoped s
    WHERE v_module IS NULL OR v_module = 'all' OR s.module = v_module
    ORDER BY s.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_activity_feed(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_activity_feed(jsonb) TO authenticated;

COMMENT ON FUNCTION public.list_activity_feed(jsonb) IS
  'Paginated org activity feed from audit_logs; requires audit.read. VOLATILE for temp table.';

--------------------------------------------------------------------------------
-- 2. Product inventory summary list
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
  v_category_raw text := nullif(btrim(payload->>'category_id'), '');
  v_uncategorized boolean := v_category_raw = '__uncategorized__';
  v_category uuid := CASE
    WHEN v_category_raw IS NULL OR v_uncategorized THEN NULL
    ELSE v_category_raw::uuid
  END;
  v_brand uuid := NULLIF(payload->>'brand_id', '')::uuid;
  v_status text := nullif(btrim(payload->>'status'), '');
  v_stock_status text := lower(nullif(btrim(payload->>'stock_status'), ''));
  v_page int := greatest(coalesce((payload->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((payload->>'page_size')::int, 24), 1), 100);
  v_offset int := (v_page - 1) * v_page_size;
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

  RETURN (
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
        p.base_barcode,
        p.status,
        p.reorder_level,
        p.is_active,
        p.category_id,
        p.brand_id,
        p.product_type,
        p.unit,
        p.purchase_price,
        p.selling_price,
        p.created_at,
        c.name AS category_name,
        b.name AS brand_name,
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
      LEFT JOIN public.brands b ON b.id = p.brand_id
      LEFT JOIN stock st ON st.product_id = p.id
      WHERE p.organization_id = v_org
        AND p.deleted_at IS NULL
        AND (
          v_search IS NULL
          OR p.name ILIKE '%' || v_search || '%'
          OR p.base_sku ILIKE '%' || v_search || '%'
          OR p.base_barcode ILIKE '%' || v_search || '%'
        )
        AND (
          (v_uncategorized AND p.category_id IS NULL)
          OR (NOT v_uncategorized AND (v_category IS NULL OR p.category_id = v_category))
        )
        AND (v_brand IS NULL OR p.brand_id = v_brand)
        AND (v_status IS NULL OR p.status::text = v_status)
        AND (
          v_stock_status IS NULL
          OR (v_stock_status = 'out_of_stock' AND coalesce(st.total_stock, 0) <= 0)
          OR (v_stock_status = 'low_stock' AND coalesce(st.total_stock, 0) > 0
              AND p.reorder_level > 0 AND coalesce(st.total_stock, 0) <= p.reorder_level)
          OR (v_stock_status = 'in_stock' AND coalesce(st.total_stock, 0) > coalesce(p.reorder_level, 0))
          OR (
            v_stock_status = 'expiring_soon'
            AND EXISTS (
              SELECT 1 FROM public.expiry_alerts ea
              WHERE ea.product_id = p.id
                AND ea.organization_id = v_org
                AND ea.is_read = false
            )
          )
        )
    )
    SELECT jsonb_build_object(
      'items', coalesce((
        SELECT jsonb_agg(to_jsonb(f) ORDER BY f.name)
        FROM (
          SELECT * FROM filtered
          ORDER BY name
          OFFSET v_offset
          LIMIT v_page_size
        ) f
      ), '[]'::jsonb),
      'total', (SELECT count(*)::bigint FROM filtered),
      'page', v_page,
      'page_size', v_page_size
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_products_with_inventory_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_products_with_inventory_summary(jsonb) TO authenticated, service_role;
