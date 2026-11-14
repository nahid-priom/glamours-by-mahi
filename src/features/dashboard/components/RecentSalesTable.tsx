import { FileText } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBDT, formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DashboardSectionCard } from './DashboardSectionCard'

export type RecentSaleRow = {
  id: string
  invoiceNo?: string
  customerName?: string
  amount?: number
  paymentStatus?: string
  created_at: string
  details?: string
  userName?: string
}

interface RecentSalesTableProps {
  sales: RecentSaleRow[]
  compact?: boolean
}

export function RecentSalesTable({ sales, compact = false }: RecentSalesTableProps) {
  if (compact) {
    return (
      <Link
        to="/sales"
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF1F2] text-[#E11D48]">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Recent Sales</p>
          <p className="text-xs text-slate-500">
            {sales.length ? `${sales.length} recent invoice(s)` : 'No recent sales'}
          </p>
        </div>
        <span className="text-xs font-semibold text-[#E11D48]">View All ›</span>
      </Link>
    )
  }

  return (
    <DashboardSectionCard title="Recent Sales" action={{ label: 'View All', to: '/sales' }}>
      {sales.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">No recent sales.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                <th className="pb-2 font-medium">Invoice</th>
                <th className="pb-2 font-medium">Customer</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {sales.slice(0, 6).map((s) => {
                const invoice = s.invoiceNo ?? s.details?.split('·')[0]?.trim() ?? '—'
                const customer = s.customerName ?? s.userName ?? 'Walk-in'
                const amount =
                  typeof s.amount === 'number'
                    ? s.amount
                    : Number(String(s.details ?? '').replace(/[^\d.]/g, '')) || 0
                const status = s.paymentStatus ?? 'Paid'
                const due = /due/i.test(status)
                return (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5">
                      <Link
                        to={`/sales/${s.id}`}
                        className="inline-flex rounded-full bg-[#FFF1F2] px-2.5 py-0.5 text-xs font-semibold text-[#E11D48] hover:bg-[#FFE4E6]"
                      >
                        {invoice}
                      </Link>
                    </td>
                    <td className="py-2.5 text-slate-700">{customer}</td>
                    <td className="py-2.5 font-medium tabular-nums text-slate-900">
                      {formatBDT(amount)}
                    </td>
                    <td className="py-2.5">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                          due ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700',
                        )}
                      >
                        {status}
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400">
                      {formatRelativeTime(s.created_at)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardSectionCard>
  )
}
