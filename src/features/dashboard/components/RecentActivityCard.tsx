import {
  Banknote,
  Package,
  ShoppingBag,
  Truck,
  Wallet,
} from 'lucide-react'
import { formatRelativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { DashboardSectionCard } from './DashboardSectionCard'

interface Activity {
  id: string
  action: string
  userName: string
  details: string
  created_at: string
}

interface RecentActivityCardProps {
  activities: Activity[]
}

function activityIcon(action: string) {
  const a = action.toLowerCase()
  if (a.includes('sale') || a.includes('order')) return ShoppingBag
  if (a.includes('collection') || a.includes('payment')) return Banknote
  if (a.includes('purchase')) return Package
  if (a.includes('courier') || a.includes('ship')) return Truck
  return Wallet
}

function activityTone(action: string) {
  const a = action.toLowerCase()
  if (a.includes('sale')) return 'bg-emerald-50 text-emerald-600'
  if (a.includes('collection')) return 'bg-sky-50 text-sky-600'
  if (a.includes('purchase')) return 'bg-violet-50 text-violet-600'
  if (a.includes('courier')) return 'bg-amber-50 text-amber-600'
  if (a.includes('expense')) return 'bg-rose-50 text-rose-600'
  return 'bg-slate-50 text-slate-600'
}

export function RecentActivityCard({ activities }: RecentActivityCardProps) {
  return (
    <DashboardSectionCard title="Recent Activity" action={{ label: 'View all', to: '/settings' }}>
      <ul className="space-y-3">
        {activities.slice(0, 5).map((a) => {
          const Icon = activityIcon(a.action)
          return (
            <li key={a.id} className="flex gap-3">
              <span className={cn('mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full', activityTone(a.action))}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#111111]">{a.action}</p>
                <p className="truncate text-[11px] text-[#6B7280]">
                  {a.userName} · {a.details}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-[#6B7280]">
                {formatRelativeTime(a.created_at)}
              </span>
            </li>
          )
        })}
        {activities.length === 0 && (
          <p className="text-sm text-[#6B7280]">No recent activity.</p>
        )}
      </ul>
    </DashboardSectionCard>
  )
}
