-- Fix get_supplier_stock_summary / get_supplier_stock_movements:
-- PL/pgSQL CTEs only apply to the immediately following statement, so
-- `WITH ordered AS (...) SELECT ... INTO ... FROM ordered;` followed by a
-- second `SELECT ... FROM ordered` raised: relation "ordered" does not exist.
-- Also re-run provenance backfill so Supplier Stock has attributed rows.

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
  v_sort text := COALESCE(p_sort_by, 'remaining');
  v_dir text := lower(COALESCE(p_sort_direction, 'desc'));
  v_result jsonb;
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
    SELECT
      sa.*,
      ROW_NUMBER() OVER (
        ORDER BY
          CASE WHEN v_sort = 'supplier_name' AND v_dir = 'asc' THEN sa.supplier_name END ASC NULLS LAST,
          CASE WHEN v_sort = 'supplier_name' AND v_dir <> 'asc' THEN sa.supplier_name END DESC NULLS LAST,
          CASE WHEN v_sort = 'stock_cost' AND v_dir = 'asc' THEN sa.stock_cost END ASC NULLS LAST,
          CASE WHEN v_sort = 'stock_cost' AND v_dir <> 'asc' THEN sa.stock_cost END DESC NULLS LAST,
          CASE WHEN v_sort = 'sell_value' AND v_dir = 'asc' THEN sa.sell_value END ASC NULLS LAST,
          CASE WHEN v_sort = 'sell_value' AND v_dir <> 'asc' THEN sa.sell_value END DESC NULLS LAST,
          CASE
            WHEN v_sort NOT IN ('supplier_name', 'stock_cost', 'sell_value') AND v_dir = 'asc'
            THEN sa.remaining_qty
          END ASC NULLS LAST,
          CASE
            WHEN v_sort NOT IN ('supplier_name', 'stock_cost', 'sell_value') AND v_dir <> 'asc'
            THEN sa.remaining_qty
          END DESC NULLS LAST,
          sa.supplier_name ASC
      ) AS rn
    FROM supplier_agg sa
  ),
  page_rows AS (
    SELECT
      o.rn AS ord,
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
    WHERE o.rn > v_offset
      AND o.rn <= v_offset + v_size
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT COUNT(*)::integer FROM ordered),
    'page', v_page,
    'page_size', v_size,
    'can_view_cost', v_can_cost,
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.ord) FROM page_rows p),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_count', 0,
    'page', v_page,
    'page_size', v_size,
    'can_view_cost', v_can_cost,
    'items', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_summary(
  uuid, uuid, text, uuid, uuid, text, boolean, timestamptz, timestamptz, text, integer, integer, text, text
) TO authenticated;

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
  v_result jsonb;
BEGIN
  IF NOT public.user_has_permission('inventory.read') THEN
    RAISE EXCEPTION 'Permission denied: inventory.read required';
  END IF;
  v_offset := (v_page - 1) * v_size;

  WITH movement_rows AS (
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
      s.supplier_id,
      ROW_NUMBER() OVER (ORDER BY a.occurred_at DESC, a.id DESC) AS rn
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
  ),
  page_rows AS (
    SELECT
      m.id,
      m.event_type,
      m.quantity_delta,
      m.occurred_at,
      m.variant_id,
      m.branch_id,
      m.location_id,
      m.receipt_source_id,
      m.stock_ledger_id,
      m.sku,
      m.product_name,
      m.branch_name,
      m.purchase_id,
      m.supplier_id
    FROM movement_rows m
    WHERE m.rn > v_offset
      AND m.rn <= v_offset + v_size
  )
  SELECT jsonb_build_object(
    'total_count', (SELECT COUNT(*)::integer FROM movement_rows),
    'page', v_page,
    'page_size', v_size,
    'items', COALESCE(
      (SELECT jsonb_agg(to_jsonb(p) ORDER BY p.occurred_at DESC, p.id DESC) FROM page_rows p),
      '[]'::jsonb
    )
  )
  INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'total_count', 0,
    'page', v_page,
    'page_size', v_size,
    'items', '[]'::jsonb
  ));
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_supplier_stock_movements(uuid, boolean, uuid, integer, integer) TO authenticated;

-- Prefer attributing on-hand to purchase receipt sources (FIFO), then Unknown.
CREATE OR REPLACE FUNCTION public.backfill_inventory_receipt_sources()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sources int := 0;
  v_attributed int := 0;
  v_unknown int := 0;
  r RECORD;
  src RECORD;
  v_src uuid;
  v_gap numeric(14, 3);
  v_pos numeric(14, 3);
  v_room numeric(14, 3);
  v_take numeric(14, 3);
BEGIN
  -- Historical purchase lines → receipt sources
  FOR r IN
    SELECT
      pi.id AS purchase_item_id,
      pi.purchase_id,
      pi.variant_id,
      pi.qty,
      pi.unit_cost,
      pi.created_at,
      p.organization_id,
      p.supplier_id,
      p.branch_id,
      pv.product_id,
      (
        SELECT sl.id FROM public.stock_locations sl
        WHERE sl.branch_id = p.branch_id
          AND sl.location_type = 'saleable'
          AND sl.deleted_at IS NULL
          AND sl.is_active = true
        ORDER BY sl.created_at ASC
        LIMIT 1
      ) AS location_id
    FROM public.purchase_items pi
    JOIN public.purchases p ON p.id = pi.purchase_id AND p.deleted_at IS NULL
    JOIN public.product_variants pv ON pv.id = pi.variant_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.inventory_receipt_sources s WHERE s.purchase_item_id = pi.id
    )
  LOOP
    INSERT INTO public.inventory_receipt_sources (
      organization_id, supplier_id, purchase_id, purchase_item_id,
      product_id, variant_id, original_branch_id, original_location_id,
      received_quantity, receipt_unit_cost, received_at,
      source_type, traceability_status
    ) VALUES (
      r.organization_id, r.supplier_id, r.purchase_id, r.purchase_item_id,
      r.product_id, r.variant_id, r.branch_id, r.location_id,
      COALESCE(r.qty, 0), COALESCE(r.unit_cost, 0), COALESCE(r.created_at, timezone('utc', now())),
      'purchase', 'system_allocated'
    );
    v_sources := v_sources + 1;
  END LOOP;

  -- Move prior Unknown cutover stock onto purchase sources when capacity remains.
  FOR r IN
    SELECT
      sp.organization_id,
      sp.variant_id,
      sp.branch_id,
      sp.location_id,
      sp.receipt_source_id AS unknown_source_id,
      sp.quantity AS unknown_qty
    FROM public.inventory_source_positions sp
    JOIN public.inventory_receipt_sources s ON s.id = sp.receipt_source_id
    WHERE sp.quantity > 0
      AND s.traceability_status = 'unknown_legacy'
  LOOP
    v_gap := r.unknown_qty;
    FOR src IN
      SELECT
        s.id,
        s.received_quantity,
        COALESCE((
          SELECT SUM(sp.quantity)
          FROM public.inventory_source_positions sp
          WHERE sp.receipt_source_id = s.id
        ), 0) AS placed
      FROM public.inventory_receipt_sources s
      WHERE s.organization_id = r.organization_id
        AND s.variant_id = r.variant_id
        AND s.traceability_status IS DISTINCT FROM 'unknown_legacy'
        AND (
          s.original_location_id = r.location_id
          OR s.original_branch_id = r.branch_id
        )
      ORDER BY s.received_at ASC, s.id ASC
    LOOP
      EXIT WHEN v_gap <= 0;
      v_room := GREATEST(src.received_quantity - src.placed, 0);
      IF v_room <= 0 THEN
        CONTINUE;
      END IF;
      v_take := LEAST(v_gap, v_room);
      PERFORM public._inventory_source_apply_delta(
        r.organization_id, r.unknown_source_id, r.variant_id, r.branch_id, r.location_id,
        -v_take, 'adjustment', NULL, NULL,
        'backfill-rebal-out:' || r.unknown_source_id::text || ':' || src.id::text || ':' || v_take::text
      );
      PERFORM public._inventory_source_apply_delta(
        r.organization_id, src.id, r.variant_id, r.branch_id, r.location_id,
        v_take, 'opening', NULL, NULL,
        'backfill-rebal-in:' || src.id::text || ':' || r.location_id::text || ':' || v_take::text
      );
      v_gap := v_gap - v_take;
      v_attributed := v_attributed + 1;
    END LOOP;
  END LOOP;

  -- Attribute any still-uncovered on-hand to purchase sources, then Unknown.
  FOR r IN
    SELECT ib.organization_id, ib.variant_id, ib.location_id, ib.quantity,
           sl.branch_id, pv.product_id
    FROM public.inventory_balances ib
    JOIN public.stock_locations sl ON sl.id = ib.location_id
    JOIN public.product_variants pv ON pv.id = ib.variant_id
    WHERE ib.deleted_at IS NULL AND ib.quantity > 0
  LOOP
    SELECT COALESCE(SUM(sp.quantity), 0) INTO v_pos
    FROM public.inventory_source_positions sp
    WHERE sp.organization_id = r.organization_id
      AND sp.variant_id = r.variant_id
      AND sp.location_id = r.location_id;

    v_gap := r.quantity - COALESCE(v_pos, 0);
    IF v_gap <= 0 THEN
      CONTINUE;
    END IF;

    FOR src IN
      SELECT
        s.id,
        s.received_quantity,
        COALESCE((
          SELECT SUM(sp.quantity)
          FROM public.inventory_source_positions sp
          WHERE sp.receipt_source_id = s.id
        ), 0) AS placed
      FROM public.inventory_receipt_sources s
      WHERE s.organization_id = r.organization_id
        AND s.variant_id = r.variant_id
        AND s.traceability_status IS DISTINCT FROM 'unknown_legacy'
        AND (
          s.original_location_id = r.location_id
          OR s.original_branch_id = r.branch_id
        )
      ORDER BY s.received_at ASC, s.id ASC
    LOOP
      EXIT WHEN v_gap <= 0;
      v_room := GREATEST(src.received_quantity - src.placed, 0);
      IF v_room <= 0 THEN
        CONTINUE;
      END IF;
      v_take := LEAST(v_gap, v_room);
      PERFORM public._inventory_source_apply_delta(
        r.organization_id,
        src.id,
        r.variant_id,
        r.branch_id,
        r.location_id,
        v_take,
        'opening',
        NULL,
        NULL,
        'backfill-attr:' || src.id::text || ':' || r.location_id::text || ':' || v_take::text
      );
      v_gap := v_gap - v_take;
      v_attributed := v_attributed + 1;
    END LOOP;

    IF v_gap > 0.0005 THEN
      v_src := public._inventory_source_ensure_unknown(
        r.organization_id, r.variant_id, r.branch_id, r.location_id, NULL
      );
      v_unknown := v_unknown + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'purchase_sources_created', v_sources,
    'purchase_positions_attributed', v_attributed,
    'unknown_balance_locations', v_unknown
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_inventory_receipt_sources() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_inventory_receipt_sources() TO authenticated, service_role;

SELECT public.backfill_inventory_receipt_sources();
