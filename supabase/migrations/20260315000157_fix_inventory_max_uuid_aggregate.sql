-- Fix: PostgreSQL has no max(uuid). Cast balance_id to text before MAX.
-- Broken in 00139 for get_inventory_variant_breakdown and get_inventory_low_stock
-- (PostgREST surfaces this as 404 / SQLSTATE 42883).

CREATE OR REPLACE FUNCTION public.get_inventory_variant_breakdown(
  p_branch_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort_by text DEFAULT 'quantity',
  p_sort_direction text DEFAULT 'asc',
  p_include_non_saleable boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_can_cost boolean := public._user_can_view_inventory_cost();
  v_search text := NULLIF(trim(p_search), '');
  v_status text := lower(NULLIF(trim(p_stock_status), ''));
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 500);
  v_offset integer := (v_page - 1) * v_page_size;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  RETURN (
    WITH base AS (
      SELECT v.*
      FROM public.v_inventory_valuation_balances v
      WHERE v.organization_id = v_org
        AND public.user_has_branch_access(v.branch_id)
        AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        AND (p_location_id IS NULL OR v.location_id = p_location_id)
        AND (p_include_non_saleable OR v.location_type = 'saleable')
        AND (p_category_id IS NULL OR v.category_id = p_category_id)
        AND (p_brand_id IS NULL OR v.brand_id = p_brand_id)
        AND public._inventory_search_matches(
          v_org, v_search, v.product_name, v.product_code, v.sku, v.barcode, v.variant_id
        )
    ),
    rows AS (
      SELECT
        COALESCE(MAX(b.balance_id::text), b.variant_id::text || ':' || b.branch_id::text) AS row_key,
        b.variant_id,
        b.product_id,
        MAX(b.product_name) AS product_name,
        MAX(b.variant_name) AS variant_name,
        MAX(b.sku) AS sku,
        MAX(b.barcode) AS barcode,
        b.branch_id,
        MAX(b.branch_name) AS branch_name,
        MAX(b.location_name) AS location_name,
        MAX(b.location_type) AS location_type,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.quantity ELSE 0 END) AS on_hand,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.qty_reserved ELSE 0 END) AS reserved_quantity,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END) AS available_quantity,
        SUM(CASE WHEN b.location_type = 'damaged' THEN b.quantity ELSE 0 END) AS damaged_quantity,
        SUM(CASE WHEN b.location_type = 'quarantine' THEN b.quantity ELSE 0 END) AS quarantine_quantity,
        public._inventory_in_transit_qty(v_org, b.variant_id, b.branch_id) AS in_transit_quantity,
        0::numeric AS incoming_quantity,
        MAX(b.product_reorder_level) AS reorder_level,
        public._inventory_stock_status(
          SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END),
          MAX(b.product_reorder_level)
        ) AS stock_status
      FROM base b
      GROUP BY b.variant_id, b.product_id, b.branch_id
    ),
    filtered AS (
      SELECT r.*
      FROM rows r
      WHERE v_status IS NULL
        OR r.stock_status = v_status
        OR (v_status = 'damaged' AND r.damaged_quantity > 0)
        OR (v_status = 'quarantine' AND r.quarantine_quantity > 0)
        OR (v_status = 'in_transit' AND r.in_transit_quantity > 0)
        OR (v_status = 'negative_stock' AND r.available_quantity < 0)
    ),
    counted AS (SELECT COUNT(*)::bigint AS total_count FROM filtered),
    page AS (
      SELECT *
      FROM filtered
      ORDER BY
        CASE WHEN lower(COALESCE(p_sort_direction, 'asc')) = 'asc' THEN available_quantity END ASC,
        CASE WHEN lower(COALESCE(p_sort_direction, 'asc')) <> 'asc' THEN available_quantity END DESC,
        product_name ASC
      LIMIT v_page_size OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT total_count FROM counted),
      'page', v_page,
      'page_size', v_page_size,
      'can_view_cost', v_can_cost,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'row_key', p.row_key,
          'variant_id', p.variant_id,
          'product_id', p.product_id,
          'product_name', p.product_name,
          'variant_name', p.variant_name,
          'sku', p.sku,
          'barcode', p.barcode,
          'branch_id', p.branch_id,
          'branch_name', p.branch_name,
          'location_name', p.location_name,
          'location_type', p.location_type,
          'on_hand', p.on_hand,
          'reserved_quantity', p.reserved_quantity,
          'available_quantity', p.available_quantity,
          'damaged_quantity', p.damaged_quantity,
          'quarantine_quantity', p.quarantine_quantity,
          'in_transit_quantity', p.in_transit_quantity,
          'incoming_quantity', p.incoming_quantity,
          'reorder_level', p.reorder_level,
          'stock_status', p.stock_status,
          'inventory_status', p.stock_status,
          'shortage', GREATEST(p.reorder_level - p.available_quantity, 0)
        ) ORDER BY p.available_quantity ASC, p.product_name ASC)
        FROM page p
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_variant_breakdown(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_variant_breakdown(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_inventory_low_stock(
  p_branch_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort_by text DEFAULT 'quantity',
  p_sort_direction text DEFAULT 'asc',
  p_include_non_saleable boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_can_cost boolean := public._user_can_view_inventory_cost();
  v_search text := NULLIF(trim(p_search), '');
  v_status text := lower(NULLIF(trim(p_stock_status), ''));
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 500);
  v_offset integer := (v_page - 1) * v_page_size;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  RETURN (
    WITH base AS (
      SELECT v.*
      FROM public.v_inventory_valuation_balances v
      WHERE v.organization_id = v_org
        AND public.user_has_branch_access(v.branch_id)
        AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        AND (p_location_id IS NULL OR v.location_id = p_location_id)
        AND (p_include_non_saleable OR v.location_type = 'saleable')
        AND (p_category_id IS NULL OR v.category_id = p_category_id)
        AND (p_brand_id IS NULL OR v.brand_id = p_brand_id)
        AND public._inventory_search_matches(
          v_org, v_search, v.product_name, v.product_code, v.sku, v.barcode, v.variant_id
        )
    ),
    rows AS (
      SELECT
        COALESCE(MAX(b.balance_id::text), b.variant_id::text || ':' || b.branch_id::text) AS row_key,
        b.variant_id,
        b.product_id,
        MAX(b.product_name) AS product_name,
        MAX(b.variant_name) AS variant_name,
        MAX(b.sku) AS sku,
        MAX(b.barcode) AS barcode,
        b.branch_id,
        MAX(b.branch_name) AS branch_name,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END) AS available_quantity,
        MAX(b.product_reorder_level) AS reorder_level,
        public._inventory_stock_status(
          SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END),
          MAX(b.product_reorder_level)
        ) AS stock_status
      FROM base b
      GROUP BY b.variant_id, b.product_id, b.branch_id
    ),
    low AS (
      SELECT
        r.*,
        GREATEST(r.reorder_level - r.available_quantity, 0) AS shortage
      FROM rows r
      WHERE r.reorder_level > 0
        AND r.available_quantity <= r.reorder_level
        AND (
          v_status IS NULL
          OR r.stock_status = v_status
          OR (v_status = 'low_stock' AND r.stock_status = 'low_stock')
          OR (v_status = 'out_of_stock' AND r.stock_status = 'out_of_stock')
        )
    ),
    counted AS (SELECT COUNT(*)::bigint AS total_count FROM low),
    page AS (
      SELECT * FROM low
      ORDER BY available_quantity ASC, product_name ASC
      LIMIT v_page_size OFFSET v_offset
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT total_count FROM counted),
      'page', v_page,
      'page_size', v_page_size,
      'can_view_cost', v_can_cost,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'row_key', p.row_key,
          'variant_id', p.variant_id,
          'product_id', p.product_id,
          'product_name', p.product_name,
          'variant_name', p.variant_name,
          'sku', p.sku,
          'barcode', p.barcode,
          'branch_id', p.branch_id,
          'branch_name', p.branch_name,
          'available_quantity', p.available_quantity,
          'reorder_level', p.reorder_level,
          'shortage', p.shortage,
          'stock_status', p.stock_status,
          'inventory_status', p.stock_status
        ) ORDER BY p.available_quantity ASC, p.product_name ASC)
        FROM page p
      ), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_inventory_low_stock(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_inventory_low_stock(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) TO authenticated;
