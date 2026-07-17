-- Glamourous by Mahi · Retail ERP
-- Migration 025: POS barcode exact lookup + stable Unsplash cover seed
-- Depends on: 001–024

--------------------------------------------------------------------------------
-- Normalized barcode helper (matches client normalizeBarcode)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_barcode(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    upper(regexp_replace(btrim(coalesce(p_code, '')), '[\s\-_]+', '', 'g')),
    ''
  );
$$;

COMMENT ON FUNCTION public.normalize_barcode(text) IS
  'Normalize barcode: trim, strip spaces/hyphens/underscores, uppercase.';

REVOKE ALL ON FUNCTION public.normalize_barcode(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_barcode(text) TO authenticated;

--------------------------------------------------------------------------------
-- Functional index for O(log n) exact normalized barcode lookup
--------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS product_variants_org_barcode_norm_idx
  ON public.product_variants (
    organization_id,
    (public.normalize_barcode(barcode))
  )
  WHERE deleted_at IS NULL
    AND barcode IS NOT NULL
    AND public.normalize_barcode(barcode) IS NOT NULL;

--------------------------------------------------------------------------------
-- Exact POS barcode lookup RPC (indexed, branch-scoped stock)
--------------------------------------------------------------------------------
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

  SELECT
    pv.id AS variant_id,
    pv.sku,
    pv.barcode,
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
  WHERE pv.organization_id = v_org_id
    AND pv.deleted_at IS NULL
    AND pv.is_active = true
    AND public.normalize_barcode(pv.barcode) = v_code
  ORDER BY pv.sku ASC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(ib.quantity), 0)
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

  -- Prefer variant image, else product cover, else any product image
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
  IF v_thumb IS NULL THEN
    SELECT pi.storage_path INTO v_thumb
    FROM public.product_images pi
    WHERE pi.product_id = v_row.product_id
      AND pi.deleted_at IS NULL
      AND pi.variant_id = v_row.variant_id
    ORDER BY pi.sort_order ASC
    LIMIT 1;
  END IF;
  IF v_thumb IS NULL THEN
    SELECT pi.storage_path INTO v_thumb
    FROM public.product_images pi
    WHERE pi.product_id = v_row.product_id
      AND pi.deleted_at IS NULL
    ORDER BY pi.is_cover DESC, pi.sort_order ASC
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

COMMENT ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) IS
  'Exact normalized barcode lookup for POS with branch saleable stock.';

REVOKE ALL ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Seed stable Unsplash cover images for products missing images
-- Never overwrites existing product_images rows
--------------------------------------------------------------------------------
DO $$
DECLARE
  v_org uuid;
BEGIN
  SELECT id INTO v_org
  FROM public.organizations
  WHERE deleted_at IS NULL
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_org IS NULL THEN
    RETURN;
  END IF;

  WITH pools AS (
    SELECT * FROM (VALUES
      -- women's dresses / kurtis / tunics
      ('dress', ARRAY[
        'https://images.unsplash.com/photo-1595777457583-95e05998dd29?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1572804013309-59aaff8819f4?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1594633312681-4257743c4c9e?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('kurti', ARRAY[
        'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1610030469983-98e550385618?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1591369620205-4a6926c4a38a?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('handbags', ARRAY[
        'https://images.unsplash.com/photo-1584917865442-de89ae76bddb?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1594223274512-ad4803739b7c?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1590874103328-eac88a683a5f?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('jewellery', ARRAY[
        'https://images.unsplash.com/photo-1515562141203-7a88fb7ece69?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1611595437941-53c9610c5e7b?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1535632066927-ab7c754de088?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('beauty', ARRAY[
        'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('shoes', ARRAY[
        'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1560769629-845ec4e4c76b?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('mens', ARRAY[
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1507679799987-4e69721b5fbe?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('kids', ARRAY[
        'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1503919545889-aef636e10ad1?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1471286174890-9c112ffcaad7?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('accessories', ARRAY[
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=600&q=80'
      ]::text[]),
      ('fallback', ARRAY[
        'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=600&q=80',
        'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=600&q=80'
      ]::text[])
    ) AS t(pool_key, urls)
  ),
  candidates AS (
    SELECT
      p.id AS product_id,
      p.organization_id,
      CASE
        WHEN lower(coalesce(sc.name, '')) LIKE '%handbag%'
          OR lower(coalesce(sc.name, '')) LIKE '%bag%'
          OR lower(coalesce(sc.name, '')) LIKE '%tote%'
          OR lower(coalesce(sc.name, '')) LIKE '%backpack%'
          OR lower(coalesce(sc.name, '')) LIKE '%clutch%'
          THEN 'handbags'
        WHEN lower(coalesce(sc.name, '')) LIKE '%jewel%'
          OR lower(coalesce(sc.name, '')) LIKE '%earring%'
          OR lower(coalesce(sc.name, '')) LIKE '%necklace%'
          OR lower(coalesce(sc.name, '')) LIKE '%bangle%'
          THEN 'jewellery'
        WHEN lower(coalesce(c.name, '')) LIKE '%footwear%'
          OR lower(coalesce(sc.name, '')) LIKE '%sandal%'
          OR lower(coalesce(sc.name, '')) LIKE '%heel%'
          OR lower(coalesce(sc.name, '')) LIKE '%shoe%'
          THEN 'shoes'
        WHEN lower(coalesce(c.name, '')) LIKE '%men%'
          OR lower(coalesce(sc.name, '')) LIKE '%shirt%'
          OR lower(coalesce(sc.name, '')) LIKE '%panjabi%'
          THEN 'mens'
        WHEN lower(coalesce(c.name, '')) LIKE '%kid%'
          OR lower(coalesce(sc.name, '')) LIKE '%girl%'
          OR lower(coalesce(sc.name, '')) LIKE '%boy%'
          OR lower(coalesce(sc.name, '')) LIKE '%frock%'
          THEN 'kids'
        WHEN lower(coalesce(sc.name, '')) LIKE '%kurti%'
          OR lower(coalesce(sc.name, '')) LIKE '%tunic%'
          THEN 'kurti'
        WHEN lower(coalesce(sc.name, '')) LIKE '%dress%'
          OR lower(coalesce(sc.name, '')) LIKE '%gown%'
          OR lower(coalesce(sc.name, '')) LIKE '%lehenga%'
          OR lower(coalesce(sc.name, '')) LIKE '%sharee%'
          THEN 'dress'
        WHEN lower(coalesce(c.name, '')) LIKE '%accessor%'
          THEN 'accessories'
        WHEN lower(coalesce(c.name, '')) LIKE '%beauty%'
          OR lower(coalesce(c.name, '')) LIKE '%cosmetic%'
          THEN 'beauty'
        ELSE 'fallback'
      END AS pool_key,
      abs(hashtext(p.id::text)) AS h
    FROM public.products p
    LEFT JOIN public.categories c ON c.id = p.category_id AND c.deleted_at IS NULL
    LEFT JOIN public.subcategories sc ON sc.id = p.subcategory_id AND sc.deleted_at IS NULL
    WHERE p.organization_id = v_org
      AND p.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.product_images pi
        WHERE pi.product_id = p.id
          AND pi.deleted_at IS NULL
      )
  ),
  picked AS (
    SELECT
      cand.product_id,
      cand.organization_id,
      cand.pool_key,
      pools.urls[1 + (cand.h % cardinality(pools.urls))] AS storage_path
    FROM candidates cand
    INNER JOIN pools ON pools.pool_key = cand.pool_key
  )
  INSERT INTO public.product_images (
    organization_id,
    product_id,
    variant_id,
    storage_path,
    is_cover,
    sort_order,
    metadata
  )
  SELECT
    picked.organization_id,
    picked.product_id,
    NULL,
    picked.storage_path,
    true,
    0,
    jsonb_build_object(
      'source', 'unsplash_seed',
      'pool', picked.pool_key,
      'seeded_at', timezone('utc', now())
    )
  FROM picked
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_images pi
    WHERE pi.product_id = picked.product_id
      AND pi.deleted_at IS NULL
  );
END;
$$;
