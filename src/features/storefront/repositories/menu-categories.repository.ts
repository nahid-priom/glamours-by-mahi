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

/**
 * One query for the whole menu hierarchy (categories with embedded
 * subcategories). Anon read is covered by the storefront RLS policies.
 */
export async function fetchMenuCategories(): Promise<MenuCategory[]> {
  const orgId = await resolveStorefrontOrgId()

  const { data, error } = await supabase
    .from('categories')
    .select(
      `
      id, name, slug, image_url, icon, description, sort_order, is_active, show_in_menu, deleted_at,
      subcategories (
        id, name, slug, sort_order, is_active, show_in_menu, deleted_at
      )
    `,
    )
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .eq('show_in_menu', true)
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug || toSlug(row.name),
    imageUrl: row.image_url,
    icon: row.icon,
    description: row.description,
    children: (row.subcategories ?? [])
      .filter((child) => child.is_active && child.show_in_menu && !child.deleted_at)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
      .map((child) => ({
        id: child.id,
        name: child.name,
        slug: child.slug || toSlug(child.name),
      })),
  }))
}
