import { useQuery } from '@tanstack/react-query'
import { fetchMenuCategories } from '../repositories/menu-categories.repository'

/**
 * Active storefront menu categories with children, fetched once and cached —
 * the mega menu never refetches per hover, and back-navigation reuses cache.
 */
export function useMenuCategories() {
  return useQuery({
    queryKey: ['storefront', 'menu-categories'],
    queryFn: fetchMenuCategories,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
