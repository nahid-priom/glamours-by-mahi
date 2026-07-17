export const HERO_CTA_TYPES = [
  'none',
  'all_products',
  'category',
  'subcategory',
  'brand',
  'new_arrivals',
  'best_sellers',
  'featured',
  'on_sale',
  'custom_filter',
  'product',
  'custom_url',
] as const

export type HeroCtaType = (typeof HERO_CTA_TYPES)[number]

export const HERO_CTA_TYPE_LABELS: Record<HeroCtaType, string> = {
  none: 'No Link',
  all_products: 'All Products',
  category: 'Category',
  subcategory: 'Subcategory',
  brand: 'Brand',
  new_arrivals: 'New Arrivals',
  best_sellers: 'Best Sellers',
  featured: 'Featured Products',
  on_sale: 'Discounted Products',
  custom_filter: 'Custom Filter',
  product: 'Specific Product',
  custom_url: 'Custom URL',
}

export const HERO_STATUSES = ['draft', 'active', 'inactive', 'archived'] as const
export type HeroSlideStatus = (typeof HERO_STATUSES)[number]

export const HERO_LAYOUTS = ['content_left', 'content_right'] as const
export type HeroLayoutDirection = (typeof HERO_LAYOUTS)[number]

export const HERO_THEMES = ['soft_pink', 'deep_pink', 'light', 'dark'] as const
export type HeroThemeVariant = (typeof HERO_THEMES)[number]

export const HERO_OBJECT_POSITIONS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'custom',
] as const
export type HeroObjectPosition = (typeof HERO_OBJECT_POSITIONS)[number]

export interface HeroCtaConfig {
  category?: string
  subcategory?: string
  brand?: string
  brandId?: string
  productSlug?: string
  sort?: string
  minPrice?: number
  maxPrice?: number
  onSale?: boolean
  style?: string
  search?: string
  customUrl?: string
}

export interface HeroFloatingBadge {
  label: string
  tone?: 'primary' | 'soft' | 'ink'
}

export interface HeroSlideRow {
  id: string
  organization_id: string
  internal_name: string
  eyebrow: string | null
  heading: string
  highlight_text: string | null
  description: string | null
  offer_title: string | null
  offer_subtitle: string | null
  discount_text: string | null
  coupon_code: string | null
  primary_cta_label: string
  primary_cta_type: HeroCtaType
  primary_cta_config: HeroCtaConfig
  primary_cta_url: string | null
  primary_cta_new_tab: boolean
  secondary_cta_enabled: boolean
  secondary_cta_label: string | null
  secondary_cta_type: HeroCtaType | null
  secondary_cta_config: HeroCtaConfig
  secondary_cta_url: string | null
  secondary_cta_new_tab: boolean
  desktop_image_path: string
  tablet_image_path: string | null
  mobile_image_path: string | null
  image_alt: string | null
  image_focal_x: number | null
  image_focal_y: number | null
  image_object_position: string
  overlay_opacity: number
  layout_direction: HeroLayoutDirection
  text_alignment: 'left' | 'center' | 'right'
  theme_variant: HeroThemeVariant
  show_trust_points: boolean
  show_floating_badges: boolean
  show_trending_products: boolean
  trust_points: string[]
  floating_badges: HeroFloatingBadge[]
  status: HeroSlideStatus
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  created_by: string | null
  updated_by: string | null
}

/** Public-safe slide returned by get_active_hero_slides */
export interface PublicHeroSlide {
  id: string
  eyebrow: string | null
  heading: string
  highlight_text: string | null
  description: string | null
  offer_title: string | null
  offer_subtitle: string | null
  discount_text: string | null
  coupon_code: string | null
  primary_cta_label: string
  primary_cta_type: HeroCtaType
  primary_cta_config: HeroCtaConfig
  primary_cta_url: string | null
  primary_cta_new_tab: boolean
  secondary_cta_enabled: boolean
  secondary_cta_label: string | null
  secondary_cta_type: HeroCtaType | null
  secondary_cta_config: HeroCtaConfig
  secondary_cta_url: string | null
  secondary_cta_new_tab: boolean
  desktop_image_path: string
  tablet_image_path: string | null
  mobile_image_path: string | null
  image_alt: string | null
  image_focal_x: number | null
  image_focal_y: number | null
  image_object_position: string
  overlay_opacity: number
  layout_direction: HeroLayoutDirection
  text_alignment: 'left' | 'center' | 'right'
  theme_variant: HeroThemeVariant
  show_trust_points: boolean
  show_floating_badges: boolean
  show_trending_products: boolean
  trust_points: string[]
  floating_badges: HeroFloatingBadge[]
  sort_order: number
  created_at: string
  desktop_image_url?: string | null
  tablet_image_url?: string | null
  mobile_image_url?: string | null
}

export interface HeroSlideKpis {
  total: number
  active: number
  scheduled: number
  inactive: number
}
