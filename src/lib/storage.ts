const STORAGE_PREFIX = 'oms_'

export function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`
}

export function getStorageItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(getStorageKey(key))
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  localStorage.setItem(getStorageKey(key), JSON.stringify(value))
}

export function updateStorageItem<T>(key: string, fallback: T, updater: (current: T) => T): T {
  const current = getStorageItem(key, fallback)
  const next = updater(current)
  setStorageItem(key, next)
  return next
}

export const STORAGE_KEYS = {
  orders: 'orders',
  products: 'products',
  customers: 'customers',
  stores: 'stores',
  couriers: 'couriers',
  fraudRules: 'fraud_rules',
  fraudChecks: 'fraud_checks',
  fraudApiConfig: 'fraud_api_config',
  invoices: 'invoices',
  settings: 'settings',
  customerNotes: 'customer_notes',
  courierStatusLogs: 'courier_status_logs',
  reportsFilters: 'reports_filters',
  cart: 'cart',
  wishlist: 'wishlist',
  accountSession: 'account_session',
  customerAddresses: 'customer_addresses',
} as const
