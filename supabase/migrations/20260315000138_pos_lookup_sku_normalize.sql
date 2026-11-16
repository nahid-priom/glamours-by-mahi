-- Fix POS SKU fallback: compare normalized SKU to normalized scan code.
CREATE OR REPLACE FUNCTION public.pos_lookup_variant_by_barcode(
  p_barcode text,
  p_branch_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_profile_id uuid := public.current_profile_id();
  v_org_id uuid := public.current_organization_id();
  v_code text := public.normalize_barcode(p_barcode);
  v_row record;
  v_stock numeric(14, 3) := 0;
  v_thumb text;
  v_match_count int := 0;
BEGIN
  IF auth.uid() IS NULL OR v_profile_id IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('pos.create')
     AND NOT public.user_has_permission('products.read') THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  IF p_branch_id IS NULL OR NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  IF v_code IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT count(DISTINCT pb.variant_id)
  INTO v_match_count
  FROM public.product_barcodes pb
  WHERE pb.organization_id = v_org_id
    AND pb.deleted_at IS NULL
    AND pb.code_normalized = v_code
    AND pb.variant_id IS NOT NULL;

  IF v_match_count > 1 THEN
    RETURN jsonb_build_object(
      'error', 'ambiguous_barcode',
      'message', 'Barcode matches multiple variants — resolve conflicts before selling'
    );
  END IF;

  SELECT
    pv.id AS variant_id,
    pv.sku,
    coalesce(pb.code, pv.barcode) AS barcode,
    pv.name AS variant_name,
    pv.selling_price,
    pv.image_path,
    p.id AS product_id,
    p.name AS product_name
  INTO v_row
  FROM public.product_variants pv
  INNER JOIN public.products p
    ON p.id = pv.product_id
   AND p.organization_id = v_org_id
   AND p.deleted_at IS NULL
   AND p.is_active = true
   AND p.status = 'active'
  LEFT JOIN public.product_barcodes pb
    ON pb.variant_id = pv.id
   AND pb.organization_id = v_org_id
   AND pb.deleted_at IS NULL
   AND pb.code_normalized = v_code
   AND pb.conflict_flag = false
  WHERE pv.organization_id = v_org_id
    AND pv.deleted_at IS NULL
    AND pv.is_active = true
    AND (
      pb.id IS NOT NULL
      OR public.normalize_barcode(pv.barcode) = v_code
      OR public.normalize_barcode(pv.sku) = v_code
    )
  ORDER BY
    CASE WHEN pb.id IS NOT NULL THEN 0 ELSE 1 END,
    pv.sku ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(ib.quantity - coalesce(ib.qty_reserved, 0)), 0)
  INTO v_stock
  FROM public.inventory_balances ib
  INNER JOIN public.stock_locations sl
    ON sl.id = ib.location_id
   AND sl.deleted_at IS NULL
   AND sl.is_active = true
   AND sl.location_type = 'saleable'
   AND sl.branch_id = p_branch_id
  WHERE ib.variant_id = v_row.variant_id
    AND ib.deleted_at IS NULL
    AND ib.organization_id = v_org_id;

  v_thumb := NULLIF(v_row.image_path, '');
  IF v_thumb IS NULL THEN
    SELECT pi.storage_path INTO v_thumb
    FROM public.product_images pi
    WHERE pi.product_id = v_row.product_id
      AND pi.deleted_at IS NULL
      AND pi.is_cover = true
      AND pi.variant_id IS NULL
    ORDER BY pi.sort_order ASC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'variantId', v_row.variant_id,
    'productId', v_row.product_id,
    'productName', v_row.product_name,
    'variantLabel', coalesce(NULLIF(v_row.variant_name, ''), 'Default'),
    'sku', v_row.sku,
    'barcode', v_row.barcode,
    'thumbnailUrl', v_thumb,
    'unitPrice', v_row.selling_price,
    'availableStock', v_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) TO authenticated;
