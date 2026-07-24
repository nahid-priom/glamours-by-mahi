-- Glamourous by Mahi · Inventory valuation & weighted-average costing
-- Adds balance-level WAC, strengthens _adjust_inventory, backfills existing stock,
-- and exposes server-side valuation summary RPCs (no client-side financial aggregation).

--------------------------------------------------------------------------------
-- 1. Balance-level costing columns
--------------------------------------------------------------------------------
ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS average_unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_is_fallback boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.inventory_balances.average_unit_cost IS
  'Moving weighted-average unit cost for on-hand stock at this variant+location.';
COMMENT ON COLUMN public.inventory_balances.cost_is_fallback IS
  'True when average_unit_cost was derived from catalog purchase_price rather than ledger history.';

ALTER TABLE public.stock_ledger
  ADD COLUMN IF NOT EXISTS total_cost numeric(14, 2);

COMMENT ON COLUMN public.stock_ledger.total_cost IS
  'Signed movement value (quantity_delta × unit_cost), stored for reporting.';

CREATE INDEX IF NOT EXISTS inventory_balances_org_variant_idx
  ON public.inventory_balances (organization_id, variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_balances_org_location_idx
  ON public.inventory_balances (organization_id, location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS stock_ledger_org_variant_occurred_idx
  ON public.stock_ledger (organization_id, variant_id, occurred_at DESC)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- 2. Cost visibility helper (DB-layer masking)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._user_can_view_inventory_cost()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    public.user_has_permission('inventory.valuation')
    OR public.user_has_permission('accounting.view')
    OR public.user_has_permission('products.manage_prices');
$$;

REVOKE ALL ON FUNCTION public._user_can_view_inventory_cost() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._user_can_view_inventory_cost() TO authenticated;

--------------------------------------------------------------------------------
-- 3. Backfill existing balances (idempotent)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backfill_inventory_average_costs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH ledger_cost AS (
    SELECT DISTINCT ON (sl.variant_id, sl.location_id)
      sl.variant_id,
      sl.location_id,
      sl.unit_cost
    FROM public.stock_ledger sl
    WHERE sl.deleted_at IS NULL
      AND sl.unit_cost IS NOT NULL
      AND sl.unit_cost > 0
    ORDER BY sl.variant_id, sl.location_id, sl.occurred_at DESC, sl.id DESC
  ),
  calc AS (
    SELECT
      ib.id,
      CASE
        WHEN lc.unit_cost IS NOT NULL AND lc.unit_cost > 0 THEN lc.unit_cost
        ELSE COALESCE(pv.purchase_price, p.purchase_price, 0)
      END AS new_avg,
      CASE
        WHEN lc.unit_cost IS NOT NULL AND lc.unit_cost > 0 THEN false
        ELSE true
      END AS is_fallback
    FROM public.inventory_balances ib
    JOIN public.product_variants pv ON pv.id = ib.variant_id AND pv.deleted_at IS NULL
    JOIN public.products p ON p.id = pv.product_id AND p.deleted_at IS NULL
    LEFT JOIN ledger_cost lc
      ON lc.variant_id = ib.variant_id AND lc.location_id = ib.location_id
    WHERE ib.deleted_at IS NULL
      AND ib.quantity > 0
      AND (ib.average_unit_cost = 0 OR ib.cost_is_fallback = true)
  )
  UPDATE public.inventory_balances ib
  SET average_unit_cost = calc.new_avg,
      cost_is_fallback = calc.is_fallback,
      updated_at = timezone('utc', now())
  FROM calc
  WHERE ib.id = calc.id
    AND calc.new_avg > 0;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_inventory_average_costs() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_inventory_average_costs() TO authenticated;

SELECT public.backfill_inventory_average_costs();

--------------------------------------------------------------------------------
-- 4. Weighted-average inventory engine (replaces migration 031 body)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._adjust_inventory(
  p_org_id uuid,
  p_branch_id uuid,
  p_variant_id uuid,
  p_location_id uuid,
  p_qty_delta numeric,
  p_unit_cost numeric,
  p_movement_type text,
  p_reference_type text,
  p_reference_id uuid,
  p_actor uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bal public.inventory_balances%ROWTYPE;
  v_before numeric(14, 3);
  v_after numeric(14, 3);
  v_avg_before numeric(14, 2);
  v_avg_after numeric(14, 2);
  v_ledger_unit_cost numeric(14, 2);
  v_ledger_total_cost numeric(14, 2);
  v_incoming_cost numeric(14, 2);
  v_allowed text[] := ARRAY[
    'opening', 'purchase', 'purchase_return', 'sale', 'sale_return',
    'adjustment', 'transfer_out', 'transfer_in', 'damage', 'quarantine', 'correction'
  ];
BEGIN
  IF p_org_id IS NULL OR p_variant_id IS NULL OR p_location_id IS NULL THEN
    RAISE EXCEPTION 'organization, variant and location are required';
  END IF;
  IF p_qty_delta IS NULL OR p_qty_delta = 0 THEN
    RAISE EXCEPTION 'quantity delta must be non-zero';
  END IF;
  IF p_movement_type IS NULL OR NOT (p_movement_type = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'Invalid inventory movement_type: %', p_movement_type;
  END IF;

  IF p_reference_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.stock_ledger sl
    WHERE sl.organization_id = p_org_id
      AND sl.variant_id = p_variant_id
      AND sl.location_id = p_location_id
      AND sl.reference_type = p_reference_type
      AND sl.reference_id = p_reference_id
      AND sl.movement_type = p_movement_type
      AND sl.quantity_delta = p_qty_delta
      AND sl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_bal := public._ensure_inventory_balance(p_org_id, p_variant_id, p_location_id, p_actor);
  v_before := v_bal.quantity;
  v_after := v_before + p_qty_delta;
  v_avg_before := COALESCE(v_bal.average_unit_cost, 0);
  v_incoming_cost := COALESCE(p_unit_cost, 0);

  IF v_after < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for variant % (have %, delta %)',
      p_variant_id, v_before, p_qty_delta;
  END IF;

  IF COALESCE(v_bal.qty_reserved, 0) > v_after THEN
    RAISE EXCEPTION 'Reserved quantity (%) exceeds resulting on-hand (%) for variant %',
      v_bal.qty_reserved, v_after, p_variant_id;
  END IF;

  IF p_qty_delta > 0 THEN
    IF v_before <= 0 THEN
      v_avg_after := v_incoming_cost;
    ELSE
      v_avg_after := round(
        (v_before * v_avg_before + p_qty_delta * v_incoming_cost)
        / NULLIF(v_before + p_qty_delta, 0),
        2
      );
    END IF;
    v_ledger_unit_cost := v_incoming_cost;
  ELSE
    v_ledger_unit_cost := v_avg_before;
    v_avg_after := CASE WHEN v_after = 0 THEN 0 ELSE v_avg_before END;
  END IF;

  v_ledger_total_cost := round(v_ledger_unit_cost * p_qty_delta, 2);

  UPDATE public.inventory_balances
  SET quantity = v_after,
      average_unit_cost = COALESCE(v_avg_after, 0),
      cost_is_fallback = CASE
        WHEN p_qty_delta > 0 AND v_incoming_cost = 0 THEN true
        ELSE cost_is_fallback
      END,
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = v_bal.id;

  INSERT INTO public.stock_ledger (
    organization_id, branch_id, variant_id, location_id,
    quantity_delta, quantity_before, quantity_after,
    unit_cost, total_cost,
    movement_type, reference_type, reference_id, notes, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_variant_id, p_location_id,
    p_qty_delta, v_before, v_after,
    v_ledger_unit_cost, v_ledger_total_cost,
    p_movement_type, p_reference_type, p_reference_id, p_notes, p_actor, p_actor
  );
END;
$$;

--------------------------------------------------------------------------------
-- 5. Accessible balance base (shared CTE logic as a view)
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_inventory_valuation_balances
WITH (security_invoker = true)
AS
SELECT
  ib.id AS balance_id,
  ib.organization_id,
  ib.variant_id,
  ib.location_id,
  ib.quantity,
  COALESCE(ib.qty_reserved, 0) AS qty_reserved,
  GREATEST(ib.quantity - COALESCE(ib.qty_reserved, 0), 0) AS available_quantity,
  ib.average_unit_cost,
  ib.cost_is_fallback,
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
FROM public.inventory_balances ib
JOIN public.stock_locations sl
  ON sl.id = ib.location_id AND sl.deleted_at IS NULL AND sl.is_active = true
JOIN public.branches b
  ON b.id = sl.branch_id AND b.deleted_at IS NULL AND b.is_active = true
JOIN public.product_variants pv
  ON pv.id = ib.variant_id AND pv.deleted_at IS NULL AND pv.is_active = true
JOIN public.products p
  ON p.id = pv.product_id AND p.deleted_at IS NULL
LEFT JOIN public.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
LEFT JOIN public.brands br ON br.id = p.brand_id AND br.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
  AND ib.quantity > 0
  AND p.organization_id = ib.organization_id;

--------------------------------------------------------------------------------
-- 6. Stock status resolver
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
    WHEN COALESCE(p_available, 0) <= 0 THEN 'out_of_stock'
    WHEN COALESCE(p_reorder, 0) > 0 AND p_available <= p_reorder THEN 'low_stock'
    ELSE 'in_stock'
  END;
$$;

--------------------------------------------------------------------------------
-- 7. Organization valuation summary RPC
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
      AND (p_include_non_saleable OR v.location_type = 'saleable')
      AND (p_category_id IS NULL OR v.category_id = p_category_id)
      AND (p_brand_id IS NULL OR v.brand_id = p_brand_id)
      AND (
        v_search IS NULL
        OR v.product_name ILIKE '%' || v_search || '%'
        OR v.sku ILIKE '%' || v_search || '%'
        OR COALESCE(v.barcode, '') ILIKE '%' || v_search || '%'
        OR COALESCE(v.product_code, '') ILIKE '%' || v_search || '%'
      )
  ),
  variant_agg AS (
    SELECT
      b.product_id,
      b.variant_id,
      SUM(b.quantity) AS qty,
      SUM(b.available_quantity) AS avail,
      SUM(b.quantity * b.average_unit_cost) AS purchase_cost,
      SUM(b.quantity * b.effective_selling_price) AS sell_value,
      MAX(b.product_reorder_level) AS reorder_level,
      BOOL_OR(b.cost_is_fallback) AS any_fallback
    FROM base b
    GROUP BY b.product_id, b.variant_id
  ),
  filtered AS (
    SELECT *
    FROM variant_agg va
    WHERE p_stock_status IS NULL
      OR public._inventory_stock_status(va.avail, va.reorder_level) = p_stock_status
  )
  SELECT
    COUNT(DISTINCT f.product_id)::bigint,
    COUNT(DISTINCT f.variant_id)::bigint,
    COALESCE(SUM(f.qty), 0),
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
-- 8. Branch-wise summary RPC
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
      SUM(b.quantity) AS qty,
      SUM(b.available_quantity) AS avail,
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
    COALESCE(SUM(vb.qty), 0),
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
-- 9. Paginated product stock breakdown RPC
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
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
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
        AND (
          $7 IS NULL
          OR v.product_name ILIKE '%%' || $7 || '%%'
          OR v.sku ILIKE '%%' || $7 || '%%'
          OR COALESCE(v.barcode, '') ILIKE '%%' || $7 || '%%'
          OR COALESCE(v.product_code, '') ILIKE '%%' || $7 || '%%'
        )
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
        MAX(b.sku) AS sku,
        MAX(b.barcode) AS barcode,
        MAX(b.variant_name) AS variant_name,
        SUM(b.quantity) AS total_quantity,
        SUM(b.qty_reserved) AS reserved_quantity,
        SUM(b.available_quantity) AS available_quantity,
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
        MAX(sl.occurred_at) AS last_stock_movement_at,
        public._inventory_stock_status(
          SUM(b.available_quantity), MAX(b.product_reorder_level)
        ) AS stock_status
      FROM base b
      LEFT JOIN public.stock_ledger sl
        ON sl.variant_id = b.variant_id AND sl.organization_id = $1 AND sl.deleted_at IS NULL
      GROUP BY b.product_id, b.variant_id
    ),
    product_rows AS (
      SELECT
        vr.product_id,
        MAX(vr.product_name) AS product_name,
        MAX(vr.product_code) AS product_code,
        MAX(vr.product_type) AS product_type,
        MAX(vr.category_name) AS category,
        MAX(vr.brand_name) AS brand,
        COUNT(DISTINCT vr.variant_id) AS variant_count,
        SUM(vr.total_quantity) AS total_quantity,
        SUM(vr.reserved_quantity) AS reserved_quantity,
        SUM(vr.available_quantity) AS available_quantity,
        CASE WHEN SUM(vr.total_quantity) > 0
          THEN round(SUM(vr.total_purchase_cost) / SUM(vr.total_quantity), 2)
          ELSE 0 END AS average_unit_cost,
        SUM(vr.total_purchase_cost) AS total_purchase_cost,
        CASE WHEN SUM(vr.total_quantity) > 0
          THEN round(SUM(vr.total_stock_value) / SUM(vr.total_quantity), 2)
          ELSE 0 END AS effective_selling_price,
        SUM(vr.total_stock_value) AS total_stock_value,
        SUM(vr.total_stock_value) - SUM(vr.total_purchase_cost) AS potential_profit,
        MAX(vr.reorder_level) AS reorder_level,
        public._inventory_stock_status(
          SUM(vr.available_quantity), MAX(vr.reorder_level)
        ) AS stock_status,
        MAX(vr.branch_count) AS branch_count,
        MAX(vr.last_stock_movement_at) AS last_stock_movement_at
      FROM variant_rows vr
      WHERE $8 IS NULL OR vr.stock_status = $8
      GROUP BY vr.product_id
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
          'total_quantity', p.total_quantity,
          'reserved_quantity', p.reserved_quantity,
          'available_quantity', p.available_quantity,
          'average_unit_cost', CASE WHEN $12 THEN p.average_unit_cost ELSE NULL END,
          'total_purchase_cost', CASE WHEN $12 THEN p.total_purchase_cost ELSE NULL END,
          'effective_selling_price', p.effective_selling_price,
          'total_stock_value', p.total_stock_value,
          'potential_profit', CASE WHEN $12 THEN p.potential_profit ELSE NULL END,
          'reorder_level', p.reorder_level,
          'stock_status', p.stock_status,
          'branch_count', p.branch_count,
          'last_stock_movement_at', p.last_stock_movement_at
        ) ORDER BY %I %s NULLS LAST)
        FROM page p
      ), '[]'::jsonb)
    )
    $q$,
    v_sort, v_dir, v_sort, v_dir
  )
  INTO v_result
  USING v_org, p_branch_id, p_location_id, p_include_non_saleable,
        p_category_id, p_brand_id, v_search, p_stock_status,
        v_page_size, v_offset, v_page, v_can_cost;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_stock_breakdown(
  uuid, uuid, text, uuid, uuid, text, integer, integer, text, text, boolean
) TO authenticated;

--------------------------------------------------------------------------------
-- 10. Register inventory.valuation permission seed (idempotent)
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT 'inventory.valuation', 'View inventory purchase cost and profit valuations'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = 'inventory.valuation' AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Super Admin', 'Owner', 'Admin', 'Accountant')
  AND r.deleted_at IS NULL
  AND p.key = 'inventory.valuation'
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );
