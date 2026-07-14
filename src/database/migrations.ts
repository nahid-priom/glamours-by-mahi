import type { ERPDatabase } from './schema'
import { ERP_DB_VERSION } from './schema'

export function migrateDatabase(db: ERPDatabase): ERPDatabase {
  let current = { ...db }

  if (!current.meta) {
    current.meta = {
      version: 1,
      brand: 'Glamourous by Mahi',
      seededAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  }

  current.meta = {
    ...current.meta,
    version: Math.max(current.meta.version, 1),
    brand: 'Glamourous by Mahi',
  }

  if (current.meta.version < 2) {
    current.sales = (current.sales ?? []).map((sale) => {
      const paid = sale.paidAmount ?? 0
      const due = sale.dueAmount ?? 0
      let status = sale.status
      if (status === 'Completed' || !status) {
        if (due > 0 && paid > 0) status = 'Partial Paid'
        else if (due > 0 && paid === 0) status = 'Processing'
        else status = 'Completed'
      }
      return {
        ...sale,
        status,
        updated_at: sale.updated_at ?? sale.created_at,
        deleted_at: sale.deleted_at ?? null,
      }
    })
    current.collections = (current.collections ?? []).map((c) => ({
      ...c,
      saleId: c.saleId ?? null,
    }))
    current.meta.version = 2
  }

  if (current.meta.version < ERP_DB_VERSION) {
    current.meta.version = ERP_DB_VERSION
  }

  // Ensure arrays exist for new collections
  const defaults: Partial<ERPDatabase> = {
    branches: [],
    users: [],
    roles: [],
    employees: [],
    departments: [],
    designations: [],
    attendance: [],
    leaves: [],
    payrolls: [],
    products: [],
    categories: [],
    brands: [],
    stockBalances: [],
    stockMovements: [],
    stockTransfers: [],
    suppliers: [],
    purchases: [],
    purchaseReturns: [],
    supplierPayments: [],
    customers: [],
    addresses: [],
    sales: [],
    saleReturns: [],
    orders: [],
    collections: [],
    courierBookings: [],
    courierSettlements: [],
    financialAccounts: [],
    financialTransactions: [],
    commissions: [],
    activities: [],
    notifications: [],
  }

  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in current) || current[key as keyof ERPDatabase] == null) {
      ;(current as Record<string, unknown>)[key] = value
    }
  }

  return current
}
