import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/lib/storage'
import type { OrderStatus } from '@/lib/constants'
import type { Order } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { cartService } from '../cart.service'
import type { AccountOrderFilters, AccountSession, AccountStats, SavedAddress } from './account.types'

type UntypedRpc = (
  fn: string,
  args?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>

const untypedRpc = supabase.rpc.bind(supabase) as unknown as UntypedRpc

const IN_PROGRESS: OrderStatus[] = ['New', 'Confirmed', 'Packed', 'Courier Booked', 'Shipped']

type TrackedSale = {
  invoice_no: string
  grand_total: number
  due_total: number
  status: string
  channel: string | null
  completed_at: string | null
  customers?: { name: string; phone: string } | null
}

function mapSaleStatus(status: string): OrderStatus {
  const s = status.toLowerCase()
  if (s === 'completed' || s === 'delivered') return 'Delivered'
  if (s === 'cancelled') return 'Cancelled'
  if (s === 'returned') return 'Returned'
  if (s === 'draft') return 'New'
  return 'Confirmed'
}

export function getSession(): AccountSession | null {
  return getStorageItem<AccountSession | null>(STORAGE_KEYS.accountSession, null)
}

export function saveSession(session: AccountSession): void {
  setStorageItem(STORAGE_KEYS.accountSession, session)
}

export function clearSession(): void {
  localStorage.removeItem(`oms_${STORAGE_KEYS.accountSession}`)
}

/** Phone-only guest session — no legacy localStorage customer registry. */
export async function loginByPhone(phone: string): Promise<AccountSession> {
  const normalized = phone.trim()
  const session: AccountSession = { phone: normalized, name: 'Customer' }
  try {
    const { data } = await untypedRpc('track_online_order', { p_query: normalized })
    const rows = (data as TrackedSale[] | null) ?? []
    const name = rows[0]?.customers?.name
    if (name) session.name = name
  } catch {
    /* tracking is best-effort for greeting */
  }
  saveSession(session)
  return session
}

export async function syncProfile(session: AccountSession): Promise<void> {
  saveSession(session)
}

function addressesKey(phone: string): string {
  return `${STORAGE_KEYS.customerAddresses}_${phone}`
}

export function getAddresses(phone: string): SavedAddress[] {
  return getStorageItem<SavedAddress[]>(addressesKey(phone), [])
}

export function saveAddresses(phone: string, addresses: SavedAddress[]): void {
  setStorageItem(addressesKey(phone), addresses)
}

export function addAddress(phone: string, input: Omit<SavedAddress, 'id'>): SavedAddress[] {
  const list = getAddresses(phone)
  const id = `addr_${Date.now()}`
  let next = [...list, { ...input, id }]
  if (input.isDefault || next.length === 1) {
    next = next.map((a) => ({ ...a, isDefault: a.id === id }))
  }
  saveAddresses(phone, next)
  return next
}

export function updateAddress(phone: string, id: string, input: Partial<SavedAddress>): SavedAddress[] {
  let next = getAddresses(phone).map((a) => (a.id === id ? { ...a, ...input, id } : a))
  if (input.isDefault) {
    next = next.map((a) => ({ ...a, isDefault: a.id === id }))
  }
  saveAddresses(phone, next)
  return next
}

export function deleteAddress(phone: string, id: string): SavedAddress[] {
  let next = getAddresses(phone).filter((a) => a.id !== id)
  if (next.length > 0 && !next.some((a) => a.isDefault)) {
    next[0] = { ...next[0], isDefault: true }
  }
  saveAddresses(phone, next)
  return next
}

export function getDefaultAddress(phone: string): SavedAddress | null {
  const list = getAddresses(phone)
  return list.find((a) => a.isDefault) ?? list[0] ?? null
}

/** Orders for account phone via public track_online_order (exact phone match). */
export async function getOrdersForPhone(phone: string, filters?: AccountOrderFilters): Promise<Order[]> {
  const { data, error } = await untypedRpc('track_online_order', { p_query: phone.trim() })
  if (error) throw error

  const rows = (data as TrackedSale[] | null) ?? []
  let result: Order[] = rows.map((row, index) => {
    const status = mapSaleStatus(row.status)
    const now = row.completed_at ?? new Date().toISOString()
    return {
      id: row.invoice_no || `track-${index}`,
      order_id: row.invoice_no,
      store_id: 'storefront',
      store_name: 'Glamourous by Mahi',
      customer_name: row.customers?.name ?? 'Customer',
      customer_phone: row.customers?.phone ?? phone,
      delivery_address: '',
      product_name: 'Online order',
      quantity: 1,
      cod_amount: Number(row.grand_total ?? 0),
      status,
      fraud_level: 'SAFE',
      fraud_score: 0,
      payment_status: Number(row.due_total ?? 0) > 0 ? 'pending' : 'collected',
      created_at: now,
      updated_at: now,
    } as unknown as Order
  })

  if (filters?.search?.trim()) {
    const q = filters.search.trim().toLowerCase()
    result = result.filter(
      (o) =>
        o.order_id.toLowerCase().includes(q) ||
        o.product_name.toLowerCase().includes(q) ||
        (o.tracking_id?.toLowerCase().includes(q) ?? false),
    )
  }

  if (filters?.status && filters.status !== 'all') {
    result = result.filter((o) => o.status === filters.status)
  }

  return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
}

export function computeStats(orders: Order[], wishlistCount: number): AccountStats {
  const delivered = orders.filter((o) => o.status === 'Delivered').length
  const returned = orders.filter((o) => o.status === 'Returned' || o.status === 'Cancelled').length
  const inProgress = orders.filter((o) => IN_PROGRESS.includes(o.status)).length
  const totalSpent = orders
    .filter((o) => o.status === 'Delivered')
    .reduce((sum, o) => sum + o.cod_amount, 0)

  return {
    totalOrders: orders.length,
    delivered,
    inProgress,
    returned,
    totalSpent,
    wishlistCount,
  }
}

export function getWishlistCount(): number {
  return cartService.getWishlist().length
}

export function profileCompletion(session: AccountSession | null): number {
  if (!session) return 0
  const fields = [session.name, session.phone, session.email, session.district, session.address]
  const filled = fields.filter((f) => f && String(f).trim().length > 0).length
  return Math.round((filled / fields.length) * 100)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}
