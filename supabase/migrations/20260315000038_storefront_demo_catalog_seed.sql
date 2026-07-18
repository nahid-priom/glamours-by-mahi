-- Glamourous by Mahi · Storefront demo catalog seed
-- Migration 037: Idempotent seed of exactly 100 storefront-owned products.
--
-- Design notes:
--   * Seed-owned rows are identified by the base_sku prefix 'GG-SEED-' so the
--     script can run repeatedly without creating duplicates and without ever
--     touching genuine, user-created products.
--   * Products map onto the REAL schema: each product gets one active default
--     variant + an inventory_balances row (storefront stock is derived from
--     variant inventory) and one cover image + one gallery image drawn only
--     from the verified files in public/products.
--   * Categories/subcategories are reused by slug (2-level taxonomy). Products
--     are attached to their subcategory + resolved parent category. Any missing
--     subcategory is skipped safely.
--   * There is no products.sale_price / status / slug column in this schema, so
--     those storefront concepts remain derived in the app layer (unchanged).

DO $seed$
DECLARE
  v_org      uuid;
  v_branch   uuid;
  v_location uuid;
  v_paths    constant text[] := ARRAY[
    '/products/1.png',
    '/products/2.png',
    '/products/3.png',
    '/products/4.png',
    '/products/6 (1).png',
    '/products/7.png',
    '/products/8.png',
    '/products/89.png'
  ];
  v_img_count constant int := array_length(v_paths, 1);
  v_brands   constant text[] := ARRAY[
    'Glamours Signature', 'Mahi Couture', 'Rong Bangla', 'Urban Thread', 'Aria Luxe'
  ];
  b          text;
  rec        record;
  v_idx      int := 0;
  v_created  int := 0;
  v_updated  int := 0;
  v_skipped  int := 0;
  v_cat      uuid;
  v_sub      uuid;
  v_brand_id uuid;
  v_product  uuid;
  v_variant  uuid;
  v_cover    text;
  v_gallery  text;
  v_cover_id uuid;
BEGIN
  SELECT id INTO v_org
  FROM public.organizations
  WHERE slug = 'glamourous-by-mahi' AND deleted_at IS NULL
  LIMIT 1;

  IF v_org IS NULL THEN
    RAISE NOTICE 'Storefront organization not found — skipping demo catalog seed.';
    RETURN;
  END IF;

  ------------------------------------------------------------------------------
  -- Brands (upsert by name)
  ------------------------------------------------------------------------------
  FOREACH b IN ARRAY v_brands LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.brands
      WHERE organization_id = v_org AND lower(name) = lower(b) AND deleted_at IS NULL
    ) THEN
      INSERT INTO public.brands (organization_id, name, is_active)
      VALUES (v_org, b, true);
    END IF;
  END LOOP;

  ------------------------------------------------------------------------------
  -- A saleable stock location to hold storefront inventory
  ------------------------------------------------------------------------------
  SELECT sl.id INTO v_location
  FROM public.stock_locations sl
  WHERE sl.organization_id = v_org
    AND sl.location_type = 'saleable'
    AND sl.deleted_at IS NULL
  ORDER BY sl.is_default DESC, sl.created_at
  LIMIT 1;

  IF v_location IS NULL THEN
    SELECT id INTO v_branch
    FROM public.branches
    WHERE organization_id = v_org AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_branch IS NOT NULL THEN
      INSERT INTO public.stock_locations
        (organization_id, branch_id, name, location_type, is_default, is_active)
      VALUES
        (v_org, v_branch, 'Storefront Stock', 'saleable', true, true)
      RETURNING id INTO v_location;
    ELSE
      RAISE NOTICE 'No branch found — seeded products will have zero stock until inventory is added.';
    END IF;
  END IF;

  ------------------------------------------------------------------------------
  -- Product specs (name, sku, subcategory slug, selling price, cost, stock)
  ------------------------------------------------------------------------------
  FOR rec IN
    SELECT * FROM (VALUES
      -- Co-ord Set (15) --------------------------------------------------------
      ('Blush Rose Co-ord Set',           'GG-SEED-001', 'co-ord-set',      3290, 1900, 24),
      ('Emerald Linen Co-ord Set',        'GG-SEED-002', 'co-ord-set',      3490, 2050, 18),
      ('Midnight Black Two-Piece Co-ord', 'GG-SEED-003', 'co-ord-set',      3190, 1850, 30),
      ('Ivory Satin Co-ord Set',          'GG-SEED-004', 'co-ord-set',      3690, 2200, 12),
      ('Terracotta Cotton Co-ord Set',    'GG-SEED-005', 'co-ord-set',      2890, 1650, 40),
      ('Powder Blue Co-ord Set',          'GG-SEED-006', 'co-ord-set',      3090, 1800, 26),
      ('Mustard Weave Co-ord Set',        'GG-SEED-007', 'co-ord-set',      2990, 1700, 22),
      ('Coral Breeze Co-ord Set',         'GG-SEED-008', 'co-ord-set',      3390, 1980, 15),
      ('Sage Green Co-ord Set',           'GG-SEED-009', 'co-ord-set',      3590, 2100,  9),
      ('Dusty Lavender Co-ord Set',       'GG-SEED-010', 'co-ord-set',      3290, 1900, 33),
      ('Classic White Co-ord Set',        'GG-SEED-011', 'co-ord-set',      3190, 1850, 28),
      ('Wine Textured Co-ord Set',        'GG-SEED-012', 'co-ord-set',      3790, 2300, 14),
      ('Peach Sorbet Co-ord Set',         'GG-SEED-013', 'co-ord-set',      2990, 1700, 20),
      ('Charcoal Tailored Co-ord Set',    'GG-SEED-014', 'co-ord-set',      3990, 2450,  7),
      ('Rose Gold Shimmer Co-ord Set',    'GG-SEED-015', 'co-ord-set',      4290, 2600, 16),
      -- Saree (10) -------------------------------------------------------------
      ('Aqua Handloom Saree',             'GG-SEED-016', 'saree',           4590, 2800, 12),
      ('Crimson Silk Saree',              'GG-SEED-017', 'saree',           5290, 3200,  8),
      ('Golden Zari Saree',               'GG-SEED-018', 'saree',           6490, 4000,  6),
      ('Pastel Chiffon Saree',            'GG-SEED-019', 'saree',           3890, 2300, 15),
      ('Royal Blue Katan Saree',          'GG-SEED-020', 'saree',           5690, 3500,  9),
      ('Ivory Pearl Saree',               'GG-SEED-021', 'saree',           4990, 3050, 11),
      ('Maroon Festive Saree',            'GG-SEED-022', 'saree',           5490, 3350,  7),
      ('Teal Woven Saree',                'GG-SEED-023', 'saree',           4290, 2600, 13),
      ('Blush Georgette Saree',           'GG-SEED-024', 'saree',           3990, 2400, 10),
      ('Emerald Banarasi Saree',          'GG-SEED-025', 'saree',           7290, 4600,  5),
      -- Gown (6) ---------------------------------------------------------------
      ('Sapphire Evening Gown',           'GG-SEED-026', 'gown',            6290, 3900,  8),
      ('Champagne Flowy Gown',            'GG-SEED-027', 'gown',            5890, 3600,  6),
      ('Onyx Slit Gown',                  'GG-SEED-028', 'gown',            6790, 4200,  5),
      ('Rose Tulle Gown',                 'GG-SEED-029', 'gown',            5490, 3300,  9),
      ('Wine Velvet Gown',                'GG-SEED-030', 'gown',            7190, 4500,  4),
      ('Ivory Grecian Gown',              'GG-SEED-031', 'gown',            6090, 3750,  7),
      -- Three Piece (6) --------------------------------------------------------
      ('Lilac Embroidered Three-Piece',   'GG-SEED-032', 'three-piece',     4290, 2600, 14),
      ('Sky Blue Printed Three-Piece',    'GG-SEED-033', 'three-piece',     3690, 2200, 18),
      ('Coral Festive Three-Piece',       'GG-SEED-034', 'three-piece',     4590, 2800, 10),
      ('Mint Cotton Three-Piece',         'GG-SEED-035', 'three-piece',     3390, 1980, 22),
      ('Ruby Silk Three-Piece',           'GG-SEED-036', 'three-piece',     4990, 3050,  8),
      ('Sand Beige Three-Piece',          'GG-SEED-037', 'three-piece',     3890, 2300, 16),
      -- Western Dress (6) ------------------------------------------------------
      ('Scarlet Bodycon Dress',           'GG-SEED-038', 'western-dress',   2990, 1700, 20),
      ('Monochrome Shift Dress',          'GG-SEED-039', 'western-dress',   2790, 1550, 24),
      ('Floral Wrap Dress',               'GG-SEED-040', 'western-dress',   3190, 1850, 17),
      ('Denim Shirt Dress',               'GG-SEED-041', 'western-dress',   3390, 1980, 15),
      ('Emerald Midi Dress',              'GG-SEED-042', 'western-dress',   3490, 2050, 12),
      ('Blush Skater Dress',              'GG-SEED-043', 'western-dress',   2890, 1650, 19),
      -- Tops (5) ---------------------------------------------------------------
      ('Ivory Ruffle Top',                'GG-SEED-044', 'tops',            1290,  720, 35),
      ('Sage Linen Blouse',               'GG-SEED-045', 'tops',            1490,  850, 28),
      ('Coral Peplum Top',                'GG-SEED-046', 'tops',            1390,  800, 30),
      ('Classic White Shirt Top',         'GG-SEED-047', 'tops',            1590,  900, 26),
      ('Mustard Tie Top',                 'GG-SEED-048', 'tops',            1190,  680, 33),
      -- Party Wear (4) ---------------------------------------------------------
      ('Starlight Sequin Dress',          'GG-SEED-049', 'party-wear',      5990, 3700,  8),
      ('Golden Glam Gown',                'GG-SEED-050', 'party-wear',      6490, 4000,  6),
      ('Onyx Party Jumpsuit',             'GG-SEED-051', 'party-wear',      4290, 2600, 12),
      ('Rose Shimmer Dress',              'GG-SEED-052', 'party-wear',      4990, 3050,  9),
      -- Heels (4) --------------------------------------------------------------
      ('Nude Stiletto Heels',             'GG-SEED-053', 'heels',           2490, 1400, 18),
      ('Black Block Heels',               'GG-SEED-054', 'heels',           2290, 1300, 22),
      ('Blush Ankle-Strap Heels',         'GG-SEED-055', 'heels',           2690, 1550, 14),
      ('Wine Platform Heels',             'GG-SEED-056', 'heels',           2890, 1700, 10),
      -- Sandals (4) ------------------------------------------------------------
      ('Tan Braided Sandals',             'GG-SEED-057', 'sandals',         1690,  950, 26),
      ('White Slide Sandals',             'GG-SEED-058', 'sandals',         1490,  850, 30),
      ('Gold Kolhapuri Sandals',          'GG-SEED-059', 'sandals',         1890, 1080, 20),
      ('Beige Comfort Sandals',           'GG-SEED-060', 'sandals',         1590,  900, 24),
      -- Flats (3) --------------------------------------------------------------
      ('Ballet Blush Flats',              'GG-SEED-061', 'flats',           1390,  780, 28),
      ('Black Pointed Flats',             'GG-SEED-062', 'flats',           1490,  850, 25),
      ('Ivory Bow Flats',                 'GG-SEED-063', 'flats',           1290,  720, 30),
      -- Sneakers (3) -----------------------------------------------------------
      ('Cloud White Sneakers',            'GG-SEED-064', 'sneakers',        2790, 1600, 22),
      ('Blush Retro Sneakers',            'GG-SEED-065', 'sneakers',        2990, 1720, 16),
      ('Mono Canvas Sneakers',            'GG-SEED-066', 'sneakers',        2290, 1300, 26),
      -- Handbags (4) -----------------------------------------------------------
      ('Cognac Leather Handbag',          'GG-SEED-067', 'handbags',        3290, 1950, 14),
      ('Black Structured Handbag',        'GG-SEED-068', 'handbags',        3490, 2050, 12),
      ('Blush Pebbled Handbag',           'GG-SEED-069', 'handbags',        2990, 1750, 18),
      ('Ivory Top-Handle Handbag',        'GG-SEED-070', 'handbags',        3690, 2200,  9),
      -- Crossbody Bags (3) -----------------------------------------------------
      ('Tan Crossbody Bag',               'GG-SEED-071', 'crossbody-bags',  1990, 1150, 24),
      ('Quilted Black Crossbody',         'GG-SEED-072', 'crossbody-bags',  2290, 1350, 18),
      ('Coral Mini Crossbody',            'GG-SEED-073', 'crossbody-bags',  1790, 1020, 22),
      -- Clutches (3) -----------------------------------------------------------
      ('Gold Envelope Clutch',            'GG-SEED-074', 'clutches',        1690,  950, 20),
      ('Pearl Beaded Clutch',             'GG-SEED-075', 'clutches',        2190, 1280, 12),
      ('Onyx Satin Clutch',               'GG-SEED-076', 'clutches',        1590,  900, 16),
      -- Necklace (3) -----------------------------------------------------------
      ('Kundan Statement Necklace',       'GG-SEED-077', 'necklace',        1890, 1050, 20),
      ('Pearl Layered Necklace',          'GG-SEED-078', 'necklace',        1490,  820, 26),
      ('Gold Temple Necklace',            'GG-SEED-079', 'necklace',        2490, 1450, 12),
      -- Earrings (3) -----------------------------------------------------------
      ('Jhumka Gold Earrings',            'GG-SEED-080', 'earrings',         890,  480, 40),
      ('Crystal Drop Earrings',           'GG-SEED-081', 'earrings',         990,  540, 34),
      ('Pearl Stud Earrings',             'GG-SEED-082', 'earrings',         650,  340, 45),
      -- Jewellery Sets (2) -----------------------------------------------------
      ('Bridal Kundan Jewellery Set',     'GG-SEED-083', 'jewellery-sets',  3990, 2400,  8),
      ('Rose Gold Party Set',             'GG-SEED-084', 'jewellery-sets',  2990, 1750, 12),
      -- Lipstick (3) -----------------------------------------------------------
      ('Velvet Matte Lipstick Rosewood',  'GG-SEED-085', 'lipstick',         890,  420, 50),
      ('Satin Lipstick Coral Crush',      'GG-SEED-086', 'lipstick',         850,  400, 48),
      ('Liquid Lipstick Berry Wine',      'GG-SEED-087', 'lipstick',         990,  470, 42),
      -- Foundation (2) ---------------------------------------------------------
      ('Luminous Serum Foundation',       'GG-SEED-088', 'foundation',      1490,  780, 30),
      ('Matte Long-Wear Foundation',      'GG-SEED-089', 'foundation',      1390,  720, 33),
      -- Eye Makeup (2) ---------------------------------------------------------
      ('Smokey Eyeshadow Palette',        'GG-SEED-090', 'eye-makeup',      1690,  900, 26),
      ('Volume Mascara Noir',             'GG-SEED-091', 'eye-makeup',       790,  400, 44),
      -- Face Cream (2) ---------------------------------------------------------
      ('Hydra Glow Day Cream',            'GG-SEED-092', 'face-cream',      1190,  620, 36),
      ('Night Repair Cream',              'GG-SEED-093', 'face-cream',      1390,  720, 30),
      -- Serum (2) --------------------------------------------------------------
      ('Vitamin C Brightening Serum',     'GG-SEED-094', 'serum',           1590,  820, 34),
      ('Hyaluronic Hydra Serum',          'GG-SEED-095', 'serum',           1490,  760, 32),
      -- Sunscreen (2) ----------------------------------------------------------
      ('Daily Defense SPF 50',            'GG-SEED-096', 'sunscreen',        990,  500, 40),
      ('Matte Finish Sunscreen SPF 40',   'GG-SEED-097', 'sunscreen',       1090,  560, 36),
      -- Hair (3) ---------------------------------------------------------------
      ('Silk Repair Shampoo',             'GG-SEED-098', 'shampoo',          790,  400, 42),
      ('Nourish Argan Hair Oil',          'GG-SEED-099', 'hair-oil',         890,  460, 38),
      ('Smooth Silk Conditioner',         'GG-SEED-100', 'conditioner',      750,  380, 40)
    ) AS t(name, sku, sub_slug, price, cost, stock)
  LOOP
    -- Resolve subcategory + parent category by slug (skip if missing).
    SELECT s.id, s.category_id
      INTO v_sub, v_cat
    FROM public.subcategories s
    WHERE s.organization_id = v_org
      AND s.slug = rec.sub_slug
      AND s.deleted_at IS NULL
    LIMIT 1;

    IF v_sub IS NULL THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE 'Subcategory "%" not found — skipping %', rec.sub_slug, rec.sku;
      CONTINUE;
    END IF;

    -- Deterministic brand + image assignment (spread to avoid consecutive repeats).
    SELECT id INTO v_brand_id
    FROM public.brands
    WHERE organization_id = v_org
      AND lower(name) = lower(v_brands[(v_idx % array_length(v_brands, 1)) + 1])
      AND deleted_at IS NULL
    LIMIT 1;

    v_cover   := v_paths[((v_idx * 3) % v_img_count) + 1];
    v_gallery := v_paths[((v_idx * 3 + 4) % v_img_count) + 1];

    -- Upsert product by base_sku.
    SELECT id INTO v_product
    FROM public.products
    WHERE organization_id = v_org AND base_sku = rec.sku AND deleted_at IS NULL
    LIMIT 1;

    IF v_product IS NULL THEN
      INSERT INTO public.products (
        organization_id, category_id, subcategory_id, brand_id,
        name, description, product_type, unit, base_sku,
        purchase_price, selling_price, is_active, track_inventory, has_variants,
        published_at
      ) VALUES (
        v_org, v_cat, v_sub, v_brand_id,
        rec.name,
        rec.name || ' — premium fashion piece, thoughtfully crafted for the modern '
          || 'wardrobe with nationwide cash-on-delivery.',
        'simple', 'pcs', rec.sku,
        rec.cost, rec.price, true, true, false,
        timezone('utc', now())
      )
      RETURNING id INTO v_product;
      v_created := v_created + 1;
    ELSE
      UPDATE public.products
      SET category_id = v_cat,
          subcategory_id = v_sub,
          brand_id = v_brand_id,
          name = rec.name,
          purchase_price = rec.cost,
          selling_price = rec.price,
          is_active = true,
          published_at = COALESCE(published_at, timezone('utc', now())),
          updated_at = timezone('utc', now())
      WHERE id = v_product;
      v_updated := v_updated + 1;
    END IF;

    -- Ensure one active default variant (storefront stock derives from variants).
    SELECT id INTO v_variant
    FROM public.product_variants
    WHERE organization_id = v_org AND sku = rec.sku || '-V' AND deleted_at IS NULL
    LIMIT 1;

    IF v_variant IS NULL THEN
      INSERT INTO public.product_variants (
        organization_id, product_id, sku, name,
        purchase_price, selling_price, image_path, is_active
      ) VALUES (
        v_org, v_product, rec.sku || '-V', NULL,
        rec.cost, rec.price, v_cover, true
      )
      RETURNING id INTO v_variant;
    ELSE
      UPDATE public.product_variants
      SET product_id = v_product,
          purchase_price = rec.cost,
          selling_price = rec.price,
          image_path = v_cover,
          is_active = true,
          updated_at = timezone('utc', now())
      WHERE id = v_variant;
    END IF;

    -- Inventory balance (>= 0). Only when a stock location is available.
    IF v_location IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.inventory_balances
        WHERE variant_id = v_variant AND location_id = v_location AND deleted_at IS NULL
      ) THEN
        UPDATE public.inventory_balances
        SET quantity = rec.stock, updated_at = timezone('utc', now())
        WHERE variant_id = v_variant AND location_id = v_location AND deleted_at IS NULL;
      ELSE
        INSERT INTO public.inventory_balances (organization_id, variant_id, location_id, quantity)
        VALUES (v_org, v_variant, v_location, rec.stock);
      END IF;
    END IF;

    -- Cover image (exactly one active product-level cover).
    SELECT id INTO v_cover_id
    FROM public.product_images
    WHERE product_id = v_product AND variant_id IS NULL AND deleted_at IS NULL
    ORDER BY is_cover DESC, sort_order, created_at
    LIMIT 1;

    IF v_cover_id IS NULL THEN
      INSERT INTO public.product_images (
        organization_id, product_id, variant_id, storage_path, is_cover, sort_order, metadata
      ) VALUES (
        v_org, v_product, NULL, v_cover, true, 0, jsonb_build_object('seed', 'gg-demo-catalog-v1')
      );
    ELSE
      UPDATE public.product_images
      SET storage_path = v_cover, is_cover = true, sort_order = 0,
          metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('seed', 'gg-demo-catalog-v1'),
          updated_at = timezone('utc', now())
      WHERE id = v_cover_id;
    END IF;

    -- One gallery image (non-cover) using a different file from the pool.
    IF NOT EXISTS (
      SELECT 1 FROM public.product_images
      WHERE product_id = v_product AND variant_id IS NULL AND deleted_at IS NULL AND sort_order = 1
    ) THEN
      INSERT INTO public.product_images (
        organization_id, product_id, variant_id, storage_path, is_cover, sort_order, metadata
      ) VALUES (
        v_org, v_product, NULL, v_gallery, false, 1, jsonb_build_object('seed', 'gg-demo-catalog-v1')
      );
    END IF;

    v_idx := v_idx + 1;
  END LOOP;

  RAISE NOTICE 'gg-demo-catalog-v1: created=%, updated=%, skipped=%, seed_total=%',
    v_created, v_updated, v_skipped,
    (SELECT count(*) FROM public.products
      WHERE organization_id = v_org AND base_sku LIKE 'GG-SEED-%' AND deleted_at IS NULL);
END;
$seed$;
