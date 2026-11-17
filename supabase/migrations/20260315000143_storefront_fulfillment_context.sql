-- Storefront fulfillment context: same branch rule as place_online_order
-- (is_central DESC, created_at ASC) + saleable location ids for stock scoping.

CREATE OR REPLACE FUNCTION public.get_storefront_fulfillment_context(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch_id uuid;
  v_location_ids uuid[];
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  SELECT b.id
  INTO v_branch_id
  FROM public.branches b
  WHERE b.organization_id = p_org_id
    AND b.is_active = true
    AND b.deleted_at IS NULL
  ORDER BY b.is_central DESC, b.created_at ASC
  LIMIT 1;

  IF v_branch_id IS NULL THEN
    RETURN jsonb_build_object(
      'branch_id', null,
      'saleable_location_ids', '[]'::jsonb,
      'prices', '[]'::jsonb
    );
  END IF;

  SELECT coalesce(array_agg(sl.id ORDER BY sl.is_default DESC, sl.created_at ASC), '{}'::uuid[])
  INTO v_location_ids
  FROM public.stock_locations sl
  WHERE sl.organization_id = p_org_id
    AND sl.branch_id = v_branch_id
    AND sl.location_type = 'saleable'
    AND sl.is_active = true
    AND sl.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'branch_id', v_branch_id,
    'saleable_location_ids', to_jsonb(coalesce(v_location_ids, '{}'::uuid[])),
    'prices', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'product_id', bpp.product_id,
            'variant_id', bpp.variant_id,
            'retail_price', bpp.retail_price,
            'discount_price', bpp.discount_price,
            'effective_from', bpp.effective_from,
            'effective_to', bpp.effective_to
          )
        )
        FROM public.branch_product_prices bpp
        WHERE bpp.organization_id = p_org_id
          AND bpp.branch_id = v_branch_id
          AND bpp.is_active = true
          AND bpp.deleted_at IS NULL
          AND bpp.effective_from <= timezone('utc', now())
          AND (bpp.effective_to IS NULL OR bpp.effective_to > timezone('utc', now()) )
      ),
      '[]'::jsonb
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_storefront_fulfillment_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_storefront_fulfillment_context(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_storefront_fulfillment_context(uuid) TO authenticated;

-- Allow storefront (and POS) clients to resolve effective prices via the existing authority.
GRANT EXECUTE ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) TO anon;
