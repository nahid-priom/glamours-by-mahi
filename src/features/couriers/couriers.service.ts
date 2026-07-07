import type {
  Courier,
  CourierApiConfigInput,
  CourierFilters,
  CourierFormInput,
  CourierStats,
} from './couriers.types'
import { MOCK_COURIERS } from '@/lib/mock-data'
import { auditCreate, auditUpdate, delay } from '@/lib/service-utils'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'

function loadCouriers(): Courier[] {
  const stored = getStorageItem<Courier[]>(STORAGE_KEYS.couriers, [])
  if (stored.length === 0) {
    setStorageItem(STORAGE_KEYS.couriers, MOCK_COURIERS)
    return MOCK_COURIERS
  }
  return stored
}

function applyFilters(couriers: Courier[], filters?: CourierFilters): Courier[] {
  let result = [...couriers]
  if (!filters?.include_deleted) {
    result = result.filter((c) => !c.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.contact_phone?.includes(q),
    )
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status)
  }
  if (filters?.connection_status && filters.connection_status !== 'all') {
    result = result.filter((c) => c.connection_status === filters.connection_status)
  }
  return result
}

export const couriersService = {
  async getCouriers(filters?: CourierFilters) {
    await delay()
    return applyFilters(loadCouriers(), filters)
  },

  async getCourierById(id: string) {
    await delay(150)
    return loadCouriers().find((c) => c.id === id) ?? null
  },

  async getStats(): Promise<CourierStats> {
    await delay(150)
    const couriers = loadCouriers().filter((c) => !c.deleted_at)
    const active = couriers.filter((c) => c.status === 'active')
    const connected = active.filter((c) => c.connection_status === 'connected')
    const pending_parcels = active.reduce((sum, c) => sum + c.pending_parcels, 0)
    const avg_success_rate =
      active.length > 0
        ? Math.round((active.reduce((sum, c) => sum + c.success_rate, 0) / active.length) * 10) / 10
        : 0

    return { active: active.length, connected: connected.length, pending_parcels, avg_success_rate }
  },

  async createCourier(input: CourierFormInput) {
    await delay(250)
    const existing = loadCouriers().find(
      (c) => c.code.toLowerCase() === input.code.toLowerCase() && !c.deleted_at,
    )
    if (existing) throw new Error('Courier code already exists')

    const courier = auditCreate(
      {
        ...input,
        connection_status: 'disconnected',
        success_rate: 0,
        pending_parcels: 0,
        delivered_parcels: 0,
        returned_parcels: 0,
        collection_amount: 0,
        last_sync_at: null,
      },
      'c',
    ) as Courier

    updateStorageItem(STORAGE_KEYS.couriers, loadCouriers(), (current) => [courier, ...current])
    return courier
  },

  async updateCourier(id: string, input: Partial<CourierFormInput & CourierApiConfigInput & Pick<Courier, 'connection_status' | 'last_sync_at'>>) {
    await delay(250)
    if (input.code) {
      const existing = loadCouriers().find(
        (c) => c.code.toLowerCase() === input.code!.toLowerCase() && c.id !== id && !c.deleted_at,
      )
      if (existing) throw new Error('Courier code already exists')
    }

    let updated: Courier | null = null
    updateStorageItem(STORAGE_KEYS.couriers, loadCouriers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        updated = auditUpdate(c, input as Partial<Courier>)
        return updated
      }),
    )
    if (!updated) throw new Error('Courier not found')
    return updated
  },

  async updateApiConfig(id: string, config: CourierApiConfigInput) {
    await delay(250)
    const connection_status = config.api_key ? 'connected' : 'disconnected'
    return this.updateCourier(id, { ...config, connection_status })
  },

  async enableCourier(id: string) {
    await delay(200)
    return this.updateCourier(id, { status: 'active' })
  },

  async disableCourier(id: string) {
    await delay(200)
    return this.updateCourier(id, { status: 'inactive', connection_status: 'disconnected' })
  },

  async softDelete(id: string) {
    await delay(200)
    const now = new Date().toISOString()
    updateStorageItem(STORAGE_KEYS.couriers, loadCouriers(), (current) =>
      current.map((c) =>
        c.id === id
          ? { ...c, deleted_at: now, updated_at: now, status: 'archived' as const }
          : c,
      ),
    )
  },

  async restore(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.couriers, loadCouriers(), (current) =>
      current.map((c) =>
        c.id === id
          ? { ...c, deleted_at: null, status: 'active' as const, updated_at: new Date().toISOString() }
          : c,
      ),
    )
  },
}
