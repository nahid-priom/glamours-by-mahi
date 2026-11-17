import type { QueryClient } from '@tanstack/react-query'
import {
  invalidateAccountingMovementCaches,
  invalidateCustomerCollectionCaches,
  invalidateExpenseCaches,
  invalidateSupplierPaymentCaches,
} from '@/lib/mutations/party-finance-cache'
import { queryKeys } from '@/lib/query/keys'

/** Invalidate all Accounts 2.0 hub reads after a money mutation. */
export async function invalidateFinancialHubCaches(
  qc: QueryClient,
  opts?: { branchId?: string | null },
) {
  await invalidateAccountingMovementCaches(qc)
  await qc.invalidateQueries({ queryKey: queryKeys.accounts })
  if (opts?.branchId) {
    await qc.invalidateQueries({ queryKey: [...queryKeys.accounts, opts.branchId] })
  }
}

export {
  invalidateAccountingMovementCaches,
  invalidateCustomerCollectionCaches,
  invalidateExpenseCaches,
  invalidateSupplierPaymentCaches,
}
