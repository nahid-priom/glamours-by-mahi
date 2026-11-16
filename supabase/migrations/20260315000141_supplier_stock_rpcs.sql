-- Supplier Stock 360 — reporting RPCs

CREATE OR REPLACE FUNCTION public.get_supplier_stock_kpis(
  p_branch_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_include_non_saleable boolean DEFAULT false,
  p_receipt_from timestamptz DEFAULT NULL,
  p_receipt_to timestamptz DEFAULT NULL,
  p_source_status text DEFAULT NULL
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
  v_row jsonb;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  WITH base AS (
    SELECT
      sp.quantity,
      sp.qty_reserved,
      GREATEST(sp.quantity - sp.qty_reserved, 0) AS available,
      s.supplier_id,
      s.received_quantity,
      s.receipt_unit_cost,
      s.traceability_status,
      s.received_at,
      s.variant_id,
      s.id AS source_id,
      pv.product_id,
      p.reorder_level,
      p.category_id,
      p.brand_id,
      loc.location_type,
      loc.branch_id,
      COALESCE(ib.average_unit_cost, s.receipt_unit_cost, 0) AS wac,
      public.resolve_effective_price(v_org, loc.branch_id, pv.product_id, sp.variant_id) AS sell_price,
      COALESCE(sup.name, 'Unknown / Unattributed') AS supplier_name
    FROM public.inventory_source_positions sp
    JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
    JOIN public.product_variants pv ON pv.id = sp.variant_id AND pv.deleted_at IS NULL
    JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
    JOIN public.stock_locations loc ON loc.id = sp.location_id AND loc.deleted_at IS NULL
    LEFT JOIN public.suppliers sup ON sup.id = s.supplier_id
    LEFT JOIN public.inventory_balances ib
      ON ib.organization_id = sp.organization_id
     AND ib.variant_id = sp.variant_id
     AND ib.location_id = sp.location_id
     AND ib.deleted_at IS NULL
    WHERE sp.organization_id = v_org
      AND public.user_has_branch_access(loc.branch_id)
      AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id)
      AND (p_supplier_id IS NULL OR s.supplier_id = p_supplier_id)
      AND (p_include_non_saleable OR loc.location_type = 'saleable')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND (p_source_status IS NULL OR s.traceability_status = p_source_status)
      AND (p_receipt_from IS NULL OR s.received_at >= p_receipt_from)
      AND (p_receipt_to IS NULL OR s.received_at <= p_receipt_to)
      AND (
        v_search IS NULL
        OR COALESCE(sup.name, '') ILIKE '%' || v_search || '%'
        OR p.name ILIKE '%' || v_search || '%'
        OR pv.sku ILIKE '%' || v_search || '%'
        OR COALESCE(pv.barcode, '') ILIKE '%' || v_search || '%'
      )
  ),
  variant_agg AS (
    SELECT
      b.supplier_id,
      b.variant_id,
      SUM(b.quantity) AS qty,
      SUM(b.available) AS avail,
      MAX(b.reorder_level) AS reorder_level,
      SUM(b.quantity * b.wac) AS stock_cost,
      SUM(b.quantity * b.sell_price) AS sell_value,
      BOOL_OR(b.traceability_status = 'unknown_legacy') AS is_unknown
    FROM base b
    GROUP BY b.supplier_id, b.variant_id
  )
  SELECT jsonb_build_object(
    'suppliers_with_stock', (SELECT COUNT(DISTINCT supplier_id) FROM variant_agg WHERE qty > 0 OR supplier_id IS NULL),
    'total_received_quantity', (SELECT COALESCE(SUM(received_quantity),0) FROM (
      SELECT DISTINCT ON (source_id) source_id, received_quantity FROM base
    ) x),
    'remaining_on_hand', (SELECT COALESCE(SUM(qty),0) FROM variant_agg),
    'available_quantity', (SELECT COALESCE(SUM(avail),0) FROM variant_agg),
    'remaining_stock_cost', CASE WHEN v_can_cost THEN (SELECT COALESCE(SUM(stock_cost),0) FROM variant_agg) ELSE NULL END,
    'potential_selling_value', (SELECT COALESCE(SUM(sell_value),0) FROM variant_agg),
    'potential_gross_profit', CASE WHEN v_can_cost THEN (
      SELECT COALESCE(SUM(sell_value),0) - COALESCE(SUM(stock_cost),0) FROM variant_agg
    ) ELSE NULL END,
    'low_stock_count', (
      SELECT COUNT(*) FROM variant_agg
      WHERE public._inventory_stock_status(avail, reorder_level) = 'low_stock'
    ),
    'out_of_stock_count', (
      SELECT COUNT(*) FROM variant_agg
      WHERE public._inventory_stock_status(avail, reorder_level) = 'out_of_stock'
    ),
    'unknown_source_quantity', (
      SELECT COALESCE(SUM(qty),0) FROM variant_agg WHERE is_unknown OR supplier_id IS NULL
    ),
    'can_view_cost', v_can_cost,
    'as_of_supported', false
  ) INTO v_row;

  RETURN COALESCE(v_row, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_kpis(
  uuid, uuid, text, uuid, uuid, text, boolean, timestamptz, timestamptz, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_supplier_stock_summary(
  p_branch_id uuid DEFAULT NULL,
  p_supplier_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_include_non_saleable boolean DEFAULT false,
  p_receipt_from timestamptz DEFAULT NULL,
  p_receipt_to timestamptz DEFAULT NULL,
  p_source_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort_by text DEFAULT 'remaining',
  p_sort_direction text DEFAULT 'desc'
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
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset integer;
  v_total integer;
  v_items jsonb;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;
  v_offset := (v_page - 1) * v_size;

  WITH base AS (
    SELECT
      sp.quantity,
      GREATEST(sp.quantity - sp.qty_reserved, 0) AS available,
      s.supplier_id,
      s.received_quantity,
      s.received_at,
      s.traceability_status,
      s.id AS source_id,
      s.variant_id,
      pv.product_id,
      p.reorder_level,
      p.category_id,
      p.brand_id,
      loc.location_type,
      loc.branch_id,
      COALESCE(ib.average_unit_cost, s.receipt_unit_cost, 0) AS wac,
      public.resolve_effective_price(v_org, loc.branch_id, pv.product_id, sp.variant_id) AS sell_price,
      COALESCE(sup.name, 'Unknown / Unattributed') AS supplier_name,
      COALESCE(sup.barcode, CASE WHEN s.supplier_id IS NULL THEN 'UNKNOWN' ELSE NULL END) AS supplier_code,
      COALESCE(s.supplier_id, '00000000-0000-0000-0000-000000000000'::uuid) AS supplier_key
    FROM public.inventory_source_positions sp
    JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
    JOIN public.product_variants pv ON pv.id = sp.variant_id AND pv.deleted_at IS NULL
    JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
    JOIN public.stock_locations loc ON loc.id = sp.location_id AND loc.deleted_at IS NULL
    LEFT JOIN public.suppliers sup ON sup.id = s.supplier_id
    LEFT JOIN public.inventory_balances ib
      ON ib.organization_id = sp.organization_id
     AND ib.variant_id = sp.variant_id
     AND ib.location_id = sp.location_id
     AND ib.deleted_at IS NULL
    WHERE sp.organization_id = v_org
      AND public.user_has_branch_access(loc.branch_id)
      AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id)
      AND (p_supplier_id IS NULL OR s.supplier_id = p_supplier_id)
      AND (p_include_non_saleable OR loc.location_type = 'saleable')
      AND (p_category_id IS NULL OR p.category_id = p_category_id)
      AND (p_brand_id IS NULL OR p.brand_id = p_brand_id)
      AND (p_source_status IS NULL OR s.traceability_status = p_source_status)
      AND (p_receipt_from IS NULL OR s.received_at >= p_receipt_from)
      AND (p_receipt_to IS NULL OR s.received_at <= p_receipt_to)
      AND (
        v_search IS NULL
        OR COALESCE(sup.name, 'Unknown / Unattributed') ILIKE '%' || v_search || '%'
        OR p.name ILIKE '%' || v_search || '%'
        OR pv.sku ILIKE '%' || v_search || '%'
        OR COALESCE(pv.barcode, '') ILIKE '%' || v_search || '%'
      )
  ),
  variant_rows AS (
    SELECT
      b.supplier_key,
      b.supplier_id,
      MAX(b.supplier_name) AS supplier_name,
      MAX(b.supplier_code) AS supplier_code,
      b.product_id,
      b.variant_id,
      SUM(b.quantity) AS remaining_qty,
      SUM(b.available) AS available_qty,
      MAX(b.reorder_level) AS reorder_level,
      SUM(b.quantity * b.wac) AS stock_cost,
      SUM(b.quantity * b.sell_price) AS sell_value,
      MAX(b.received_at) AS last_received_at
    FROM base b
    GROUP BY b.supplier_key, b.supplier_id, b.product_id, b.variant_id
  ),
  filtered AS (
    SELECT * FROM variant_rows vr
    WHERE p_stock_status IS NULL
       OR public._inventory_stock_status(vr.available_qty, vr.reorder_level) = p_stock_status
  ),
  supplier_agg AS (
    SELECT
      f.supplier_key,
      f.supplier_id,
      MAX(f.supplier_name) AS supplier_name,
      MAX(f.supplier_code) AS supplier_code,
      COUNT(DISTINCT f.product_id) AS product_count,
      COUNT(DISTINCT f.variant_id) AS variant_count,
      COALESCE(SUM(f.remaining_qty), 0) AS remaining_qty,
      COALESCE(SUM(f.available_qty), 0) AS available_qty,
      COALESCE(SUM(f.stock_cost), 0) AS stock_cost,
      COALESCE(SUM(f.sell_value), 0) AS sell_value,
      COUNT(*) FILTER (
        WHERE public._inventory_stock_status(f.available_qty, f.reorder_level) = 'low_stock'
      ) AS low_stock_count,
      COUNT(*) FILTER (
        WHERE public._inventory_stock_status(f.available_qty, f.reorder_level) = 'out_of_stock'
      ) AS out_of_stock_count,
      MAX(f.last_received_at) AS last_purchase_at,
      COALESCE((
        SELECT SUM(s2.received_quantity)
        FROM public.inventory_receipt_sources s2
        WHERE s2.organization_id = v_org
          AND COALESCE(s2.supplier_id, '00000000-0000-0000-0000-000000000000'::uuid) = f.supplier_key
      ), 0) AS received_qty
    FROM filtered f
    GROUP BY f.supplier_key, f.supplier_id
  ),
  ordered AS (
    SELECT * FROM supplier_agg sa
    ORDER BY
      CASE WHEN lower(COALESCE(p_sort_direction, 'desc')) = 'asc' THEN 1 ELSE -1 END *
      CASE COALESCE(p_sort_by, 'remaining')
        WHEN 'supplier_name' THEN 0
        WHEN 'stock_cost' THEN sa.stock_cost
        WHEN 'sell_value' THEN sa.sell_value
        ELSE sa.remaining_qty
      END DESC,
      sa.supplier_name ASC
  )
  SELECT COUNT(*) INTO v_total FROM ordered;

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY ord), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      row_number() OVER () AS ord,
      o.supplier_id,
      o.supplier_key::text AS supplier_key,
      o.supplier_name,
      o.supplier_code,
      o.product_count,
      o.variant_count,
      o.received_qty,
      o.remaining_qty,
      o.available_qty,
      CASE WHEN v_can_cost THEN o.stock_cost ELSE NULL END AS stock_cost,
      o.sell_value AS selling_value,
      CASE WHEN v_can_cost THEN o.sell_value - o.stock_cost ELSE NULL END AS potential_profit,
      o.low_stock_count,
      o.out_of_stock_count,
      o.last_purchase_at
    FROM ordered o
    OFFSET v_offset LIMIT v_size
  ) x;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total, 0),
    'page', v_page,
    'page_size', v_size,
    'can_view_cost', v_can_cost,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_summary(
  uuid, uuid, text, uuid, uuid, text, boolean, timestamptz, timestamptz, text, integer, integer, text, text
) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_supplier_stock_breakdown(
  p_supplier_id uuid DEFAULT NULL,
  p_supplier_unknown boolean DEFAULT false,
  p_branch_id uuid DEFAULT NULL,
  p_include_non_saleable boolean DEFAULT false,
  p_level text DEFAULT 'products'
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
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  RETURN (
    WITH base AS (
      SELECT
        sp.quantity,
        GREATEST(sp.quantity - sp.qty_reserved, 0) AS available,
        s.supplier_id,
        s.id AS source_id,
        s.purchase_id,
        s.received_at,
        s.received_quantity,
        s.receipt_unit_cost,
        s.traceability_status,
        sp.variant_id,
        sp.location_id,
        loc.branch_id,
        loc.name AS location_name,
        b.name AS branch_name,
        pv.product_id,
        pv.sku,
        pv.barcode,
        pv.name AS variant_name,
        p.name AS product_name,
        p.base_sku AS product_code,
        c.name AS category_name,
        br.name AS brand_name,
        COALESCE(ib.average_unit_cost, s.receipt_unit_cost, 0) AS wac,
        public.resolve_effective_price(v_org, loc.branch_id, pv.product_id, sp.variant_id) AS sell_price
      FROM public.inventory_source_positions sp
      JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
      JOIN public.product_variants pv ON pv.id = sp.variant_id
      JOIN public.products p ON p.id = pv.product_id
      JOIN public.stock_locations loc ON loc.id = sp.location_id
      JOIN public.branches b ON b.id = loc.branch_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      LEFT JOIN public.brands br ON br.id = p.brand_id
      LEFT JOIN public.inventory_balances ib
        ON ib.organization_id = sp.organization_id
       AND ib.variant_id = sp.variant_id
       AND ib.location_id = sp.location_id
       AND ib.deleted_at IS NULL
      WHERE sp.organization_id = v_org
        AND public.user_has_branch_access(loc.branch_id)
        AND (p_branch_id IS NULL OR loc.branch_id = p_branch_id)
        AND (p_include_non_saleable OR loc.location_type = 'saleable')
        AND (
          (p_supplier_unknown AND s.supplier_id IS NULL)
          OR (NOT p_supplier_unknown AND p_supplier_id IS NOT NULL AND s.supplier_id = p_supplier_id)
        )
    )
    SELECT jsonb_build_object(
      'can_view_cost', v_can_cost,
      'level', COALESCE(p_level, 'products'),
      'items', COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
          SELECT
            product_id,
            MAX(product_name) AS product_name,
            MAX(product_code) AS product_code,
            MAX(category_name) AS category,
            MAX(brand_name) AS brand,
            COUNT(DISTINCT variant_id) AS variant_count,
            SUM(quantity) AS remaining_qty,
            SUM(available) AS available_qty,
            CASE WHEN v_can_cost THEN SUM(quantity * wac) ELSE NULL END AS stock_cost,
            SUM(quantity * sell_price) AS selling_value
          FROM base
          GROUP BY product_id
          ORDER BY MAX(product_name)
        ) t
      ), '[]'::jsonb),
      'variants', COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
          SELECT
            variant_id,
            product_id,
            MAX(product_name) AS product_name,
            MAX(variant_name) AS variant_name,
            MAX(sku) AS sku,
            MAX(barcode) AS barcode,
            SUM(quantity) AS remaining_qty,
            SUM(available) AS available_qty,
            CASE WHEN v_can_cost THEN SUM(quantity * wac) ELSE NULL END AS stock_cost,
            SUM(quantity * sell_price) AS selling_value
          FROM base
          GROUP BY variant_id, product_id
          ORDER BY MAX(sku)
        ) t
      ), '[]'::jsonb),
      'branches', COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
          SELECT
            branch_id,
            MAX(branch_name) AS branch_name,
            location_id,
            MAX(location_name) AS location_name,
            SUM(quantity) AS remaining_qty,
            SUM(available) AS available_qty
          FROM base
          GROUP BY branch_id, location_id
          ORDER BY MAX(branch_name)
        ) t
      ), '[]'::jsonb),
      'sources', COALESCE((
        SELECT jsonb_agg(row_to_json(t)::jsonb)
        FROM (
          SELECT
            source_id,
            purchase_id,
            variant_id,
            MAX(sku) AS sku,
            MAX(received_at) AS received_at,
            MAX(received_quantity) AS received_quantity,
            SUM(quantity) AS remaining_qty,
            MAX(traceability_status) AS traceability_status,
            CASE WHEN v_can_cost THEN MAX(receipt_unit_cost) ELSE NULL END AS receipt_unit_cost
          FROM base
          GROUP BY source_id, purchase_id, variant_id
          ORDER BY MAX(received_at) DESC
        ) t
      ), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_breakdown(uuid, boolean, uuid, boolean, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_supplier_stock_movements(
  p_supplier_id uuid DEFAULT NULL,
  p_supplier_unknown boolean DEFAULT false,
  p_branch_id uuid DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 50), 1), 100);
  v_offset integer;
  v_total integer;
  v_items jsonb;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;
  v_offset := (v_page - 1) * v_size;

  WITH rows AS (
    SELECT
      a.id,
      a.event_type,
      a.quantity_delta,
      a.occurred_at,
      a.variant_id,
      a.branch_id,
      a.location_id,
      a.receipt_source_id,
      a.stock_ledger_id,
      pv.sku,
      p.name AS product_name,
      b.name AS branch_name,
      s.purchase_id,
      s.supplier_id
    FROM public.inventory_source_allocations a
    JOIN public.inventory_receipt_sources s ON s.id = a.receipt_source_id
    JOIN public.product_variants pv ON pv.id = a.variant_id
    JOIN public.products p ON p.id = pv.product_id
    JOIN public.branches b ON b.id = a.branch_id
    WHERE a.organization_id = v_org
      AND public.user_has_branch_access(a.branch_id)
      AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
      AND (
        (p_supplier_unknown AND s.supplier_id IS NULL)
        OR (NOT p_supplier_unknown AND p_supplier_id IS NOT NULL AND s.supplier_id = p_supplier_id)
      )
  )
  SELECT COUNT(*) INTO v_total FROM rows;

  SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT * FROM rows
    ORDER BY occurred_at DESC, id DESC
    OFFSET v_offset LIMIT v_size
  ) x;

  RETURN jsonb_build_object(
    'total_count', COALESCE(v_total, 0),
    'page', v_page,
    'page_size', v_size,
    'items', COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_movements(uuid, boolean, uuid, integer, integer) TO authenticated;
