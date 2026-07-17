import { supabase } from '@/lib/supabase/client'
import { STOREFRONT_ORG_SLUG } from '@/config/catalog'
import type {
  HeroCtaConfig,
  HeroFloatingBadge,
  HeroSlideKpis,
  HeroSlideRow,
  PublicHeroSlide,
} from '../types/hero.types'
import type { HeroSlideFormValues } from '../schemas/hero.schema'
import { buildHeroCtaUrl } from '../services/hero-link-builder.service'

const BUCKET = 'website-media'

/** Untyped client until website_hero_slides is in generated Database types */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

type RawSlide = Record<string, unknown>

function asConfig(value: unknown): HeroCtaConfig {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as HeroCtaConfig
  }
  return {}
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asBadges(value: unknown): HeroFloatingBadge[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((v): v is HeroFloatingBadge => Boolean(v && typeof v === 'object' && 'label' in v))
    .map((v) => ({ label: String(v.label), tone: v.tone }))
}

function mapRow(row: RawSlide): HeroSlideRow {
  return {
    id: String(row.id),
    organization_id: String(row.organization_id),
    internal_name: String(row.internal_name),
    eyebrow: (row.eyebrow as string | null) ?? null,
    heading: String(row.heading),
    highlight_text: (row.highlight_text as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    offer_title: (row.offer_title as string | null) ?? null,
    offer_subtitle: (row.offer_subtitle as string | null) ?? null,
    discount_text: (row.discount_text as string | null) ?? null,
    coupon_code: (row.coupon_code as string | null) ?? null,
    primary_cta_label: String(row.primary_cta_label ?? 'Shop Now'),
    primary_cta_type: (row.primary_cta_type as HeroSlideRow['primary_cta_type']) ?? 'all_products',
    primary_cta_config: asConfig(row.primary_cta_config),
    primary_cta_url: (row.primary_cta_url as string | null) ?? null,
    primary_cta_new_tab: Boolean(row.primary_cta_new_tab),
    secondary_cta_enabled: Boolean(row.secondary_cta_enabled),
    secondary_cta_label: (row.secondary_cta_label as string | null) ?? null,
    secondary_cta_type: (row.secondary_cta_type as HeroSlideRow['secondary_cta_type']) ?? null,
    secondary_cta_config: asConfig(row.secondary_cta_config),
    secondary_cta_url: (row.secondary_cta_url as string | null) ?? null,
    secondary_cta_new_tab: Boolean(row.secondary_cta_new_tab),
    desktop_image_path: String(row.desktop_image_path ?? ''),
    tablet_image_path: (row.tablet_image_path as string | null) ?? null,
    mobile_image_path: (row.mobile_image_path as string | null) ?? null,
    image_alt: (row.image_alt as string | null) ?? null,
    image_focal_x: row.image_focal_x == null ? null : Number(row.image_focal_x),
    image_focal_y: row.image_focal_y == null ? null : Number(row.image_focal_y),
    image_object_position: String(row.image_object_position ?? 'center'),
    overlay_opacity: Number(row.overlay_opacity ?? 0),
    layout_direction: (row.layout_direction as HeroSlideRow['layout_direction']) ?? 'content_left',
    text_alignment: (row.text_alignment as HeroSlideRow['text_alignment']) ?? 'left',
    theme_variant: (row.theme_variant as HeroSlideRow['theme_variant']) ?? 'soft_pink',
    show_trust_points: row.show_trust_points !== false,
    show_floating_badges: row.show_floating_badges !== false,
    show_trending_products: Boolean(row.show_trending_products),
    trust_points: asStringArray(row.trust_points),
    floating_badges: asBadges(row.floating_badges),
    status: (row.status as HeroSlideRow['status']) ?? 'draft',
    sort_order: Number(row.sort_order ?? 0),
    starts_at: (row.starts_at as string | null) ?? null,
    ends_at: (row.ends_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    deleted_at: (row.deleted_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    updated_by: (row.updated_by as string | null) ?? null,
  }
}

function mapPublic(row: RawSlide): PublicHeroSlide {
  const mapped = mapRow({ ...row, organization_id: row.organization_id ?? '' })
  return {
    id: mapped.id,
    eyebrow: mapped.eyebrow,
    heading: mapped.heading,
    highlight_text: mapped.highlight_text,
    description: mapped.description,
    offer_title: mapped.offer_title,
    offer_subtitle: mapped.offer_subtitle,
    discount_text: mapped.discount_text,
    coupon_code: mapped.coupon_code,
    primary_cta_label: mapped.primary_cta_label,
    primary_cta_type: mapped.primary_cta_type,
    primary_cta_config: mapped.primary_cta_config,
    primary_cta_url: mapped.primary_cta_url,
    primary_cta_new_tab: mapped.primary_cta_new_tab,
    secondary_cta_enabled: mapped.secondary_cta_enabled,
    secondary_cta_label: mapped.secondary_cta_label,
    secondary_cta_type: mapped.secondary_cta_type,
    secondary_cta_config: mapped.secondary_cta_config,
    secondary_cta_url: mapped.secondary_cta_url,
    secondary_cta_new_tab: mapped.secondary_cta_new_tab,
    desktop_image_path: mapped.desktop_image_path,
    tablet_image_path: mapped.tablet_image_path,
    mobile_image_path: mapped.mobile_image_path,
    image_alt: mapped.image_alt,
    image_focal_x: mapped.image_focal_x,
    image_focal_y: mapped.image_focal_y,
    image_object_position: mapped.image_object_position,
    overlay_opacity: mapped.overlay_opacity,
    layout_direction: mapped.layout_direction,
    text_alignment: mapped.text_alignment,
    theme_variant: mapped.theme_variant,
    show_trust_points: mapped.show_trust_points,
    show_floating_badges: mapped.show_floating_badges,
    show_trending_products: mapped.show_trending_products,
    trust_points: mapped.trust_points,
    floating_badges: mapped.floating_badges,
    sort_order: mapped.sort_order,
    created_at: mapped.created_at,
  }
}

export function resolveWebsiteMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
    return path
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl || null
}

function emptyToNull(value?: string | null) {
  const v = value?.trim()
  return v ? v : null
}

function formToPayload(orgId: string, values: HeroSlideFormValues, userId?: string) {
  const primaryUrl = emptyToNull(
    buildHeroCtaUrl(values.primary_cta_type, values.primary_cta_config ?? {}),
  )
  const secondaryType = values.secondary_cta_type ?? 'all_products'
  const secondaryUrl = values.secondary_cta_enabled
    ? emptyToNull(buildHeroCtaUrl(secondaryType, values.secondary_cta_config ?? {}))
    : null

  const heading = values.heading?.trim() || values.internal_name.trim()

  return {
    organization_id: orgId,
    internal_name: values.internal_name.trim(),
    eyebrow: emptyToNull(values.eyebrow),
    heading,
    highlight_text: emptyToNull(values.highlight_text),
    description: emptyToNull(values.description),
    offer_title: emptyToNull(values.offer_title),
    offer_subtitle: emptyToNull(values.offer_subtitle),
    discount_text: emptyToNull(values.discount_text),
    coupon_code: emptyToNull(values.coupon_code),
    primary_cta_label: values.primary_cta_label?.trim() || 'Shop Now',
    primary_cta_type: values.primary_cta_type,
    primary_cta_config: values.primary_cta_config ?? {},
    primary_cta_url: primaryUrl,
    primary_cta_new_tab: values.primary_cta_new_tab,
    secondary_cta_enabled: values.secondary_cta_enabled,
    secondary_cta_label: emptyToNull(values.secondary_cta_label),
    secondary_cta_type: values.secondary_cta_enabled ? secondaryType : null,
    secondary_cta_config: values.secondary_cta_config ?? {},
    secondary_cta_url: secondaryUrl,
    secondary_cta_new_tab: values.secondary_cta_new_tab,
    desktop_image_path: values.desktop_image_path?.trim() ?? '',
    tablet_image_path: emptyToNull(values.tablet_image_path),
    mobile_image_path: emptyToNull(values.mobile_image_path),
    image_alt: emptyToNull(values.image_alt) ?? heading,
    image_focal_x: values.image_focal_x ?? null,
    image_focal_y: values.image_focal_y ?? null,
    image_object_position: values.image_object_position,
    overlay_opacity: values.overlay_opacity ?? 0,
    layout_direction: values.layout_direction,
    text_alignment: values.text_alignment,
    theme_variant: values.theme_variant,
    show_trust_points: values.show_trust_points,
    show_floating_badges: values.show_floating_badges,
    show_trending_products: values.show_trending_products,
    trust_points: (values.trust_points ?? []).filter(Boolean).slice(0, 3),
    floating_badges: (values.floating_badges ?? []).slice(0, 3),
    status: values.status,
    sort_order: values.sort_order ?? 0,
    starts_at: emptyToNull(values.starts_at),
    ends_at: emptyToNull(values.ends_at),
    updated_by: userId ?? null,
  }
}

async function requireOrgId(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  if (!profile?.organization_id) throw new Error('Organization not found')
  return profile.organization_id
}

export async function listHeroSlides(): Promise<HeroSlideRow[]> {
  const orgId = await requireOrgId()
  const { data, error } = await db
    .from('website_hero_slides')
    .select('*')
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data as RawSlide[]) ?? []).map(mapRow)
}

export async function getHeroSlide(id: string): Promise<HeroSlideRow | null> {
  const { data, error } = await db
    .from('website_hero_slides')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data ? mapRow(data as RawSlide) : null
}

export async function createHeroSlide(values: HeroSlideFormValues): Promise<HeroSlideRow> {
  const orgId = await requireOrgId()
  const { data: auth } = await supabase.auth.getUser()
  const payload = {
    ...formToPayload(orgId, values, auth.user?.id),
    created_by: auth.user?.id ?? null,
  }

  const { data, error } = await db.from('website_hero_slides').insert(payload).select('*').single()
  if (error) throw error
  return mapRow(data as RawSlide)
}

export async function updateHeroSlide(id: string, values: HeroSlideFormValues): Promise<HeroSlideRow> {
  const orgId = await requireOrgId()
  const { data: auth } = await supabase.auth.getUser()
  const payload = formToPayload(orgId, values, auth.user?.id)

  const { data, error } = await db
    .from('website_hero_slides')
    .update(payload)
    .eq('id', id)
    .eq('organization_id', orgId)
    .select('*')
    .single()

  if (error) throw error
  return mapRow(data as RawSlide)
}

export async function setHeroSlideStatus(id: string, status: HeroSlideRow['status']): Promise<void> {
  const orgId = await requireOrgId()
  const { error } = await db
    .from('website_hero_slides')
    .update({ status })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw error
}

export async function archiveHeroSlide(id: string): Promise<void> {
  const orgId = await requireOrgId()
  const { error } = await db
    .from('website_hero_slides')
    .update({ status: 'archived', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw error
}

export async function restoreHeroSlide(id: string): Promise<void> {
  const orgId = await requireOrgId()
  const { error } = await db
    .from('website_hero_slides')
    .update({ status: 'draft', deleted_at: null })
    .eq('id', id)
    .eq('organization_id', orgId)
  if (error) throw error
}

export async function duplicateHeroSlide(id: string): Promise<HeroSlideRow> {
  const slide = await getHeroSlide(id)
  if (!slide) throw new Error('Slide not found')

  return createHeroSlide({
    internal_name: `${slide.internal_name} (Copy)`,
    eyebrow: slide.eyebrow ?? '',
    heading: slide.heading,
    highlight_text: slide.highlight_text ?? '',
    description: slide.description ?? '',
    offer_title: slide.offer_title ?? '',
    offer_subtitle: slide.offer_subtitle ?? '',
    discount_text: slide.discount_text ?? '',
    coupon_code: slide.coupon_code ?? '',
    primary_cta_label: slide.primary_cta_label,
    primary_cta_type: slide.primary_cta_type,
    primary_cta_config: slide.primary_cta_config,
    primary_cta_new_tab: slide.primary_cta_new_tab,
    secondary_cta_enabled: slide.secondary_cta_enabled,
    secondary_cta_label: slide.secondary_cta_label ?? '',
    secondary_cta_type: slide.secondary_cta_type,
    secondary_cta_config: slide.secondary_cta_config,
    secondary_cta_new_tab: slide.secondary_cta_new_tab,
    desktop_image_path: slide.desktop_image_path,
    tablet_image_path: slide.tablet_image_path,
    mobile_image_path: slide.mobile_image_path,
    image_alt: slide.image_alt ?? '',
    image_focal_x: slide.image_focal_x,
    image_focal_y: slide.image_focal_y,
    image_object_position: slide.image_object_position as HeroSlideFormValues['image_object_position'],
    overlay_opacity: slide.overlay_opacity,
    layout_direction: slide.layout_direction,
    text_alignment: slide.text_alignment,
    theme_variant: slide.theme_variant,
    show_trust_points: slide.show_trust_points,
    show_floating_badges: slide.show_floating_badges,
    show_trending_products: slide.show_trending_products,
    trust_points: slide.trust_points,
    floating_badges: slide.floating_badges,
    status: 'draft',
    sort_order: slide.sort_order + 1,
    starts_at: slide.starts_at,
    ends_at: slide.ends_at,
  })
}

export async function reorderHeroSlides(orderedIds: string[]): Promise<void> {
  const orgId = await requireOrgId()
  const results = await Promise.all(
    orderedIds.map((id, index) =>
      db
        .from('website_hero_slides')
        .update({ sort_order: index })
        .eq('id', id)
        .eq('organization_id', orgId),
    ),
  )
  const failed = results.find((r: { error?: Error }) => r.error)
  if (failed?.error) throw failed.error
}

export async function uploadHeroImage(
  slideId: string,
  file: File,
  kind: 'desktop' | 'tablet' | 'mobile',
): Promise<string> {
  const orgId = await requireOrgId()
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
  if (!allowed.includes(file.type)) {
    throw new Error('Unsupported image format. Use JPEG, PNG, WebP or AVIF.')
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image must be under 5MB.')
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'webp'
  const path = `${orgId}/hero/${slideId}/${kind}-${Date.now()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type,
  })
  if (error) throw error
  return path
}

export async function removeHeroImage(path: string): Promise<void> {
  if (!path || path.startsWith('http')) return
  await supabase.storage.from(BUCKET).remove([path])
}

export function computeHeroKpis(slides: HeroSlideRow[]): HeroSlideKpis {
  const now = Date.now()
  return {
    total: slides.length,
    active: slides.filter((s) => s.status === 'active').length,
    scheduled: slides.filter((s) => {
      if (s.status !== 'active' || !s.starts_at) return false
      return new Date(s.starts_at).getTime() > now
    }).length,
    inactive: slides.filter((s) => s.status === 'inactive' || s.status === 'draft').length,
  }
}

export async function fetchActiveHeroSlides(
  orgSlug = STOREFRONT_ORG_SLUG,
): Promise<PublicHeroSlide[]> {
  const { data, error } = await db.rpc('get_active_hero_slides', {
    p_organization_slug: orgSlug,
  })

  if (error) throw error

  const rows = (Array.isArray(data) ? data : []) as RawSlide[]
  return rows.map((row) => {
    const slide = mapPublic(row)
    return {
      ...slide,
      desktop_image_url: resolveWebsiteMediaUrl(slide.desktop_image_path),
      tablet_image_url: resolveWebsiteMediaUrl(slide.tablet_image_path),
      mobile_image_url: resolveWebsiteMediaUrl(slide.mobile_image_path),
    }
  })
}
