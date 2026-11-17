-- Harden resolve_effective_price for storefront anon access:
-- - Require product in org, active, not deleted
-- - For anon-safe storefront use: require published_at (active catalog)
-- Authenticated callers still resolve for active products (POS may sell unpublished drafts only if active+not deleted — keep published check for consistency with storefront display; POS uses own catalogue filters).
-- Also revoke PUBLIC execute; grant anon + authenticated explicitly.

CREATE OR REPLACE FUNCTION public.resolve_effective_price(
  p_org_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric(14, 2);
  v_product public.products%ROWTYPE;
  v_variant public.product_variants%ROWTYPE;
  v_role text := coalesce(auth.role(), 'anon');
BEGIN
  IF p_org_id IS NULL OR p_branch_id IS NULL OR p_product_id IS NULL OR p_variant_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_product
  FROM public.products p
  WHERE p.id = p_product_id
    AND p.organization_id = p_org_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_product.is_active IS NOT TRUE THEN
    RETURN 0;
  END IF;

  -- Anon (storefront) may only resolve published catalog products.
  IF v_role = 'anon' AND v_product.published_at IS NULL THEN
    RETURN 0;
  END IF;

  -- Branch must belong to the same organization.
  IF NOT EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = p_branch_id
      AND b.organization_id = p_org_id
      AND b.deleted_at IS NULL
      AND b.is_active = true
  ) THEN
    RETURN 0;
  END IF;

  SELECT * INTO v_variant
  FROM public.product_variants pv
  WHERE pv.id = p_variant_id
    AND pv.product_id = p_product_id
    AND pv.organization_id = p_org_id
    AND pv.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- 1. Active branch variant price
  SELECT COALESCE(bpp.discount_price, bpp.retail_price)
  INTO v_price
  FROM public.branch_product_prices bpp
  WHERE bpp.organization_id = p_org_id
    AND bpp.branch_id = p_branch_id
    AND bpp.product_id = p_product_id
    AND bpp.variant_id = p_variant_id
    AND bpp.is_active = true
    AND bpp.deleted_at IS NULL
    AND bpp.effective_from <= timezone('utc', now())
    AND (bpp.effective_to IS NULL OR bpp.effective_to > timezone('utc', now()))
  ORDER BY bpp.effective_from DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 2. Active branch product price
  SELECT COALESCE(bpp.discount_price, bpp.retail_price)
  INTO v_price
  FROM public.branch_product_prices bpp
  WHERE bpp.organization_id = p_org_id
    AND bpp.branch_id = p_branch_id
    AND bpp.product_id = p_product_id
    AND bpp.variant_id IS NULL
    AND bpp.is_active = true
    AND bpp.deleted_at IS NULL
    AND bpp.effective_from <= timezone('utc', now())
    AND (bpp.effective_to IS NULL OR bpp.effective_to > timezone('utc', now()))
  ORDER BY bpp.effective_from DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 3. Variant default
  RETURN COALESCE(v_variant.selling_price, v_product.selling_price, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) TO service_role;

-- Ensure fulfillment context is not PUBLIC-wildcard beyond intended roles
REVOKE ALL ON FUNCTION public.get_storefront_fulfillment_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_fulfillment_context(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_fulfillment_context(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_storefront_fulfillment_context(uuid) TO service_role;
