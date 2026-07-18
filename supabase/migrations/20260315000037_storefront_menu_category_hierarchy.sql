-- Storefront menu category hierarchy
-- Reuses the existing categories + subcategories tables (no parallel table).
-- Adds menu-oriented fields, backfills slugs, fixes obvious naming issues and
-- seeds the demo hierarchy idempotently (safe to run repeatedly).

-- ---------------------------------------------------------------------------
-- 1. Missing fields (additive, idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS icon text,
  ADD COLUMN IF NOT EXISTS show_in_menu boolean NOT NULL DEFAULT true;

ALTER TABLE public.subcategories
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS show_in_menu boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.categories.slug IS 'URL-safe identifier used by storefront category filters (/shop?category=slug).';
COMMENT ON COLUMN public.categories.icon IS 'Lucide icon name rendered in the storefront mega menu.';
COMMENT ON COLUMN public.categories.show_in_menu IS 'Whether the category appears in the storefront Categories menu.';

-- ---------------------------------------------------------------------------
-- 2. Backfill slugs from names, then dedupe within each organization
-- ---------------------------------------------------------------------------
UPDATE public.categories
SET slug = trim(both '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

UPDATE public.subcategories
SET slug = trim(both '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY organization_id, slug ORDER BY created_at, id) AS rn
  FROM public.categories
  WHERE deleted_at IS NULL
)
UPDATE public.categories c
SET slug = c.slug || '-' || left(c.id::text, 4)
FROM ranked r
WHERE r.id = c.id AND r.rn > 1;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY organization_id, slug ORDER BY created_at, id) AS rn
  FROM public.subcategories
  WHERE deleted_at IS NULL
)
UPDATE public.subcategories s
SET slug = s.slug || '-' || left(s.id::text, 4)
FROM ranked r
WHERE r.id = s.id AND r.rn > 1;

-- ---------------------------------------------------------------------------
-- 3. Obvious naming fixes (guarded against slug collisions)
-- ---------------------------------------------------------------------------
UPDATE public.categories c
SET name = 'Sunglasses', slug = 'sunglasses'
WHERE lower(c.name) IN ('sunglass', 'sun glass', 'sun-glass')
  AND c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories other
    WHERE other.organization_id = c.organization_id
      AND other.slug = 'sunglasses'
      AND other.id <> c.id
      AND other.deleted_at IS NULL
  );

-- Merchandising pseudo-categories stay reachable from homepage sections,
-- but do not belong in the taxonomy menu.
UPDATE public.categories
SET show_in_menu = false
WHERE slug IN ('new-arrival', 'best-seller', 'sale')
  AND deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4. Constraints and indexes
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS categories_org_slug_unique
  ON public.categories (organization_id, slug)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subcategories_org_slug_unique
  ON public.subcategories (organization_id, slug)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS categories_menu_lookup_idx
  ON public.categories (organization_id, is_active, show_in_menu, sort_order)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS subcategories_menu_lookup_idx
  ON public.subcategories (category_id, is_active, show_in_menu, sort_order)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Idempotent hierarchy seed for the storefront organization
--    (matches existing categories by slug aliases; never duplicates)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_org_id uuid;
  v_cat_id uuid;
  parent record;
  child_name text;
  child_slug text;
  child_sort int;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE slug = 'glamourous-by-mahi' AND deleted_at IS NULL
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Storefront organization not found — skipping category hierarchy seed.';
    RETURN;
  END IF;

  FOR parent IN
    SELECT * FROM (VALUES
      ('Beauty & Skin Care', 'beauty-skin-care', ARRAY['beauty-skin-care','beauty','skin-care','skincare'], 'sparkles', 10,
        ARRAY['Face Cream','Face Wash','Toner','Serum','Sunscreen','Body Care','Acne Care']),
      ('Makeup', 'makeup', ARRAY['makeup','make-up','cosmetics'], 'palette', 20,
        ARRAY['Lipstick','Foundation','Eye Makeup','Face Makeup','Makeup Tools']),
      ('Hair Care', 'hair-care', ARRAY['hair-care','hair'], 'brush', 30,
        ARRAY['Shampoo','Conditioner','Hair Oil','Hair Mask','Hair Styling']),
      ('Eye Care', 'eye-care', ARRAY['eye-care'], 'eye', 40,
        ARRAY[]::text[]),
      ('Dress', 'dress', ARRAY['dress','dresses'], 'shirt', 50,
        ARRAY[
          'Saree','Benarasi Saree','Bridal Saree','Chiffon Saree','Cotton Saree','Indian Saree',
          'Jamdani Saree','Katan Saree','Moslin Saree','Party Saree','Ready Saree',
          'Stitched Dress','One Piece','Two Piece','Three Piece','Ethnic Wear','Indo-Western Wear',
          'Party Wear','Bridal Wear','Bridal Lehenga','Pakistani Dress','Indian Dress','Sharara','Gharara',
          'Unstitched Dress','Unstitched Three Piece','Mixed Collection',
          'Western Dress','Bodycon','Gown','Tops','Shirt','Pants','Skirt','Co-ord Set'
        ]),
      ('Shoes', 'shoes', ARRAY['shoes','shoe','footwear'], 'footprints', 60,
        ARRAY['Heels','Sandals','Sneakers','Flats']),
      ('Bags', 'bags', ARRAY['bags','bag'], 'shopping-bag', 70,
        ARRAY['Handbags','Shoulder Bags','Crossbody Bags','Clutches','Backpacks']),
      ('Jewellery', 'jewellery', ARRAY['jewellery','jewelry'], 'gem', 80,
        ARRAY['Necklace','Earrings','Bangles','Rings','Jewellery Sets']),
      ('Sunglasses', 'sunglasses', ARRAY['sunglasses','sunglass'], 'glasses', 90,
        ARRAY[]::text[]),
      ('Watch', 'watch', ARRAY['watch','watches'], 'watch', 100,
        ARRAY[]::text[])
    ) AS t(name, slug, aliases, icon, sort_order, children)
  LOOP
    -- Reuse an existing category matched by any slug alias.
    SELECT id INTO v_cat_id
    FROM public.categories
    WHERE organization_id = v_org_id
      AND slug = ANY(parent.aliases)
      AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_cat_id IS NULL THEN
      INSERT INTO public.categories (organization_id, name, slug, icon, sort_order, is_active, show_in_menu)
      VALUES (v_org_id, parent.name, parent.slug, parent.icon, parent.sort_order, true, true)
      RETURNING id INTO v_cat_id;
    ELSE
      -- Fill menu metadata without overwriting admin-managed values.
      UPDATE public.categories
      SET icon = COALESCE(icon, parent.icon)
      WHERE id = v_cat_id;
    END IF;

    child_sort := 0;
    FOREACH child_name IN ARRAY parent.children
    LOOP
      child_sort := child_sort + 10;
      child_slug := trim(both '-' FROM regexp_replace(lower(child_name), '[^a-z0-9]+', '-', 'g'));

      IF NOT EXISTS (
        SELECT 1 FROM public.subcategories
        WHERE organization_id = v_org_id
          AND slug = child_slug
          AND deleted_at IS NULL
      ) THEN
        INSERT INTO public.subcategories (organization_id, category_id, name, slug, sort_order, is_active, show_in_menu)
        VALUES (v_org_id, v_cat_id, child_name, child_slug, child_sort, true, true);
      END IF;
    END LOOP;
  END LOOP;
END $$;
