import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingBag, Truck, FileText, RotateCcw, Wallet, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickActionCard, type QuickActionCardProps } from './QuickActionCard'

const QUICK_ACTIONS: QuickActionCardProps[] = [
  {
    title: 'Open POS',
    route: '/sales/pos',
    icon: ShoppingBag,
    color: 'red',
  },
  {
    title: 'Book Parcel',
    route: '/couriers/parcels',
    icon: Truck,
    color: 'blue',
  },
  {
    title: 'Sales History',
    route: '/sales',
    icon: FileText,
    color: 'indigo',
  },
  {
    title: 'Sales Returns',
    route: '/sales/returns',
    icon: RotateCcw,
    color: 'cyan',
  },
  {
    title: 'Due Collect',
    route: '/sales/collections',
    icon: Wallet,
    color: 'orange',
  },
  {
    title: 'Reports',
    route: '/reports',
    icon: BarChart3,
    color: 'purple',
  },
]

export function QuickActions() {
  const actions = useMemo(() => QUICK_ACTIONS, [])

  return (
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Quick Actions</h2>
          <p className="mt-0.5 text-xs text-slate-500">Daily retail operations</p>
        </div>
        <Link to="/sales" className="shrink-0">
          <Button variant="ghost" size="sm" className="text-xs text-slate-600">
            View Sales
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {actions.map((action) => (
          <QuickActionCard key={action.title} {...action} />
        ))}
      </div>
    </section>
  )
}
