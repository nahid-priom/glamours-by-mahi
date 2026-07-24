import type { QueryClient } from '@tanstack/react-query'
import { invalidateInventoryQueries } from '@/features/inventory/lib/invalidate-inventory-queries'
import { queryKeys } from '@/lib/query/keys'

/** Invalidate caches touched by customer collections and related sales flows. */
export async function invalidateCustomerCollectionCaches(
  qc: QueryClient,
  opts: { customerId?: string | null; saleId?: string | null; branchId?: string | null } = {},
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: ['sales'] }),
    qc.invalidateQueries({ queryKey: ['sales-kpis'] }),
    qc.invalidateQueries({ queryKey: queryKeys.accounts }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    qc.invalidateQueries({ queryKey: queryKeys.accountingAccounts() }),
    qc.invalidateQueries({ queryKey: queryKeys.accountingTransactions() }),
    qc.invalidateQueries({ queryKey: ['customers'] }),
    qc.invalidateQueries({ queryKey: queryKeys.customersAdmin() }),
  ]

  if (opts.customerId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.customer(opts.customerId) }))
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.customersLedger(opts.customerId) }))
  }

  if (opts.saleId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.sale(opts.saleId) }))
  }

  if (opts.branchId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.posFinancialAccounts(opts.branchId) }))
  }

  await Promise.all(tasks)
}

/** Invalidate caches touched by supplier payments and purchases. */
export async function invalidateSupplierPaymentCaches(
  qc: QueryClient,
  opts: { supplierId?: string | null; branchId?: string | null } = {},
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: queryKeys.purchases() }),
    qc.invalidateQueries({ queryKey: queryKeys.accounts }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    qc.invalidateQueries({ queryKey: queryKeys.accountingAccounts() }),
    qc.invalidateQueries({ queryKey: queryKeys.accountingTransactions() }),
    qc.invalidateQueries({ queryKey: queryKeys.suppliers() }),
    qc.invalidateQueries({ queryKey: ['supplier-payments'] }),
    qc.invalidateQueries({ queryKey: ['purchase-fa'] }),
  ]

  if (opts.supplierId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.supplier(opts.supplierId) }))
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.suppliersLedger(opts.supplierId) }))
  }

  if (opts.branchId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.posFinancialAccounts(opts.branchId) }))
  }

  await Promise.all(tasks)
}

/** Invalidate caches after POS sale completion. */
export async function invalidateSaleCompletionCaches(
  qc: QueryClient,
  opts: { customerId?: string | null; branchId?: string | null } = {},
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: ['sales'] }),
    qc.invalidateQueries({ queryKey: ['sales-kpis'] }),
    qc.invalidateQueries({ queryKey: queryKeys.inventory({}) }),
    qc.invalidateQueries({ queryKey: queryKeys.stockLedger() }),
    qc.invalidateQueries({ queryKey: queryKeys.accounts }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard() }),
    qc.invalidateQueries({ queryKey: queryKeys.posProducts(opts.branchId ?? '', null) }),
  ]
  invalidateInventoryQueries(qc)

  if (opts.customerId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.customer(opts.customerId) }))
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.customersLedger(opts.customerId) }))
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.customers('') }))
  }

  if (opts.branchId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.posFinancialAccounts(opts.branchId) }))
  }

  await Promise.all(tasks)
}

/** Invalidate caches after purchase completion. */
export async function invalidatePurchaseCompletionCaches(
  qc: QueryClient,
  opts: { supplierId?: string | null; branchId?: string | null } = {},
) {
  const tasks: Promise<unknown>[] = [
    qc.invalidateQueries({ queryKey: queryKeys.purchases() }),
    qc.invalidateQueries({ queryKey: queryKeys.inventory({}) }),
    qc.invalidateQueries({ queryKey: queryKeys.stockLedger() }),
    qc.invalidateQueries({ queryKey: queryKeys.accounts }),
    qc.invalidateQueries({ queryKey: queryKeys.dashboard() }),
  ]
  invalidateInventoryQueries(qc)

  if (opts.supplierId) {
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.supplier(opts.supplierId) }))
    tasks.push(qc.invalidateQueries({ queryKey: queryKeys.suppliersLedger(opts.supplierId) }))
  }

  await Promise.all(tasks)
}
