import { z } from 'zod'
import { HERO_CTA_TYPES, HERO_LAYOUTS, HERO_OBJECT_POSITIONS, HERO_STATUSES, HERO_THEMES } from '../types/hero.types'

export const heroCtaConfigSchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  brandId: z.string().optional(),
  productSlug: z.string().optional(),
  sort: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  onSale: z.boolean().optional(),
  style: z.string().optional(),
  search: z.string().optional(),
  customUrl: z.string().optional(),
})

export const heroFloatingBadgeSchema = z.object({
  label: z.string().min(1).max(40),
  tone: z.enum(['primary', 'soft', 'ink']).optional(),
})

export const heroSlideFormSchema = z.object({
  internal_name: z.string().min(2, 'Internal name is required').max(120),
  eyebrow: z.string().max(80).optional(),
  heading: z.string().min(2, 'Heading is required').max(120),
  highlight_text: z.string().max(80).optional(),
  description: z.string().max(500).optional(),
  offer_title: z.string().max(80).optional(),
  offer_subtitle: z.string().max(120).optional(),
  discount_text: z.string().max(80).optional(),
  coupon_code: z.string().max(40).optional(),

  primary_cta_label: z.string().min(1, 'Primary CTA label required').max(40),
  primary_cta_type: z.enum(HERO_CTA_TYPES),
  primary_cta_config: heroCtaConfigSchema,
  primary_cta_new_tab: z.boolean(),

  secondary_cta_enabled: z.boolean(),
  secondary_cta_label: z.string().max(40).optional(),
  secondary_cta_type: z.enum(HERO_CTA_TYPES).nullable().optional(),
  secondary_cta_config: heroCtaConfigSchema,
  secondary_cta_new_tab: z.boolean(),

  desktop_image_path: z.string().optional(),
  mobile_image_path: z.string().nullable().optional(),
  image_alt: z.string().max(160).optional(),
  image_focal_x: z.coerce.number().min(0).max(100).nullable().optional(),
  image_focal_y: z.coerce.number().min(0).max(100).nullable().optional(),
  image_object_position: z.enum(HERO_OBJECT_POSITIONS),
  overlay_opacity: z.coerce.number().min(0).max(1),

  layout_direction: z.enum(HERO_LAYOUTS),
  text_alignment: z.enum(['left', 'center', 'right']),
  theme_variant: z.enum(HERO_THEMES),
  show_trust_points: z.boolean(),
  show_floating_badges: z.boolean(),
  show_trending_products: z.boolean(),

  trust_points: z.array(z.string().max(60)).max(3),
  floating_badges: z.array(heroFloatingBadgeSchema).max(3),

  status: z.enum(HERO_STATUSES),
  sort_order: z.coerce.number().int().min(0),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
})

export type HeroSlideFormValues = z.infer<typeof heroSlideFormSchema>
