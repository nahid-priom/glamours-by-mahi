import { supabase } from '@/lib/supabase/client'
import { resolveStorefrontOrgId } from './storefront-catalog.repository'

export type MenuSubcategory = {
  id: string
  name: string
  slug: string
}

export type MenuCategory = {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  icon: string | null
  description: string | null
  children: MenuSubcategory[]
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type RawCategoryRow = {
  id: string
  name: string
  slug?: string | null
  image_url?: string | null
  icon?: string | null
  description?: string | null
  code?: string | null
  sort_order: number
  is_active: boolean
  show_in_menu?: boolean | null
  deleted_at?: string | null
  subcategories?: RawSubcategoryRow[] | null
}

type RawSubcategoryRow = {
  id: string
  name: string
  slug?: string | null
  code?: string | null
  sort_order: number
  is_active: boolean
  show_in_menu?: boolean | null
  deleted_at?: string | null
}

const ENRICHED_SELECT = `
  id, name, slug, image_url, icon, description, sort_order, is_active, show_in_menu, deleted_at,
  subcategories (
    id, name, slug, sort_order, is_active, show_in_menu, deleted_at
  )
`

// Base schema only — used before the menu-hierarchy migration is applied so the
// header still renders the existing categories instead of showing nothing.
const BASE_SELECT = `
  id, name, code, description, sort_order, is_active, deleted_at,
  subcategories (
    id, name, code, sort_order, is_active, deleted_at
  )
`

function mapRows(rows: RawCategoryRow[]): MenuCategory[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug || toSlug(row.code || row.name),
    imageUrl: row.image_url ?? null,
    icon: row.icon ?? null,
    description: row.description ?? null,
    children: (row.subcategories ?? [])
      .filter(
        (child) =>
          child.is_active &&
          child.show_in_menu !== false &&
          !child.deleted_at,
      )
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug || toSlug(child.code || child.name),
      })),
  }))
}

export type ResolvedCategory = {
  id: string
  name: string
  slug: string
  kind: 'category' | 'subcategory'
  parentName: string | null
  description: string | null
  imageUrl: string | null
  /** Slugs to match against product tags (self + active descendants). */
  filterSlugs: string[]
}

function uniqueSlugs(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>()
  for (const value of values) {
    if (!value) continue
    const slug = toSlug(value)
    if (slug) set.add(slug)
  }
  return [...set]
}

const RESOLVE_CATEGORY_SELECT = `
  id, name, slug, code, description, image_url, is_active, deleted_at,
  subcategories ( id, name, slug, code, is_active, deleted_at )
`

/**
 * Resolves a storefront category route slug against the database.
 *
 * Matches a parent category first (returning its slug plus every active
 * descendant subcategory slug), then falls back to a leaf subcategory. Returns
 * `null` for unknown/inactive/soft-deleted slugs so the route can render a
 * proper not-found state. Anon read is covered by the storefront RLS policies.
 */
export async function resolveCategoryBySlug(slug: string): Promise<ResolvedCategory | null> {
  const clean = slug?.trim().toLowerCase()
  if (!clean) return null
  const orgId = await resolveStorefrontOrgId()

  const parent = await supabase
    .from('categories')
    .select(RESOLVE_CATEGORY_SELECT)
    .eq('organization_id', orgId)
    .eq('slug', clean)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!parent.error && parent.data) {
    const row = parent.data as unknown as RawCategoryRow & {
      code?: string | null
      description?: string | null
      image_url?: string | null
    }
    const children = (row.subcategories ?? []).filter(
      (child) => child.is_active && !child.deleted_at,
    )
    return {
      id: row.id,
      name: row.name,
      slug: row.slug || toSlug(row.code || row.name),
      kind: 'category',
      parentName: null,
      description: row.description ?? null,
      imageUrl: row.image_url ?? null,
      filterSlugs: uniqueSlugs([
        row.slug,
        row.code,
        row.name,
        ...children.flatMap((child) => [child.slug, child.code, child.name]),
      ]),
    }
  }

  type RawSubResolve = {
    id: string
    name: string
    slug?: string | null
    code?: string | null
    category: { name: string } | { name: string }[] | null
  }

  const child = await supabase
    .from('subcategories')
    .select('id, name, slug, code, is_active, deleted_at, category:categories(name)')
    .eq('organization_id', orgId)
    .eq('slug', clean)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (!child.error && child.data) {
    const row = child.data as unknown as RawSubResolve
    const parentCategory = Array.isArray(row.category) ? row.category[0] : row.category
    return {
      id: row.id,
      name: row.name,
      slug: row.slug || toSlug(row.code || row.name),
      kind: 'subcategory',
      parentName: parentCategory?.name ?? null,
      description: null,
      imageUrl: null,
      filterSlugs: uniqueSlugs([row.slug, row.code, row.name]),
    }
  }

  return null
}

/**
 * One query for the whole menu hierarchy (categories with embedded
 * subcategories). Anon read is covered by the storefront RLS policies.
 *
 * Falls back to a base-schema query when the menu-hierarchy migration hasn't
 * been applied yet, so the Categories menu never silently disappears.
 */
export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  const orgId = await resolveStorefrontOrgId()

  const enriched = await supabase
    .from('categories')
    .select(ENRICHED_SELECT)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('show_in_menu', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (!enriched.error) {
    return mapRows((enriched.data ?? []) as unknown as RawCategoryRow[])
  }

  // Missing columns (migration not applied) → retry against the base schema.
  const base = await supabase
    .from('categories')
    .select(BASE_SELECT)
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (base.error) throw base.error
  return mapRows((base.data ?? []) as unknown as RawCategoryRow[])
}
