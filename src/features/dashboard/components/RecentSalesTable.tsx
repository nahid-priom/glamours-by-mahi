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
}

export function RecentSalesTable({ sales }: RecentSalesTableProps) {
  return (
    <DashboardSectionCard title="Recent Sales" action={{ label: 'View all', to: '/sales' }}>
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
                        className="font-semibold text-[#E11D48] hover:underline"
                      >
                        {invoice}
                      </Link>
                    </td>
                    <td className="py-2.5 text-slate-700">{customer}</td>
                    <td className="py-2.5 font-medium text-slate-900">{formatBDT(amount)}</td>
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
