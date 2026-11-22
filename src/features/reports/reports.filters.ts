/**
 * Shared Reports V3 filter contract (see docs/architecture/REPORTS_V3_FILTER_CONTRACT.md).
 */
export type ReportFilterContract = {
  from: string
  to: string
  branchId?: string | null
  warehouseId?: string | null
  customerId?: string | null
  supplierId?: string | null
  productId?: string | null
  salespersonId?: string | null
  status?: string | null
  page?: number
  pageSize?: number
}

export function reportQueryKey(
  reportType: string,
  filters: Pick<ReportFilterContract, 'from' | 'to' | 'branchId' | 'page' | 'pageSize'> &
    Record<string, unknown>,
) {
  return [
    'reports',
    reportType,
    filters.from,
    filters.to,
    filters.branchId ?? null,
    filters.page ?? 1,
    filters.pageSize ?? null,
  ] as const
}
