import type { PayrollFilters } from '@/features/hr/repositories/payroll.repository'

/** Apply branch filter including org-wide runs (branch_id IS NULL). */
export function buildPayrollBranchFilter(
  query: { or: (filter: string) => unknown; eq: (col: string, val: string) => unknown },
  branchId?: string | null,
) {
  if (!branchId) return query
  return query.or(`branch_id.eq.${branchId},branch_id.is.null`)
}

export function normalizePayrollFilters(
  filters: PayrollFilters,
  activeBranchId?: string | null,
): PayrollFilters {
  return {
    ...filters,
    branchId: filters.branchId !== undefined ? filters.branchId : activeBranchId,
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 30,
  }
}

export const PAYROLL_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'calculated', label: 'Calculated' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'closed', label: 'Closed' },
  { value: 'recalculation_required', label: 'Recalculation required' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reversed', label: 'Reversed' },
] as const

export const PAYROLL_STATUS_VARIANT: Record<
  string,
  'success' | 'danger' | 'warning' | 'default' | 'info'
> = {
  draft: 'default',
  calculated: 'warning',
  reviewed: 'info',
  approved: 'success',
  payment_pending: 'warning',
  partially_paid: 'warning',
  paid: 'success',
  closed: 'default',
  recalculation_required: 'danger',
  cancelled: 'danger',
  reversed: 'danger',
}
