-- Hero cover refactor: allow slides without a click-through link ('none' type)

ALTER TABLE public.website_hero_slides
  DROP CONSTRAINT IF EXISTS website_hero_slides_primary_cta_type_check;

ALTER TABLE public.website_hero_slides
  ADD CONSTRAINT website_hero_slides_primary_cta_type_check
  CHECK (primary_cta_type IN (
    'none', 'all_products', 'category', 'subcategory', 'brand',
    'new_arrivals', 'best_sellers', 'featured', 'on_sale',
    'custom_filter', 'product', 'custom_url'
  ));
