-- Inventory Overview 360 — SSOT Reporting Alignment V2
-- Read-side only: extend valuation projections/RPCs. Do not rewrite _adjust_inventory.
--
-- Phase 1 query matrix (frozen):
-- | View           | Pre-V2 source                         | Gap                                      |
-- | KPIs           | get_inventory_valuation_summary       | balance-backed only; no location buckets |
-- | Branch Summary | get_inventory_branch_summary          | listing sum ≠ unique catalog counts |
-- | Product Stock  | get_inventory_stock_breakdown         | ledger join inflation; page-only export  |
-- | Variant Stock  | branchStock (PostgREST)               | client filters; ignore category/brand    |
-- | Low Stock      | lowStock (2000-row client filter)      | hard cap; totals wrong beyond 2000       |
--
-- Eligible pairs (no full variant×branch cross join):
--   inventory_balances UNION distinct stock_ledger (variant, location)
--   + seed_inventory_presence for create-time zero qty branch selections.

--------------------------------------------------------------------------------
-- 1. Stock status (negative + availability, no overstock — no max_stock column)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_stock_status(
  p_available numeric,
  p_reorder numeric
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN COALESCE(p_available, 0) < 0 THEN 'negative_stock'
    WHEN COALESCE(p_available, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(p_reorder, 0) > 0 AND p_available <= p_reorder THEN 'low_stock'
    ELSE 'in_stock'
  END;
$$;

--------------------------------------------------------------------------------
-- 2. Reporting view: eligible pairs LEFT JOIN balances (zero-stock visibility)
-- CREATE OR REPLACE cannot change column typmods (e.g. numeric → numeric(14,3)).
-- Drop + recreate; RPCs that depend on this view are redefined below.
--------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_inventory_valuation_balances CASCADE;

CREATE VIEW public.v_inventory_valuation_balances
WITH (security_invoker = true)
AS
WITH eligible AS (
  SELECT ib.organization_id, ib.variant_id, ib.location_id
  FROM public.inventory_balances ib
  WHERE ib.deleted_at IS NULL
  UNION
  SELECT sl.organization_id, sl.variant_id, sl.location_id
  FROM public.stock_ledger sl
  WHERE sl.deleted_at IS NULL
    AND sl.location_id IS NOT NULL
    AND sl.variant_id IS NOT NULL
)
SELECT
  ib.id AS balance_id,
  e.organization_id,
  e.variant_id,
  e.location_id,
  COALESCE(ib.quantity, 0) AS quantity,
  COALESCE(ib.qty_reserved, 0) AS qty_reserved,
  (COALESCE(ib.quantity, 0) - COALESCE(ib.qty_reserved, 0)) AS available_quantity,
  COALESCE(ib.average_unit_cost, 0) AS average_unit_cost,
  COALESCE(ib.cost_is_fallback, false) AS cost_is_fallback,
  sl.branch_id,
  sl.location_type,
  sl.name AS location_name,
  b.name AS branch_name,
  b.code AS branch_code,
  b.is_central AS is_head_office,
  pv.product_id,
  pv.sku,
  pv.barcode,
  pv.name AS variant_name,
  pv.selling_price AS variant_selling_price,
  p.name AS product_name,
  p.base_sku AS product_code,
  p.product_type,
  p.reorder_level AS product_reorder_level,
  p.category_id,
  p.brand_id,
  p.track_inventory,
  c.name AS category_name,
  br.name AS brand_name
FROM eligible e
JOIN public.stock_locations sl
  ON sl.id = e.location_id AND sl.deleted_at IS NULL AND sl.is_active = true
JOIN public.branches b
  ON b.id = sl.branch_id AND b.deleted_at IS NULL AND b.is_active = true
JOIN public.product_variants pv
  ON pv.id = e.variant_id AND pv.deleted_at IS NULL AND pv.is_active = true
JOIN public.products p
  ON p.id = pv.product_id AND p.deleted_at IS NULL
LEFT JOIN public.inventory_balances ib
  ON ib.organization_id = e.organization_id
 AND ib.variant_id = e.variant_id
 AND ib.location_id = e.location_id
 AND ib.deleted_at IS NULL
LEFT JOIN public.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
LEFT JOIN public.brands br ON br.id = p.brand_id AND br.deleted_at IS NULL
WHERE p.organization_id = e.organization_id
  AND COALESCE(p.track_inventory, true) = true;

COMMENT ON VIEW public.v_inventory_valuation_balances IS
  'Inventory Overview 360 reporting base: eligible (variant,location) from balances∪ledger; zero qty included; no full cross join.';

--------------------------------------------------------------------------------
-- 3. Search helper (POS barcode registry + normalize parity)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_search_matches(
  p_org uuid,
  p_search text,
  p_product_name text,
  p_product_code text,
  p_sku text,
  p_barcode text,
  p_variant_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT
    p_search IS NULL
    OR p_product_name ILIKE '%' || p_search || '%'
    OR COALESCE(p_product_code, '') ILIKE '%' || p_search || '%'
    OR COALESCE(p_sku, '') ILIKE '%' || p_search || '%'
    OR COALESCE(p_barcode, '') ILIKE '%' || p_search || '%'
    OR (
      public.normalize_barcode(p_search) IS NOT NULL
      AND (
        public.normalize_barcode(p_barcode) = public.normalize_barcode(p_search)
        OR public.normalize_barcode(p_sku) = public.normalize_barcode(p_search)
        OR EXISTS (
          SELECT 1
          FROM public.product_barcodes pb
          WHERE pb.organization_id = p_org
            AND pb.variant_id = p_variant_id
            AND pb.deleted_at IS NULL
            AND pb.code_normalized = public.normalize_barcode(p_search)
        )
      )
    );
$$;

--------------------------------------------------------------------------------
-- 4. In-transit outstanding qty by variant (optional branch = destination)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._inventory_in_transit_qty(
  p_org uuid,
  p_variant_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    GREATEST(
      sti.quantity_sent
        - COALESCE(sti.quantity_received, 0)
        - COALESCE(sti.quantity_damaged, 0),
      0
    )
  ), 0)::numeric(14, 3)
  FROM public.stock_transfer_items sti
  JOIN public.stock_transfers st
    ON st.id = sti.transfer_id
   AND st.organization_id = p_org
   AND st.deleted_at IS NULL
   AND st.status IN ('in_transit', 'partially_received')
  WHERE sti.organization_id = p_org
    AND sti.variant_id = p_variant_id
    AND sti.deleted_at IS NULL
    AND (p_branch_id IS NULL OR st.to_branch_id = p_branch_id);
$$;

--------------------------------------------------------------------------------
-- 5. Seed zero balance presence (create-time visibility; no ledger)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_inventory_presence(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid := public.current_organization_id();
  v_item jsonb;
  v_variant uuid;
  v_branch uuid;
  v_location uuid;
  v_seeded int := 0;
BEGIN
  IF v_actor IS NULL OR v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (
    public.user_has_permission('inventory.adjust')
    OR public.user_has_permission('products.create')
    OR public.user_has_permission('products.update')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF jsonb_typeof(payload->'items') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'items must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(payload->'items')
  LOOP
    v_variant := (v_item->>'variant_id')::uuid;
    v_branch := (v_item->>'branch_id')::uuid;
    v_location := NULLIF(v_item->>'location_id', '')::uuid;

    IF v_variant IS NULL OR v_branch IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT public.user_has_branch_access(v_branch) THEN
      CONTINUE;
    END IF;

    IF v_location IS NULL THEN
      SELECT sl.id INTO v_location
      FROM public.stock_locations sl
      WHERE sl.organization_id = v_org
        AND sl.branch_id = v_branch
        AND sl.location_type = 'saleable'
        AND sl.deleted_at IS NULL
        AND sl.is_active = true
      ORDER BY sl.is_default DESC NULLS LAST, sl.created_at
      LIMIT 1;
    END IF;

    IF v_location IS NULL THEN
      CONTINUE;
    END IF;

    PERFORM public._ensure_inventory_balance(v_org, v_variant, v_location, v_actor);
    v_seeded := v_seeded + 1;
  END LOOP;

  RETURN jsonb_build_object('seeded', v_seeded);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_inventory_presence(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_inventory_presence(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- 6. Valuation summary (shared filters + barcode search)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_inventory_valuation_summary(
  p_branch_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_include_non_saleable boolean DEFAULT false
)
RETURNS TABLE (
  total_products bigint,
  total_variants bigint,
  total_stock_quantity numeric,
  total_stock_purchase_cost numeric,
  total_stock_value numeric,
  potential_gross_profit numeric,
  low_stock_variants bigint,
  out_of_stock_variants bigint,
  last_movement_at timestamptz,
  valuation_fallback_count bigint
)
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
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      v.*,
      public.resolve_effective_price(
        v.organization_id, v.branch_id, v.product_id, v.variant_id
      ) AS effective_selling_price
    FROM public.v_inventory_valuation_balances v
    WHERE v.organization_id = v_org
      AND public.user_has_branch_access(v.branch_id)
      AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
      AND (p_location_id IS NULL OR v.location_id = p_location_id)
      AND (
        CASE
          WHEN p_include_non_saleable THEN true
          ELSE v.location_type = 'saleable'
        END
      )
      AND (p_category_id IS NULL OR v.category_id = p_category_id)
      AND (p_brand_id IS NULL OR v.brand_id = p_brand_id)
      AND public._inventory_search_matches(
        v_org, v_search, v.product_name, v.product_code, v.sku, v.barcode, v.variant_id
      )
  ),
  variant_agg AS (
    SELECT
      b.product_id,
      b.variant_id,
      SUM(CASE WHEN b.location_type = 'saleable' THEN b.quantity ELSE 0 END) AS on_hand,
      SUM(CASE WHEN b.location_type = 'saleable' THEN b.qty_reserved ELSE 0 END) AS reserved,
      SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END) AS avail,
      SUM(CASE WHEN b.location_type = 'damaged' THEN b.quantity ELSE 0 END) AS damaged_qty,
      SUM(CASE WHEN b.location_type = 'quarantine' THEN b.quantity ELSE 0 END) AS quarantine_qty,
      SUM(b.quantity) AS qty_all,
      SUM(b.quantity * b.average_unit_cost) AS purchase_cost,
      SUM(b.quantity * b.effective_selling_price) AS sell_value,
      MAX(b.product_reorder_level) AS reorder_level,
      BOOL_OR(b.cost_is_fallback AND b.quantity > 0) AS any_fallback,
      public._inventory_in_transit_qty(v_org, b.variant_id, p_branch_id) AS in_transit_qty
    FROM base b
    GROUP BY b.product_id, b.variant_id
  ),
  classified AS (
    SELECT
      va.*,
      CASE
        WHEN va.damaged_qty > 0 AND v_status = 'damaged' THEN 'damaged'
        WHEN va.quarantine_qty > 0 AND v_status = 'quarantine' THEN 'quarantine'
        WHEN va.in_transit_qty > 0 AND v_status = 'in_transit' THEN 'in_transit'
        ELSE public._inventory_stock_status(va.avail, va.reorder_level)
      END AS inventory_status
    FROM variant_agg va
  ),
  filtered AS (
    SELECT *
    FROM classified c
    WHERE v_status IS NULL
      OR v_status = 'all'
      OR c.inventory_status = v_status
      OR (v_status = 'damaged' AND c.damaged_qty > 0)
      OR (v_status = 'quarantine' AND c.quarantine_qty > 0)
      OR (v_status = 'in_transit' AND c.in_transit_qty > 0)
  )
  SELECT
    COUNT(DISTINCT f.product_id)::bigint,
    COUNT(DISTINCT f.variant_id)::bigint,
    COALESCE(SUM(f.on_hand), 0),
    CASE WHEN v_can_cost THEN COALESCE(SUM(f.purchase_cost), 0) ELSE NULL END,
    COALESCE(SUM(f.sell_value), 0),
    CASE WHEN v_can_cost THEN COALESCE(SUM(f.sell_value), 0) - COALESCE(SUM(f.purchase_cost), 0) ELSE NULL END,
    COUNT(*) FILTER (
      WHERE public._inventory_stock_status(f.avail, f.reorder_level) = 'low_stock'
    )::bigint,
    COUNT(*) FILTER (
      WHERE public._inventory_stock_status(f.avail, f.reorder_level) = 'out_of_stock'
    )::bigint,
    (
      SELECT MAX(sl.occurred_at)
      FROM public.stock_ledger sl
      WHERE sl.organization_id = v_org AND sl.deleted_at IS NULL
        AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id)
    ),
    COUNT(*) FILTER (WHERE f.any_fallback)::bigint
  FROM filtered f;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_valuation_summary(uuid, uuid, text, uuid, uuid, text, boolean) TO authenticated;

--------------------------------------------------------------------------------
-- 7. Branch summary
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_inventory_branch_summary(
  p_include_non_saleable boolean DEFAULT false
)
RETURNS TABLE (
  branch_id uuid,
  branch_name text,
  branch_code text,
  is_head_office boolean,
  total_products bigint,
  total_variants bigint,
  total_stock_quantity numeric,
  total_stock_purchase_cost numeric,
  total_stock_value numeric,
  potential_gross_profit numeric,
  low_stock_count bigint,
  out_of_stock_count bigint,
  last_movement_at timestamptz
)
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

  RETURN QUERY
  WITH base AS (
    SELECT
      v.*,
      public.resolve_effective_price(
        v.organization_id, v.branch_id, v.product_id, v.variant_id
      ) AS effective_selling_price
    FROM public.v_inventory_valuation_balances v
    WHERE v.organization_id = v_org
      AND public.user_has_branch_access(v.branch_id)
      AND (p_include_non_saleable OR v.location_type = 'saleable')
  ),
  variant_branch AS (
    SELECT
      b.branch_id,
      MAX(b.branch_name) AS branch_name,
      MAX(b.branch_code) AS branch_code,
      BOOL_OR(b.is_head_office) AS is_head_office,
      b.product_id,
      b.variant_id,
      SUM(CASE WHEN b.location_type = 'saleable' THEN b.quantity ELSE 0 END) AS on_hand,
      SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END) AS avail,
      SUM(b.quantity * b.average_unit_cost) AS purchase_cost,
      SUM(b.quantity * b.effective_selling_price) AS sell_value,
      MAX(b.product_reorder_level) AS reorder_level
    FROM base b
    GROUP BY b.branch_id, b.product_id, b.variant_id
  )
  SELECT
    vb.branch_id,
    MAX(vb.branch_name),
    MAX(vb.branch_code),
    BOOL_OR(vb.is_head_office),
    COUNT(DISTINCT vb.product_id)::bigint,
    COUNT(DISTINCT vb.variant_id)::bigint,
    COALESCE(SUM(vb.on_hand), 0),
    CASE WHEN v_can_cost THEN COALESCE(SUM(vb.purchase_cost), 0) ELSE NULL END,
    COALESCE(SUM(vb.sell_value), 0),
    CASE WHEN v_can_cost THEN COALESCE(SUM(vb.sell_value), 0) - COALESCE(SUM(vb.purchase_cost), 0) ELSE NULL END,
    COUNT(*) FILTER (
      WHERE public._inventory_stock_status(vb.avail, vb.reorder_level) = 'low_stock'
    )::bigint,
    COUNT(*) FILTER (
      WHERE public._inventory_stock_status(vb.avail, vb.reorder_level) = 'out_of_stock'
    )::bigint,
    (
      SELECT MAX(sl.occurred_at)
      FROM public.stock_ledger sl
      WHERE sl.organization_id = v_org AND sl.branch_id = vb.branch_id AND sl.deleted_at IS NULL
    )
  FROM variant_branch vb
  GROUP BY vb.branch_id
  ORDER BY BOOL_OR(vb.is_head_office) DESC, MAX(vb.branch_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_branch_summary(boolean) TO authenticated;

--------------------------------------------------------------------------------
-- 8. Product stock breakdown (fix ledger join inflation)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_inventory_stock_breakdown(
  p_branch_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_sort_by text DEFAULT 'stock_value',
  p_sort_direction text DEFAULT 'desc',
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
  v_sort text;
  v_dir text;
  v_result jsonb;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;

  v_sort := CASE COALESCE(p_sort_by, 'stock_value')
    WHEN 'product_name' THEN 'product_name'
    WHEN 'quantity' THEN 'total_quantity'
    WHEN 'purchase_cost' THEN 'total_purchase_cost'
    WHEN 'stock_value' THEN 'total_stock_value'
    WHEN 'profit' THEN 'potential_profit'
    ELSE 'total_stock_value'
  END;
  v_dir := CASE lower(COALESCE(p_sort_direction, 'desc')) WHEN 'asc' THEN 'ASC' ELSE 'DESC' END;

  EXECUTE format(
    $q$
    WITH base AS (
      SELECT
        v.*,
        public.resolve_effective_price(
          v.organization_id, v.branch_id, v.product_id, v.variant_id
        ) AS effective_selling_price
      FROM public.v_inventory_valuation_balances v
      WHERE v.organization_id = $1
        AND public.user_has_branch_access(v.branch_id)
        AND ($2 IS NULL OR v.branch_id = $2)
        AND ($3 IS NULL OR v.location_id = $3)
        AND ($4 OR v.location_type = 'saleable')
        AND ($5 IS NULL OR v.category_id = $5)
        AND ($6 IS NULL OR v.brand_id = $6)
        AND public._inventory_search_matches(
          $1, $7, v.product_name, v.product_code, v.sku, v.barcode, v.variant_id
        )
    ),
    last_move AS (
      SELECT sl.variant_id, MAX(sl.occurred_at) AS occurred_at
      FROM public.stock_ledger sl
      WHERE sl.organization_id = $1 AND sl.deleted_at IS NULL
        AND ($2 IS NULL OR sl.branch_id = $2)
      GROUP BY sl.variant_id
    ),
    variant_rows AS (
      SELECT
        b.product_id,
        b.variant_id,
        MAX(b.product_name) AS product_name,
        MAX(b.product_code) AS product_code,
        MAX(b.product_type) AS product_type,
        MAX(b.category_name) AS category_name,
        MAX(b.brand_name) AS brand_name,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.quantity ELSE 0 END) AS on_hand,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.qty_reserved ELSE 0 END) AS reserved_quantity,
        SUM(CASE WHEN b.location_type = 'saleable' THEN b.available_quantity ELSE 0 END) AS available_quantity,
        SUM(CASE WHEN b.location_type = 'damaged' THEN b.quantity ELSE 0 END) AS damaged_quantity,
        SUM(CASE WHEN b.location_type = 'quarantine' THEN b.quantity ELSE 0 END) AS quarantine_quantity,
        SUM(b.quantity) AS total_quantity,
        CASE WHEN SUM(b.quantity) > 0
          THEN round(SUM(b.quantity * b.average_unit_cost) / SUM(b.quantity), 2)
          ELSE 0 END AS average_unit_cost,
        SUM(b.quantity * b.average_unit_cost) AS total_purchase_cost,
        CASE WHEN SUM(b.quantity) > 0
          THEN round(SUM(b.quantity * b.effective_selling_price) / SUM(b.quantity), 2)
          ELSE 0 END AS effective_selling_price,
        SUM(b.quantity * b.effective_selling_price) AS total_stock_value,
        MAX(b.product_reorder_level) AS reorder_level,
        COUNT(DISTINCT b.branch_id) AS branch_count,
        MAX(lm.occurred_at) AS last_stock_movement_at,
        BOOL_OR(b.cost_is_fallback AND b.quantity > 0) AS cost_is_fallback,
        public._inventory_in_transit_qty($1, b.variant_id, $2) AS in_transit_quantity,
        0::numeric AS incoming_quantity
      FROM base b
      LEFT JOIN last_move lm ON lm.variant_id = b.variant_id
      GROUP BY b.product_id, b.variant_id
    ),
    variant_classified AS (
      SELECT
        vr.*,
        public._inventory_stock_status(vr.available_quantity, vr.reorder_level) AS stock_status
      FROM variant_rows vr
      WHERE $8 IS NULL
        OR public._inventory_stock_status(vr.available_quantity, vr.reorder_level) = $8
        OR ($8 = 'damaged' AND vr.damaged_quantity > 0)
        OR ($8 = 'quarantine' AND vr.quarantine_quantity > 0)
        OR ($8 = 'in_transit' AND vr.in_transit_quantity > 0)
        OR ($8 = 'negative_stock' AND vr.available_quantity < 0)
    ),
    product_rows AS (
      SELECT
        vc.product_id,
        MAX(vc.product_name) AS product_name,
        MAX(vc.product_code) AS product_code,
        MAX(vc.product_type) AS product_type,
        MAX(vc.category_name) AS category,
        MAX(vc.brand_name) AS brand,
        COUNT(DISTINCT vc.variant_id) AS variant_count,
        SUM(vc.on_hand) AS total_quantity,
        SUM(vc.reserved_quantity) AS reserved_quantity,
        SUM(vc.available_quantity) AS available_quantity,
        SUM(vc.damaged_quantity) AS damaged_quantity,
        SUM(vc.quarantine_quantity) AS quarantine_quantity,
        SUM(vc.in_transit_quantity) AS in_transit_quantity,
        SUM(vc.incoming_quantity) AS incoming_quantity,
        CASE WHEN SUM(vc.total_quantity) > 0
          THEN round(SUM(vc.total_purchase_cost) / NULLIF(SUM(vc.total_quantity), 0), 2)
          ELSE 0 END AS average_unit_cost,
        SUM(vc.total_purchase_cost) AS total_purchase_cost,
        CASE WHEN SUM(vc.total_quantity) > 0
          THEN round(SUM(vc.total_stock_value) / NULLIF(SUM(vc.total_quantity), 0), 2)
          ELSE 0 END AS effective_selling_price,
        SUM(vc.total_stock_value) AS total_stock_value,
        SUM(vc.total_stock_value) - SUM(vc.total_purchase_cost) AS potential_profit,
        MAX(vc.reorder_level) AS reorder_level,
        public._inventory_stock_status(
          SUM(vc.available_quantity), MAX(vc.reorder_level)
        ) AS stock_status,
        MAX(vc.branch_count) AS branch_count,
        MAX(vc.last_stock_movement_at) AS last_stock_movement_at,
        BOOL_OR(vc.cost_is_fallback) AS cost_is_fallback
      FROM variant_classified vc
      GROUP BY vc.product_id
    ),
    counted AS (
      SELECT COUNT(*)::bigint AS total_count FROM product_rows
    ),
    page AS (
      SELECT * FROM product_rows
      ORDER BY %I %s NULLS LAST
      LIMIT $9 OFFSET $10
    )
    SELECT jsonb_build_object(
      'total_count', (SELECT total_count FROM counted),
      'page', $11,
      'page_size', $9,
      'can_view_cost', $12,
      'items', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'product_id', p.product_id,
          'product_name', p.product_name,
          'product_code', p.product_code,
          'product_type', p.product_type,
          'category', p.category,
          'brand', p.brand,
          'variant_count', p.variant_count,
          'on_hand', p.total_quantity,
          'total_quantity', p.total_quantity,
          'reserved_quantity', p.reserved_quantity,
          'available_quantity', p.available_quantity,
          'damaged_quantity', p.damaged_quantity,
          'quarantine_quantity', p.quarantine_quantity,
          'in_transit_quantity', p.in_transit_quantity,
          'incoming_quantity', p.incoming_quantity,
          'average_unit_cost', CASE WHEN $12 THEN p.average_unit_cost ELSE NULL END,
          'total_purchase_cost', CASE WHEN $12 THEN p.total_purchase_cost ELSE NULL END,
          'effective_selling_price', p.effective_selling_price,
          'total_stock_value', p.total_stock_value,
          'potential_profit', CASE WHEN $12 THEN p.potential_profit ELSE NULL END,
          'reorder_level', p.reorder_level,
          'stock_status', p.stock_status,
          'inventory_status', p.stock_status,
          'branch_count', p.branch_count,
          'last_stock_movement_at', p.last_stock_movement_at,
          'cost_is_fallback', CASE WHEN $12 THEN p.cost_is_fallback ELSE NULL END
        ) ORDER BY %I %s NULLS LAST)
        FROM page p
      ), '[]'::jsonb)
    )
    $q$,
    v_sort, v_dir, v_sort, v_dir
  )
  INTO v_result
  USING v_org, p_branch_id, p_location_id, p_include_non_saleable,
        p_category_id, p_brand_id, v_search, v_status,
        v_page_size, v_offset, v_page, v_can_cost;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_stock_breakdown(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) TO authenticated;

--------------------------------------------------------------------------------
-- 9. Variant breakdown (server-side filters + pagination)
--------------------------------------------------------------------------------
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
        COALESCE(MAX(b.balance_id)::text, b.variant_id::text || ':' || b.branch_id::text) AS row_key,
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

--------------------------------------------------------------------------------
-- 10. Low stock (server-side; no 2000 cap)
--------------------------------------------------------------------------------
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
        COALESCE(MAX(b.balance_id)::text, b.variant_id::text || ':' || b.branch_id::text) AS row_key,
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

--------------------------------------------------------------------------------
-- 11. Export (authorized filtered set; cost masked)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.export_inventory_stock(
  p_branch_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL,
  p_brand_id uuid DEFAULT NULL,
  p_stock_status text DEFAULT NULL,
  p_include_non_saleable boolean DEFAULT false,
  p_scope text DEFAULT 'filtered',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scope text := lower(COALESCE(NULLIF(trim(p_scope), ''), 'filtered'));
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer;
BEGIN
  IF v_scope = 'page' THEN
    v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  ELSE
    v_page := 1;
    v_page_size := 5000;
  END IF;

  RETURN public.get_inventory_stock_breakdown(
    p_branch_id,
    p_location_id,
    p_search,
    p_category_id,
    p_brand_id,
    p_stock_status,
    v_page,
    v_page_size,
    'stock_value',
    'desc',
    p_include_non_saleable
  ) || jsonb_build_object('export_scope', v_scope);
END;
$$;

REVOKE ALL ON FUNCTION public.export_inventory_stock(
  uuid, uuid, text, uuid, uuid, text, boolean, text, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.export_inventory_stock(
  uuid, uuid, text, uuid, uuid, text, boolean, text, integer, integer
) TO authenticated;

-- Patch create_product opening loop: seed presence for qty <= 0 entries
-- via create_product_with_variants — handled in application + seed_inventory_presence.
