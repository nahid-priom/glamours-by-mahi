-- Storefront catalog: publish flag + anonymous read policies
-- Enables public /shop to read the same Supabase catalog as Admin ERP.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.products.published_at IS
  'When set, product is visible on the public storefront (with is_active = true).';

-- Backfill seeded / active products as published
UPDATE public.products
SET published_at = COALESCE(published_at, updated_at, created_at)
WHERE deleted_at IS NULL
  AND is_active = true
  AND published_at IS NULL;

-- Organizations (resolve storefront org by slug)
CREATE POLICY storefront_organizations_select ON public.organizations
  FOR SELECT TO anon
  USING (deleted_at IS NULL);

-- Published catalog (anon + optional public browse while authenticated)
CREATE POLICY storefront_products_select ON public.products
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND published_at IS NOT NULL
  );

CREATE POLICY storefront_categories_select ON public.categories
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY storefront_subcategories_select ON public.subcategories
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY storefront_brands_select ON public.brands
  FOR SELECT TO anon
  USING (deleted_at IS NULL AND is_active = true);

CREATE POLICY storefront_product_variants_select ON public.product_variants
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_variants.product_id
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

CREATE POLICY storefront_product_images_select ON public.product_images
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_images.product_id
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

CREATE POLICY storefront_product_options_select ON public.product_options
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_options.product_id
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

CREATE POLICY storefront_product_option_values_select ON public.product_option_values
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.product_options po
      JOIN public.products p ON p.id = po.product_id
      WHERE po.id = product_option_values.option_id
        AND po.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

CREATE POLICY storefront_variant_option_values_select ON public.variant_option_values
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = variant_option_values.variant_id
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

CREATE POLICY storefront_inventory_balances_select ON public.inventory_balances
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = inventory_balances.variant_id
        AND pv.deleted_at IS NULL
        AND p.deleted_at IS NULL
        AND p.is_active = true
        AND p.published_at IS NOT NULL
    )
  );

-- Public read for product images in storage (storefront display)
CREATE POLICY product_images_select_anon
ON storage.objects FOR SELECT
TO anon
USING (bucket_id = 'product-images');
