import type { SaleCommissionAuditRow } from '../../repositories/commissions.repository'

export function contributorLabel(row: Pick<SaleCommissionAuditRow, 'employee_name' | 'employee_code' | 'profile_name'>) {
  if (row.employee_name) {
    return row.employee_code ? `${row.employee_name} (${row.employee_code})` : row.employee_name
  }
  if (row.profile_name) return row.profile_name
  return 'Unassigned'
}

export function commissionStatusLabel(status: string, reversedAmount = 0) {
  if (status === 'cancelled') return 'Rejected'
  if (status === 'reversed') return 'Reversed'
  if (reversedAmount > 0 && (status === 'pending' || status === 'approved' || status === 'paid')) {
    return 'Partially reversed'
  }
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export function commissionStatusClass(status: string, reversedAmount = 0) {
  if (status === 'cancelled') return 'bg-rose-50 text-rose-800'
  if (status === 'reversed') return 'bg-rose-100 text-rose-900'
  if (reversedAmount > 0) return 'bg-amber-100 text-amber-900'
  if (status === 'pending') return 'bg-amber-50 text-amber-800'
  if (status === 'approved') return 'bg-blue-100 text-blue-900'
  if (status === 'paid') return 'bg-emerald-100 text-emerald-900'
  return 'bg-[#F3F4F6] text-[#374151]'
}

export function buildCommissionTimeline(rows: SaleCommissionAuditRow[]) {
  const events: Array<{ id: string; at: string; label: string }> = []
  for (const row of rows) {
    const who = contributorLabel(row)
    events.push({
      id: `${row.id}-accrued`,
      at: row.created_at,
      label: `Accrued ${who} · ${row.status}`,
    })
    if (row.approved_at) {
      events.push({
        id: `${row.id}-approved`,
        at: row.approved_at,
        label: `Approved ${who}`,
      })
    }
    if (row.paid_at) {
      events.push({
        id: `${row.id}-paid`,
        at: row.paid_at,
        label: `Paid ${who}`,
      })
    }
    if (Number(row.reversed_amount ?? 0) > 0) {
      events.push({
        id: `${row.id}-reversed`,
        at: row.paid_at ?? row.approved_at ?? row.created_at,
        label: `Reversed residual for ${who}`,
      })
    }
  }
  return events.sort((a, b) => a.at.localeCompare(b.at))
}
