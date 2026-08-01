-- Migration 101: Product inventory summary RPCs

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
  SELECT count(*) INTO v_total FROM filtered;

  SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.name), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT * FROM filtered
    ORDER BY name
    OFFSET v_offset
    LIMIT v_page_size
  ) f;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

--------------------------------------------------------------------------------
-- get_product_variant_summary
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_product_variant_summary(
  p_product_id uuid,
  p_branch_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_product public.products%ROWTYPE;
  v_variants jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('products.read') THEN
    RAISE EXCEPTION 'Missing permission products.read' USING ERRCODE = '42501';
  END IF;

  IF p_branch_id IS NOT NULL AND NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.organization_id = v_org
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'variant_id', pv.id,
    'sku', pv.sku,
    'barcode', pv.barcode,
    'name', pv.name,
    'selling_price', pv.selling_price,
    'purchase_price', pv.purchase_price,
    'is_active', pv.is_active,
    'total_stock', coalesce(st.qty, 0),
    'reserved', coalesce(st.reserved, 0),
    'available', greatest(coalesce(st.qty, 0) - coalesce(st.reserved, 0), 0)
  ) ORDER BY pv.sku), '[]'::jsonb)
  INTO v_variants
  FROM public.product_variants pv
  LEFT JOIN LATERAL (
    SELECT
      sum(ib.quantity) AS qty,
      sum(ib.qty_reserved) AS reserved
    FROM public.inventory_balances ib
    LEFT JOIN public.stock_locations sl ON sl.id = ib.location_id
    WHERE ib.variant_id = pv.id
      AND ib.organization_id = v_org
      AND ib.deleted_at IS NULL
      AND (p_branch_id IS NULL OR sl.branch_id = p_branch_id OR sl.branch_id IS NULL)
  ) st ON true
  WHERE pv.product_id = p_product_id
    AND pv.organization_id = v_org
    AND pv.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'product_id', v_product.id,
    'name', v_product.name,
    'status', v_product.status,
    'reorder_level', v_product.reorder_level,
    'variants', v_variants
  );
END;
$$;

--------------------------------------------------------------------------------
-- get_variant_branch_stock
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_variant_branch_stock(p_variant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('products.read') THEN
    RAISE EXCEPTION 'Missing permission products.read' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'branch_id', b.id,
      'branch_name', b.name,
      'branch_code', b.code,
      'location_id', sl.id,
      'location_name', sl.name,
      'quantity', coalesce(ib.quantity, 0),
      'qty_reserved', coalesce(ib.qty_reserved, 0),
      'available', greatest(coalesce(ib.quantity, 0) - coalesce(ib.qty_reserved, 0), 0)
    ) ORDER BY b.name, sl.name)
    FROM public.inventory_balances ib
    JOIN public.stock_locations sl ON sl.id = ib.location_id
    JOIN public.branches b ON b.id = sl.branch_id
    WHERE ib.variant_id = p_variant_id
      AND ib.organization_id = v_org
      AND ib.deleted_at IS NULL
      AND sl.deleted_at IS NULL
      AND b.deleted_at IS NULL
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_products_with_inventory_summary(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_products_with_inventory_summary(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_product_variant_summary(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_product_variant_summary(uuid, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_variant_branch_stock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_variant_branch_stock(uuid) TO authenticated, service_role;
