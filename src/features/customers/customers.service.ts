import type { Customer, CustomerFilters, CustomerFormInput, CustomerStats } from './customers.types'
import { MOCK_CUSTOMERS } from '@/lib/mock-data'
import { generateId } from '@/lib/id'
import { getStorageItem, setStorageItem, STORAGE_KEYS, updateStorageItem } from '@/lib/storage'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

type LegacyCustomer = Partial<Customer> & { notes?: string }

function migrateCustomer(raw: LegacyCustomer): Customer {
  const total_orders = raw.total_orders ?? 0
  const returned_orders = raw.returned_orders ?? 0
  const return_rate =
    raw.return_rate ??
    (total_orders > 0 ? Math.round((returned_orders / total_orders) * 1000) / 10 : 0)

  let status = raw.status
  if (!status) {
    if (raw.is_blacklisted) status = 'blocked'
    else if (raw.deleted_at) status = 'archived'
    else status = 'active'
  }

  let fraud_level = raw.fraud_level ?? 'SAFE'
  if (raw.is_blacklisted && fraud_level !== 'BLOCKED') fraud_level = 'BLOCKED'

  return {
    id: raw.id ?? generateId('cu'),
    name: raw.name ?? 'Unknown',
    phone: raw.phone ?? '',
    email: raw.email ?? '',
    address: raw.address ?? '',
    district: raw.district ?? '',
    total_orders,
    delivered_orders: raw.delivered_orders ?? 0,
    returned_orders,
    cancelled_orders: raw.cancelled_orders ?? 0,
    total_spent: raw.total_spent ?? 0,
    return_rate,
    fraud_level,
    is_blacklisted: raw.is_blacklisted ?? false,
    blacklist_reason: raw.blacklist_reason ?? null,
    customer_note: raw.customer_note ?? raw.notes ?? '',
    status,
    created_at: raw.created_at ?? new Date().toISOString(),
    updated_at: raw.updated_at ?? new Date().toISOString(),
    deleted_at: raw.deleted_at ?? null,
    created_by: raw.created_by ?? null,
    updated_by: raw.updated_by ?? null,
  }
}

function loadCustomers(): Customer[] {
  const stored = getStorageItem<LegacyCustomer[]>(STORAGE_KEYS.customers, [])
  if (stored.length === 0) {
    const seeded = MOCK_CUSTOMERS.map(migrateCustomer)
    setStorageItem(STORAGE_KEYS.customers, seeded)
    return seeded
  }
  return stored.map(migrateCustomer)
}

function applyFilters(customers: Customer[], filters?: CustomerFilters): Customer[] {
  let result = [...customers]
  if (!filters?.include_deleted) {
    result = result.filter((c) => !c.deleted_at)
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase()
    result = result.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q) ||
        c.district.toLowerCase().includes(q),
    )
  }
  if (filters?.status && filters.status !== 'all') {
    result = result.filter((c) => c.status === filters.status)
  }
  if (filters?.fraud_level && filters.fraud_level !== 'all') {
    result = result.filter((c) => c.fraud_level === filters.fraud_level)
  }
  if (filters?.is_blacklisted !== undefined && filters.is_blacklisted !== 'all') {
    result = result.filter((c) => c.is_blacklisted === filters.is_blacklisted)
  }
  return result
}

export const customersService = {
  async getAll(filters?: CustomerFilters) {
    await delay()
    return applyFilters(loadCustomers(), filters)
  },

  async getById(id: string) {
    await delay(150)
    return loadCustomers().find((c) => c.id === id) ?? null
  },

  async getByPhone(phone: string) {
    await delay(200)
    return loadCustomers().find((c) => c.phone === phone) ?? null
  },

  async getStats(): Promise<CustomerStats> {
    await delay(150)
    const customers = loadCustomers().filter((c) => !c.deleted_at)
    const totalReturnRate = customers.reduce((sum, c) => sum + c.return_rate, 0)
    return {
      total: customers.length,
      active: customers.filter((c) => c.status === 'active').length,
      blocked: customers.filter((c) => c.status === 'blocked').length,
      blacklisted: customers.filter((c) => c.is_blacklisted).length,
      high_risk: customers.filter((c) => c.fraud_level === 'HIGH' || c.fraud_level === 'BLOCKED').length,
      avg_return_rate: customers.length > 0 ? Math.round((totalReturnRate / customers.length) * 10) / 10 : 0,
    }
  },

  async create(input: CustomerFormInput) {
    await delay(250)
    const existing = await this.getByPhone(input.phone)
    if (existing && !existing.deleted_at) throw new Error('Phone number already registered')

    const now = new Date().toISOString()
    const customer: Customer = migrateCustomer({
      id: generateId('cu'),
      ...input,
      total_orders: 0,
      delivered_orders: 0,
      returned_orders: 0,
      cancelled_orders: 0,
      total_spent: 0,
      return_rate: 0,
      fraud_level: 'SAFE',
      is_blacklisted: false,
      blacklist_reason: null,
      customer_note: '',
      created_at: now,
      updated_at: now,
      deleted_at: null,
    })

    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) => [customer, ...current])
    return customer
  },

  async update(id: string, input: Partial<CustomerFormInput>) {
    await delay(250)
    if (input.phone) {
      const existing = await this.getByPhone(input.phone)
      if (existing && existing.id !== id && !existing.deleted_at) {
        throw new Error('Phone number already registered')
      }
    }

    let updated: Customer | null = null
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        updated = migrateCustomer({
          ...c,
          ...input,
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Customer not found')
    return updated
  },

  async softDelete(id: string) {
    await delay(200)
    const now = new Date().toISOString()
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) =>
        c.id === id
          ? { ...c, deleted_at: now, updated_at: now, status: 'archived' as const }
          : c,
      ),
    )
  },

  async restore(id: string) {
    await delay(200)
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        return migrateCustomer({
          ...c,
          deleted_at: null,
          status: c.is_blacklisted ? 'blocked' : 'active',
          updated_at: new Date().toISOString(),
        })
      }),
    )
  },

  async blacklist(id: string, reason: string) {
    await delay(200)
    let updated: Customer | null = null
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        updated = migrateCustomer({
          ...c,
          is_blacklisted: true,
          blacklist_reason: reason,
          fraud_level: 'BLOCKED',
          status: 'blocked',
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Customer not found')
    return updated
  },

  async unblacklist(id: string) {
    await delay(200)
    let updated: Customer | null = null
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        const returned = c.returned_orders
        const total = c.total_orders
        const return_rate = total > 0 ? Math.round((returned / total) * 1000) / 10 : 0
        let fraud_level = c.fraud_level
        if (return_rate > 40 || returned >= 3) fraud_level = 'HIGH'
        else if (return_rate > 20) fraud_level = 'MEDIUM'
        else fraud_level = 'SAFE'

        updated = migrateCustomer({
          ...c,
          is_blacklisted: false,
          blacklist_reason: null,
          fraud_level,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Customer not found')
    return updated
  },

  async addNote(id: string, note: string) {
    await delay(200)
    let updated: Customer | null = null
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.id !== id) return c
        updated = migrateCustomer({
          ...c,
          customer_note: note,
          updated_at: new Date().toISOString(),
        })
        return updated
      }),
    )
    if (!updated) throw new Error('Customer not found')
    return updated
  },

  async updateCustomerRiskOnReturn(phone: string) {
    await delay(100)
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.phone !== phone) return c
        const returned = c.returned_orders + 1
        const total = c.total_orders + 1
        const return_rate = total > 0 ? Math.round((returned / total) * 1000) / 10 : 0
        let fraud_level = c.fraud_level
        if (c.is_blacklisted) fraud_level = 'BLOCKED'
        else if (return_rate > 40) fraud_level = 'HIGH'
        else if (return_rate > 20) fraud_level = 'MEDIUM'
        return migrateCustomer({
          ...c,
          returned_orders: returned,
          total_orders: total,
          return_rate,
          fraud_level,
          updated_at: new Date().toISOString(),
        })
      }),
    )
  },

  // Backward-compatible aliases
  getCustomers: (filters?: CustomerFilters) => customersService.getAll(filters),
  getCustomerById: (id: string) => customersService.getById(id),
  getCustomerByPhone: (phone: string) => customersService.getByPhone(phone),

  async recordOrderPlacement(phone: string, amount: number) {
    await delay(100)
    updateStorageItem(STORAGE_KEYS.customers, loadCustomers(), (current) =>
      current.map((c) => {
        if (c.phone !== phone) return c
        return migrateCustomer({
          ...c,
          total_orders: c.total_orders + 1,
          total_spent: c.total_spent + amount,
          updated_at: new Date().toISOString(),
        })
      }),
    )
  },
}
