import type { Store, StoreFilters, StoreFormInput, StoreStats, StoreType } from './stores.types'
import { MOCK_STORES } from '@/lib/mock-data'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'
import { auditCreate, auditUpdate, delay } from '@/lib/service-utils'

type LegacyStore = {
  platform?: string
  orders_count?: number
  collection_amount?: number
  status?: string
}

const PLATFORM_MAP: Record<string, StoreType> = {
  facebook: 'facebook',
  shopify: 'shopify',
  woocommerce: 'woocommerce',
  instagram: 'instagram',
}

function normalizeStatus(status?: string): Store['status'] {
  if (status === 'archived') return 'archived'
  if (status === 'inactive' || status === 'pending') return 'inactive'
  return 'active'
}

function migrateStore(raw: Store & LegacyStore): Store {
  const platformKey = (raw.platform ?? '').toLowerCase()
  const type = raw.type ?? PLATFORM_MAP[platformKey] ?? 'manual'
  const legacyStatus = raw.status as string | undefined
  const status = normalizeStatus(legacyStatus)
  const api_status =
    raw.api_status ??
    (legacyStatus === 'pending' || status === 'inactive' ? 'not_connected' : 'connected')

  return {
    id: raw.id,
    name: raw.name,
    type,
    logo_url: raw.logo_url ?? null,
    phone: raw.phone ?? null,
    email: raw.email ?? null,
    address: raw.address ?? null,
    invoice_prefix: raw.invoice_prefix,
    default_courier_id: raw.default_courier_id ?? null,
    status,
    api_status,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
    deleted_at: raw.deleted_at ?? null,
    created_by: raw.created_by ?? 'Admin',
    updated_by: raw.updated_by ?? 'Admin',
  }
}

function loadStores(): Store[] {
  const stored = getStorageItem<(Store & LegacyStore)[]>(STORAGE_KEYS.stores, [])
  if (stored.length === 0) {
    const seeded = MOCK_STORES.map(migrateStore)
    setStorageItem(STORAGE_KEYS.stores, seeded)
    return seeded
  }
  return stored.map(migrateStore)
}

function applyFilters(stores: Store[], filters?: StoreFilters): Store[] {
  let result = [...stores]
  if (!filters?.include_deleted) {
    result = result.filter((s) => !s.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.invoice_prefix.toLowerCase().includes(q) ||
        (s.email?.toLowerCase().includes(q) ?? false) ||
        (s.phone?.includes(q) ?? false),
    )
  }
  if (filters?.type && filters.type !== 'all') {
    result = result.filter((s) => s.type === filters.type)
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((s) => s.status === filters.status)
  }
  if (filters?.api_status && filters.api_status !== 'all') {
    result = result.filter((s) => s.api_status === filters.api_status)
  }
  return result
}

export const storesService = {
  async getAll(filters?: StoreFilters) {
    await delay()
    return applyFilters(loadStores(), filters)
  },

  async getStores(filters?: StoreFilters) {
    return this.getAll(filters)
  },

  async getById(id: string) {
    await delay(150)
    return loadStores().find((s) => s.id === id) ?? null
  },

  async getStats(): Promise<StoreStats> {
    await delay(150)
    const stores = loadStores().filter((s) => !s.deleted_at)
    return {
      total: stores.length,
      active: stores.filter((s) => s.status === 'active').length,
      connected: stores.filter((s) => s.api_status === 'connected').length,
      inactive: stores.filter((s) => s.status !== 'active').length,
    }
  },

  async create(input: StoreFormInput) {
    await delay(250)
    const store = migrateStore(
      auditCreate(
        {
          name: input.name,
          type: input.type,
          logo_url: input.logo_url || null,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
          invoice_prefix: input.invoice_prefix.toUpperCase(),
          default_courier_id: input.default_courier_id || null,
          status: input.status,
          api_status: input.api_status,
        },
        's',
      ) as Store,
    )

    updateStorageItem(STORAGE_KEYS.stores, loadStores(), (current) => [store, ...current])
    return store
  },

  async update(id: string, input: Partial<StoreFormInput>) {
    await delay(250)
    let updated: Store | null = null
    updateStorageItem(STORAGE_KEYS.stores, loadStores(), (current) =>
      current.map((s) => {
        if (s.id !== id) return s
        updated = migrateStore(
          auditUpdate(s, {
            ...input,
            logo_url: input.logo_url !== undefined ? input.logo_url || null : s.logo_url,
            phone: input.phone !== undefined ? input.phone || null : s.phone,
            email: input.email !== undefined ? input.email || null : s.email,
            address: input.address !== undefined ? input.address || null : s.address,
            default_courier_id:
              input.default_courier_id !== undefined
                ? input.default_courier_id || null
                : s.default_courier_id,
            invoice_prefix: input.invoice_prefix
              ? input.invoice_prefix.toUpperCase()
              : s.invoice_prefix,
          }),
        )
        return updated
      }),
    )
    if (!updated) throw new Error('Store not found')
    return updated
  },

  async softDelete(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.stores, loadStores(), (current) =>
      current.map((s) =>
        s.id === id
          ? auditUpdate(s, { deleted_at: new Date().toISOString(), status: 'archived' })
          : s,
      ),
    )
  },

  async restore(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.stores, loadStores(), (current) =>
      current.map((s) => {
        if (s.id !== id) return s
        return migrateStore(
          auditUpdate(s, {
            deleted_at: null,
            status: s.status === 'archived' ? 'inactive' : s.status,
          }),
        )
      }),
    )
  },
}
