-- Website hero carousel: table, RLS, RPC, storage, permissions, seed

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('website.read', 'View website settings'),
  ('website.manage', 'Manage website settings'),
  ('website.hero.read', 'View hero carousel slides'),
  ('website.hero.create', 'Create hero carousel slides'),
  ('website.hero.update', 'Update hero carousel slides'),
  ('website.hero.publish', 'Publish hero carousel slides'),
  ('website.hero.delete', 'Archive/delete hero carousel slides')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = v.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Super Admin')
  AND r.deleted_at IS NULL
  AND p.key IN (
    'website.read', 'website.manage',
    'website.hero.read', 'website.hero.create', 'website.hero.update',
    'website.hero.publish', 'website.hero.delete'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Table
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.website_hero_slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),

  internal_name text NOT NULL,
  eyebrow text,
  heading text NOT NULL,
  highlight_text text,
  description text,

  offer_title text,
  offer_subtitle text,
  discount_text text,
  coupon_code text,

  primary_cta_label text NOT NULL DEFAULT 'Shop Now',
  primary_cta_type text NOT NULL DEFAULT 'all_products',
  primary_cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  primary_cta_url text,
  primary_cta_new_tab boolean NOT NULL DEFAULT false,

  secondary_cta_enabled boolean NOT NULL DEFAULT false,
  secondary_cta_label text,
  secondary_cta_type text,
  secondary_cta_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  secondary_cta_url text,
  secondary_cta_new_tab boolean NOT NULL DEFAULT false,

  desktop_image_path text NOT NULL DEFAULT '',
  mobile_image_path text,
  image_alt text,
  image_focal_x numeric,
  image_focal_y numeric,
  image_object_position text NOT NULL DEFAULT 'center',
  overlay_opacity numeric NOT NULL DEFAULT 0,

  layout_direction text NOT NULL DEFAULT 'content_left',
  text_alignment text NOT NULL DEFAULT 'left',
  theme_variant text NOT NULL DEFAULT 'soft_pink',
  show_trust_points boolean NOT NULL DEFAULT true,
  show_floating_badges boolean NOT NULL DEFAULT true,
  show_trending_products boolean NOT NULL DEFAULT false,

  trust_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  floating_badges jsonb NOT NULL DEFAULT '[]'::jsonb,

  status text NOT NULL DEFAULT 'draft',
  sort_order integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),

  CONSTRAINT website_hero_slides_status_check
    CHECK (status IN ('draft', 'active', 'inactive', 'archived')),
  CONSTRAINT website_hero_slides_layout_check
    CHECK (layout_direction IN ('content_left', 'content_right')),
  CONSTRAINT website_hero_slides_text_align_check
    CHECK (text_alignment IN ('left', 'center', 'right')),
  CONSTRAINT website_hero_slides_theme_check
    CHECK (theme_variant IN ('soft_pink', 'deep_pink', 'light', 'dark')),
  CONSTRAINT website_hero_slides_primary_cta_type_check
    CHECK (primary_cta_type IN (
      'all_products', 'category', 'subcategory', 'brand',
      'new_arrivals', 'best_sellers', 'featured', 'on_sale',
      'custom_filter', 'product', 'custom_url'
    )),
  CONSTRAINT website_hero_slides_overlay_check
    CHECK (overlay_opacity >= 0 AND overlay_opacity <= 1)
);

CREATE INDEX IF NOT EXISTS website_hero_slides_org_sort_idx
  ON public.website_hero_slides (organization_id, sort_order ASC, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS website_hero_slides_org_status_idx
  ON public.website_hero_slides (organization_id, status)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS website_hero_slides_set_updated_at ON public.website_hero_slides;
CREATE TRIGGER website_hero_slides_set_updated_at
  BEFORE UPDATE ON public.website_hero_slides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.website_hero_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS website_hero_slides_select_admin ON public.website_hero_slides;
CREATE POLICY website_hero_slides_select_admin ON public.website_hero_slides
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('website.hero.read')
      OR public.user_has_permission('website.read')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS website_hero_slides_insert_admin ON public.website_hero_slides;
CREATE POLICY website_hero_slides_insert_admin ON public.website_hero_slides
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('website.hero.create')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS website_hero_slides_update_admin ON public.website_hero_slides;
CREATE POLICY website_hero_slides_update_admin ON public.website_hero_slides
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('website.hero.update')
      OR public.user_has_permission('website.hero.publish')
      OR public.user_has_permission('website.hero.delete')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

--------------------------------------------------------------------------------
-- Public RPC (safe fields only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_active_hero_slides(p_organization_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE slug = p_organization_slug
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(s) ORDER BY s.sort_order ASC, s.created_at DESC),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT
      id,
      eyebrow,
      heading,
      highlight_text,
      description,
      offer_title,
      offer_subtitle,
      discount_text,
      coupon_code,
      primary_cta_label,
      primary_cta_type,
      primary_cta_config,
      primary_cta_url,
      primary_cta_new_tab,
      secondary_cta_enabled,
      secondary_cta_label,
      secondary_cta_type,
      secondary_cta_config,
      secondary_cta_url,
      secondary_cta_new_tab,
      desktop_image_path,
      mobile_image_path,
      image_alt,
      image_focal_x,
      image_focal_y,
      image_object_position,
      overlay_opacity,
      layout_direction,
      text_alignment,
      theme_variant,
      show_trust_points,
      show_floating_badges,
      show_trending_products,
      trust_points,
      floating_badges,
      sort_order,
      created_at
    FROM public.website_hero_slides
    WHERE organization_id = v_org_id
      AND deleted_at IS NULL
      AND status = 'active'
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at >= now())
  ) s;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_hero_slides(text) TO anon, authenticated;

--------------------------------------------------------------------------------
-- Storage bucket website-media
--------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'website-media',
  'website-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS website_media_select_public ON storage.objects;
CREATE POLICY website_media_select_public ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'website-media');

DROP POLICY IF EXISTS website_media_insert_admin ON storage.objects;
CREATE POLICY website_media_insert_admin ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'website-media'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
    AND (
      public.user_has_permission('website.hero.create')
      OR public.user_has_permission('website.hero.update')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS website_media_update_admin ON storage.objects;
CREATE POLICY website_media_update_admin ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'website-media'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
    AND (
      public.user_has_permission('website.hero.update')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS website_media_delete_admin ON storage.objects;
CREATE POLICY website_media_delete_admin ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'website-media'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
    AND (
      public.user_has_permission('website.hero.update')
      OR public.user_has_permission('website.hero.delete')
      OR public.user_has_permission('website.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

--------------------------------------------------------------------------------
-- Seed 3 slides for glamourous-by-mahi (content only; images uploaded in admin)
--------------------------------------------------------------------------------
INSERT INTO public.website_hero_slides (
  organization_id,
  internal_name,
  eyebrow,
  heading,
  highlight_text,
  description,
  offer_title,
  offer_subtitle,
  discount_text,
  coupon_code,
  primary_cta_label,
  primary_cta_type,
  primary_cta_config,
  primary_cta_url,
  secondary_cta_enabled,
  secondary_cta_label,
  secondary_cta_type,
  secondary_cta_config,
  secondary_cta_url,
  desktop_image_path,
  mobile_image_path,
  image_alt,
  layout_direction,
  trust_points,
  floating_badges,
  status,
  sort_order
)
SELECT
  o.id,
  v.internal_name,
  v.eyebrow,
  v.heading,
  v.highlight_text,
  v.description,
  v.offer_title,
  v.offer_subtitle,
  v.discount_text,
  v.coupon_code,
  v.primary_cta_label,
  v.primary_cta_type,
  v.primary_cta_config::jsonb,
  v.primary_cta_url,
  v.secondary_cta_enabled,
  v.secondary_cta_label,
  v.secondary_cta_type,
  v.secondary_cta_config::jsonb,
  v.secondary_cta_url,
  '',
  NULL,
  v.image_alt,
  v.layout_direction,
  v.trust_points::jsonb,
  v.floating_badges::jsonb,
  'active',
  v.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  (
    'Festive Dress Collection',
    'Occasion Ready',
    'Festive Edit',
    'Dresses',
    'Statement dresses, soft glam makeup and finishing accessories for your next celebration.',
    'Festive Special',
    'Curated occasion wear',
    'Up to 30% Off',
    'FESTIVE30',
    'Shop Now',
    'category',
    '{"category":"dress"}',
    '/shop?category=dress',
    true,
    'Explore New Arrivals',
    'new_arrivals',
    '{}',
    '/shop?sort=newest',
    'Festive dress collection campaign',
    'content_left',
    '["Authentic products","Cash on delivery","Nationwide shipping"]',
    '[{"label":"Festive","tone":"primary"}]',
    0
  ),
  (
    'Beauty and Makeup Offers',
    'Glow Edit',
    'Beauty Essentials',
    'Makeup',
    'Authentic cosmetics and everyday glam picks for modern beauty routines.',
    'Beauty Week',
    'Soft glam favourites',
    'Special Offers',
    NULL,
    'Shop Beauty',
    'all_products',
    '{}',
    '/shop',
    true,
    'View Offers',
    'on_sale',
    '{}',
    '/shop?onSale=true',
    'Beauty and makeup offers campaign',
    'content_right',
    '["Authentic products","Secure checkout","Easy returns"]',
    '[{"label":"Beauty","tone":"soft"}]',
    1
  ),
  (
    'New Accessories Arrival',
    'Just Dropped',
    'New Accessories',
    'Arrival',
    'Fresh bags, jewellery and finishing pieces to complete every outfit.',
    'New Drop',
    'Weekly curated edit',
    'New Arrivals',
    NULL,
    'Shop Accessories',
    'category',
    '{"category":"accessories"}',
    '/shop?category=accessories',
    true,
    'Browse All',
    'all_products',
    '{}',
    '/shop',
    'New accessories arrival campaign',
    'content_left',
    '["Free delivery over ৳3,000","Easy exchange","Order tracking"]',
    '[{"label":"New","tone":"ink"}]',
    2
  )
) AS v(
  internal_name, eyebrow, heading, highlight_text, description,
  offer_title, offer_subtitle, discount_text, coupon_code,
  primary_cta_label, primary_cta_type, primary_cta_config, primary_cta_url,
  secondary_cta_enabled, secondary_cta_label, secondary_cta_type, secondary_cta_config, secondary_cta_url,
  image_alt, layout_direction, trust_points, floating_badges, sort_order
)
WHERE o.slug = 'glamourous-by-mahi'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.website_hero_slides s
    WHERE s.organization_id = o.id
      AND s.internal_name = v.internal_name
      AND s.deleted_at IS NULL
  );
