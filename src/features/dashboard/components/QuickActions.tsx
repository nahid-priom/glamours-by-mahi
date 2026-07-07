import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Truck, FileText, Package, ShieldAlert, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { QuickActionCard, type QuickActionCardProps } from './QuickActionCard'

const QUICK_ACTIONS: QuickActionCardProps[] = [
  {
    title: 'New Order',
    route: '/orders/new',
    icon: Plus,
    color: 'red',
  },
  {
    title: 'Book Courier',
    route: '/orders?quick=book-courier',
    icon: Truck,
    color: 'blue',
  },
  {
    title: 'A4 Invoice',
    route: '/orders?quick=invoice',
    icon: FileText,
    color: 'indigo',
  },
  {
    title: 'Shipping Label',
    route: '/orders?quick=shipping-label',
    icon: Package,
    color: 'cyan',
  },
  {
    title: 'Fraud Check',
    route: '/fraud',
    icon: ShieldAlert,
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
          <p className="mt-0.5 text-xs text-slate-500">
            Most used actions for daily order operations
          </p>
        </div>
        <Link to="/orders" className="shrink-0">
          <Button variant="ghost" size="sm" className="text-xs text-slate-600">
            View All
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
