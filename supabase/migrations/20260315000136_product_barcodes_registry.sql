-- Additive barcode registry + POS lookup via registry (+ SKU fallback)
-- Depends on: 00135, 00025 (normalize_barcode / pos_lookup)

--------------------------------------------------------------------------------
-- 1. product_barcodes registry
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_barcodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  product_id uuid REFERENCES public.products (id) ON DELETE SET NULL,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  code text NOT NULL,
  code_normalized text GENERATED ALWAYS AS (
    public.normalize_barcode(code)
  ) STORED,
  kind text NOT NULL DEFAULT 'internal'
    CHECK (kind IN ('internal', 'external', 'alias', 'legacy')),
  is_primary boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual',
  conflict_flag boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT product_barcodes_target_chk CHECK (
    variant_id IS NOT NULL OR product_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS product_barcodes_org_code_norm_uidx
  ON public.product_barcodes (organization_id, code_normalized)
  WHERE deleted_at IS NULL AND code_normalized IS NOT NULL AND conflict_flag = false;

CREATE INDEX IF NOT EXISTS product_barcodes_variant_idx
  ON public.product_barcodes (variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS product_barcodes_product_idx
  ON public.product_barcodes (product_id)
  WHERE deleted_at IS NULL;

ALTER TABLE public.product_barcodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_barcodes_select ON public.product_barcodes;
CREATE POLICY product_barcodes_select ON public.product_barcodes
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

DROP POLICY IF EXISTS product_barcodes_insert ON public.product_barcodes;
CREATE POLICY product_barcodes_insert ON public.product_barcodes
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.create')
      OR public.user_has_permission('products.update')
    )
  );

DROP POLICY IF EXISTS product_barcodes_update ON public.product_barcodes;
CREATE POLICY product_barcodes_update ON public.product_barcodes
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.update')
      OR public.user_has_permission('products.create')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- 2. Backfill from variants + product base barcodes
--------------------------------------------------------------------------------
INSERT INTO public.product_barcodes (
  organization_id, product_id, variant_id, code, kind, is_primary, source
)
SELECT
  pv.organization_id,
  pv.product_id,
  pv.id,
  btrim(pv.barcode),
  'legacy',
  true,
  'backfill_variant'
FROM public.product_variants pv
WHERE pv.deleted_at IS NULL
  AND pv.barcode IS NOT NULL
  AND btrim(pv.barcode) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_barcodes pb
    WHERE pb.organization_id = pv.organization_id
      AND pb.deleted_at IS NULL
      AND pb.code_normalized = public.normalize_barcode(pv.barcode)
  );

-- Flag ambiguous org codes (same normalized code → multiple variants)
WITH dups AS (
  SELECT organization_id, code_normalized
  FROM public.product_barcodes
  WHERE deleted_at IS NULL AND code_normalized IS NOT NULL
  GROUP BY organization_id, code_normalized
  HAVING count(*) > 1
)
UPDATE public.product_barcodes pb
SET conflict_flag = true,
    updated_at = now()
FROM dups
WHERE pb.organization_id = dups.organization_id
  AND pb.code_normalized = dups.code_normalized
  AND pb.deleted_at IS NULL;

INSERT INTO public.product_barcodes (
  organization_id, product_id, variant_id, code, kind, is_primary, source
)
SELECT
  p.organization_id,
  p.id,
  (
    SELECT pv.id
    FROM public.product_variants pv
    WHERE pv.product_id = p.id
      AND pv.deleted_at IS NULL
    ORDER BY pv.created_at ASC
    LIMIT 1
  ),
  btrim(p.base_barcode),
  'legacy',
  false,
  'backfill_product'
FROM public.products p
WHERE p.deleted_at IS NULL
  AND p.base_barcode IS NOT NULL
  AND btrim(p.base_barcode) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.product_barcodes pb
    WHERE pb.organization_id = p.organization_id
      AND pb.deleted_at IS NULL
      AND pb.code_normalized = public.normalize_barcode(p.base_barcode)
  );

--------------------------------------------------------------------------------
-- 3. Allocate internal barcode (8-digit numeric, collision-safe)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_internal_barcode(
  p_variant_id uuid DEFAULT NULL,
  p_product_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_code text;
  v_attempt int := 0;
  v_variant_id uuid := p_variant_id;
  v_product_id uuid := p_product_id;
BEGIN
  IF auth.uid() IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT public.user_has_permission('products.create')
     AND NOT public.user_has_permission('products.update') THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  IF v_variant_id IS NOT NULL THEN
    SELECT product_id INTO v_product_id
    FROM public.product_variants
    WHERE id = v_variant_id AND organization_id = v_org_id AND deleted_at IS NULL;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 40 THEN
      RAISE EXCEPTION 'Could not allocate unique barcode';
    END IF;

    v_code := lpad((floor(random() * 90000000) + 10000000)::bigint::text, 8, '0');

    IF EXISTS (
      SELECT 1 FROM public.product_variants
      WHERE organization_id = v_org_id
        AND deleted_at IS NULL
        AND public.normalize_barcode(barcode) = public.normalize_barcode(v_code)
    ) THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.product_barcodes
      WHERE organization_id = v_org_id
        AND deleted_at IS NULL
        AND conflict_flag = false
        AND code_normalized = public.normalize_barcode(v_code)
    ) THEN
      CONTINUE;
    END IF;

    EXIT;
  END LOOP;

  IF v_variant_id IS NOT NULL OR v_product_id IS NOT NULL THEN
    INSERT INTO public.product_barcodes (
      organization_id, product_id, variant_id, code, kind, is_primary, source, created_by
    ) VALUES (
      v_org_id, v_product_id, v_variant_id, v_code, 'internal', true, 'allocate_rpc',
      public.current_profile_id()
    );

    IF v_variant_id IS NOT NULL THEN
      UPDATE public.product_variants
      SET barcode = coalesce(nullif(btrim(barcode), ''), v_code),
          updated_at = now()
      WHERE id = v_variant_id
        AND organization_id = v_org_id;
    END IF;
  END IF;

  RETURN v_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_internal_barcode(uuid, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- 4. POS lookup: registry first, then variant barcode, then exact SKU
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

  -- Ambiguous registry hits must not silently resolve
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
      OR upper(btrim(coalesce(pv.sku, ''))) = v_code
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

COMMENT ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) IS
  'Exact barcode/SKU lookup via product_barcodes registry with ambiguity protection.';

GRANT EXECUTE ON FUNCTION public.pos_lookup_variant_by_barcode(text, uuid) TO authenticated;
