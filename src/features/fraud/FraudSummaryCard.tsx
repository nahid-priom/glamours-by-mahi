import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatNumber } from '@/lib/format'
import type { FraudSummary } from '@/types'
import { Shield, ShieldAlert, ShieldCheck, ShieldX, Phone } from 'lucide-react'

interface FraudSummaryCardProps {
  data: FraudSummary
}

const items = [
  { key: 'safe' as const, label: 'Safe Customers', icon: ShieldCheck, color: 'text-success bg-green-50' },
  { key: 'medium' as const, label: 'Medium Risk', icon: Shield, color: 'text-warning bg-amber-50' },
  { key: 'high' as const, label: 'High Risk', icon: ShieldAlert, color: 'text-danger bg-red-50' },
  { key: 'blocked' as const, label: 'Blocked', icon: ShieldX, color: 'text-white bg-red-900' },
  { key: 'needs_call' as const, label: 'Needs Call Confirmation', icon: Phone, color: 'text-blue-600 bg-blue-50' },
]

export function FraudSummaryCard({ data }: FraudSummaryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Fraud Checker Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {items.map(({ key, label, icon: Icon, color }) => (
            <div key={key} className="flex items-center gap-2 rounded-xl border border-border p-2.5">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs text-text-muted">{label}</p>
                <p className="text-sm font-bold">{formatNumber(data[key])}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
