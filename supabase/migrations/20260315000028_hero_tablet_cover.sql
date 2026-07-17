-- Hero banner refactor: optional tablet cover version + expose it in the public RPC

ALTER TABLE public.website_hero_slides
  ADD COLUMN IF NOT EXISTS tablet_image_path text;

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
      tablet_image_path,
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
