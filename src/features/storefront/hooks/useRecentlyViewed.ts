import { useCallback, useEffect, useState } from 'react'
import type { StorefrontProduct } from '../storefront.types'

const STORAGE_KEY = 'Shakira Enterprise_recently_viewed'
const MAX_ITEMS = 12

function readIds(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useRecentlyViewed() {
  const [ids, setIds] = useState<string[]>(() => readIds())

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setIds(readIds())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addViewed = useCallback((productId: string) => {
    setIds((prev) => {
      const next = [productId, ...prev.filter((id) => id !== productId)].slice(0, MAX_ITEMS)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const resolveProducts = useCallback(
    (all: StorefrontProduct[], limit = 8) => {
      const map = new Map(all.map((p) => [p.id, p]))
      return ids.map((id) => map.get(id)).filter(Boolean).slice(0, limit) as StorefrontProduct[]
    },
    [ids],
  )

  return { ids, addViewed, resolveProducts }
}

export function trackRecentlyViewed(productId: string) {
  const ids = readIds()
  const next = [productId, ...ids.filter((id) => id !== productId)].slice(0, MAX_ITEMS)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}
