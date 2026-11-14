import { useMemo } from 'react'
import {
  BarChart3,
  PackagePlus,
  ShoppingBag,
  Truck,
  UserPlus,
  Warehouse,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/features/auth/auth-session'
import { hasPermission, type Permission } from '@/lib/permissions'
import { QuickActionCard, type QuickActionCardProps } from './QuickActionCard'
import { DashboardSectionCard } from './DashboardSectionCard'

type ActionDef = QuickActionCardProps & { permission?: Permission | Permission[] }

const QUICK_ACTIONS: ActionDef[] = [
  {
    title: 'New Sale (POS)',
    route: '/sales/pos',
    icon: ShoppingBag,
    color: 'red',
    featured: true,
    permission: 'pos.create',
  },
  {
    title: 'Add Product',
    route: '/products/new',
    icon: PackagePlus,
    color: 'blue',
    permission: ['products.create', 'products.read'],
  },
  {
    title: 'New Purchase',
    route: '/purchases/new',
    icon: Truck,
    color: 'indigo',
    permission: 'purchases.create',
  },
  {
    title: 'Add Customer',
    route: '/customers/new',
    icon: UserPlus,
    color: 'cyan',
    permission: ['customers.manage', 'customers.read'],
  },
  {
    title: 'Stock Update',
    route: '/inventory/adjustments',
    icon: Warehouse,
    color: 'orange',
    permission: 'inventory.adjust',
  },
  {
    title: 'View Reports',
    route: '/reports',
    icon: BarChart3,
    color: 'purple',
    permission: 'reports.read',
  },
]

export function QuickActions() {
  const { permissions } = useAuth()

  const actions = useMemo(
    () =>
      QUICK_ACTIONS.filter((a) =>
        a.permission ? hasPermission(permissions, a.permission) : true,
      ),
    [permissions],
  )

  if (!actions.length) return null

  return (
    <DashboardSectionCard
      className="h-auto"
      bodyClassName="!flex-none"
      title={
        <span className="inline-flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-[#E11D48]" aria-hidden />
          Quick Actions
        </span>
      }
    >
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
        {actions.map((action) => (
          <QuickActionCard key={action.title} {...action} />
        ))}
      </div>
    </DashboardSectionCard>
  )
}
