import { formatBDT } from '@/lib/format'
import { DashboardSectionCard } from './DashboardSectionCard'

interface BranchPerformanceCardProps {
  branches: {
    id: string
    name: string
    sales: number
    collection: number
    profit: number
  }[]
}

export function BranchPerformanceCard({ branches }: BranchPerformanceCardProps) {
  const maxSales = Math.max(...branches.map((b) => b.sales), 1)

  return (
    <DashboardSectionCard title="Branch Performance" action={{ label: 'View all', to: '/settings' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wide text-[#6B7280]">
              <th className="pb-2 font-medium">Branch</th>
              <th className="pb-2 font-medium">Sales</th>
              <th className="pb-2 font-medium">Collection</th>
              <th className="pb-2 font-medium">Profit</th>
            </tr>
          </thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id} className="border-t border-[#F1F5F9]">
                <td className="py-2.5 pr-2">
                  <p className="font-medium text-[#111111]">{b.name}</p>
                  <div className="mt-1 h-1.5 w-full max-w-[120px] overflow-hidden rounded-full bg-[#F1F5F9]">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.round((b.sales / maxSales) * 100)}%` }}
                    />
                  </div>
                </td>
                <td className="py-2.5 text-xs font-medium">{formatBDT(b.sales)}</td>
                <td className="py-2.5 text-xs">{formatBDT(b.collection)}</td>
                <td className="py-2.5 text-xs font-semibold text-emerald-600">{formatBDT(b.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardSectionCard>
  )
}
