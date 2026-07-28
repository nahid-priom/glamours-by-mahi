import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingBag,
  Boxes,
  Truck,
  Users,
  Warehouse,
  Building2,
  Wallet,
  UserCog,
  BarChart3,
  Settings,
  ChevronDown,
  Sparkles,
} from 'lucide-react'
import { BrandMark } from '@/components/brand/BrandMark'
import { PoweredByCodeBondhu } from '@/components/brand/PoweredByCodeBondhu'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-session'
import { hasAnyModuleAccess, hasPermission, type Permission } from '@/lib/permissions'

type NavItem = { to: string; label: string; end?: boolean; permission?: Permission | Permission[]; module?: string }
type NavGroup = {
  id: string
  label: string
  icon: typeof LayoutDashboard
  to?: string
  end?: boolean
  module?: string
  permission?: Permission | Permission[]
  children?: NavItem[]
}

const groups: NavGroup[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    to: '/dashboard',
    end: true,
    module: 'dashboard',
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingBag,
    module: 'sales',
    children: [
      { to: '/sales/pos', label: 'POS', permission: 'pos.create' },
      { to: '/sales', label: 'Sales History', end: true, permission: 'sales.read' },
      { to: '/sales/online-orders', label: 'Online Orders', permission: 'orders.read' },
      { to: '/sales/exchanges', label: 'Exchanges', permission: ['exchange.read', 'exchange.create'] },
      { to: '/sales/returns', label: 'Sales Returns', permission: ['sales.read', 'sales.return.review'] },
      { to: '/sales/collections', label: 'Due Collection', permission: 'sales.read' },
      { to: '/sales/held', label: 'Held Sales', permission: 'pos.create' },
    ],
  },
  {
    id: 'moderator',
    label: 'Moderator',
    icon: Sparkles,
    module: 'moderator',
    children: [
      {
        to: '/moderator',
        label: 'Dashboard',
        end: true,
        permission: 'moderator.dashboard.read',
      },
      {
        to: '/moderator/orders/new',
        label: 'New Order',
        permission: 'moderator.order.create',
      },
    ],
  },
  {
    id: 'inventory',
    label: 'Products & Inventory',
    icon: Boxes,
    module: 'products',
    children: [
      { to: '/products', label: 'Products', end: true, permission: 'products.read' },
      { to: '/products/categories', label: 'Categories', permission: 'products.read' },
      { to: '/products/subcategories', label: 'Subcategories', permission: 'products.read' },
      { to: '/products/brands', label: 'Brands', permission: 'products.read' },
      { to: '/products/variants', label: 'Variants', permission: 'products.read' },
      { to: '/inventory/stock', label: 'Inventory Overview', permission: 'inventory.read' },
      { to: '/inventory/ledger', label: 'Stock Ledger', permission: 'inventory.read' },
      { to: '/inventory/adjustments', label: 'Stock Adjustment', permission: 'inventory.adjust' },
      { to: '/inventory/transfers', label: 'Stock Transfer', permission: 'inventory.transfer' },
      { to: '/inventory/low-stock', label: 'Low Stock', permission: 'inventory.read' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: Warehouse,
    module: 'purchases',
    children: [
      { to: '/purchases/new', label: 'New Purchase', permission: 'purchases.create' },
      { to: '/purchases', label: 'Purchase History', end: true, permission: 'purchases.read' },
      { to: '/purchases/returns', label: 'Purchase Returns', permission: 'purchases.read' },
      { to: '/purchases/payments', label: 'Supplier Payments', permission: 'purchases.read' },
    ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: Building2,
    to: '/suppliers',
    module: 'suppliers',
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    to: '/customers',
    module: 'customers',
  },
  {
    id: 'courier',
    label: 'Courier',
    icon: Truck,
    module: 'courier',
    children: [
      { to: '/couriers', label: 'Courier Companies', end: true, permission: 'courier.read' },
      { to: '/couriers/parcels', label: 'Parcel Booking', permission: ['courier.manage', 'courier.book'] },
      { to: '/couriers/tracking', label: 'Delivery Tracking', permission: 'courier.read' },
      { to: '/couriers/returns', label: 'Return Requests', permission: 'sales.return.review' },
      { to: '/couriers/settlements', label: 'Courier Settlements', permission: ['courier.read', 'courier.settle'] },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Wallet,
    module: 'accounts',
    children: [
      { to: '/accounts', label: 'Accounts Dashboard', end: true, permission: 'accounts.read' },
      { to: '/accounts/cash-bank', label: 'Cash & Bank', permission: 'accounts.read' },
      { to: '/accounts/income', label: 'Income', permission: ['accounts.read', 'income.create'] },
      { to: '/accounts/expenses', label: 'Expenses', permission: ['accounts.read', 'expense.create'] },
      { to: '/accounts/customer-due', label: 'Customer Due', permission: ['accounts.read', 'customer_due.collect'] },
      { to: '/accounts/supplier-due', label: 'Supplier Due', permission: ['accounts.read', 'supplier_due.pay'] },
      { to: '/accounts/collections', label: 'Due Collection', permission: ['accounts.read', 'customer_due.collect', 'accounts.post'] },
      { to: '/accounts/supplier-payments', label: 'Supplier Payment', permission: ['accounts.read', 'supplier_due.pay', 'accounts.post'] },
      { to: '/accounts/daily-closing', label: 'Daily Closing', permission: ['accounts.read', 'daily_closing.create'] },
      { to: '/accounts/transactions', label: 'Transactions', permission: 'accounts.read' },
      { to: '/accounts/profit-loss', label: 'Profit & Loss', permission: ['accounts.read', 'profit_loss.read'] },
      {
        to: '/accounts/reconciliation',
        label: 'Reconciliation',
        permission: ['reconciliation.read', 'accounts.manage'],
      },
      { to: '/accounts/settings', label: 'Account Settings', permission: ['accounts.manage', 'account_settings.manage'] },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    icon: UserCog,
    module: 'hr',
    children: [
      { to: '/hr/employees', label: 'Employees' },
      { to: '/hr/attendance', label: 'Attendance' },
      { to: '/hr/leaves', label: 'Leave' },
      { to: '/hr/payroll', label: 'Payroll' },
      { to: '/hr/commissions', label: 'Commissions', permission: 'sales.commission.read' },
      { to: '/hr/commission-settings', label: 'Commission Settings', permission: 'sales.commission.manage' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    to: '/reports',
    module: 'reports',
  },
  {
    id: 'stores',
    label: 'Stores',
    icon: Building2,
    to: '/stores',
    module: 'stores',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    module: 'settings',
    children: [
      { to: '/settings', label: 'General', end: true, permission: 'settings.manage' },
      {
        to: '/settings/website',
        label: 'Website',
        permission: ['website.hero.read', 'website.manage', 'settings.manage'],
      },
    ],
  },
]

function itemAllowed(
  permissions: string[],
  item: { permission?: Permission | Permission[]; module?: string },
  parentModule?: string,
) {
  if (item.permission) return hasPermission(permissions, item.permission)
  if (item.module) return hasAnyModuleAccess(permissions, item.module)
  if (parentModule) return hasAnyModuleAccess(permissions, parentModule)
  return true
}

interface AppSidebarProps {
  onNavigate?: () => void
  className?: string
}

export function AppSidebar({ onNavigate, className }: AppSidebarProps) {
  const location = useLocation()
  const { permissions } = useAuth()

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => {
        if (!itemAllowed(permissions, group)) return null
        if (!group.children) return group
        const children = group.children.filter((c) => itemAllowed(permissions, c, group.module))
        if (!children.length) return null
        return { ...group, children }
      })
      .filter(Boolean) as NavGroup[]
  }, [permissions])

  const activeGroup = useMemo(() => {
    return visibleGroups.find((g) => {
      if (g.to && (g.end ? location.pathname === g.to : location.pathname.startsWith(g.to))) return true
      return g.children?.some((c) =>
        c.end ? location.pathname === c.to : location.pathname.startsWith(c.to),
      )
    })?.id
  }, [location.pathname, visibleGroups])

  const [expanded, setExpanded] = useState<string | null>(activeGroup ?? 'dashboard')

  return (
    <aside
      className={cn('flex h-full w-[260px] min-w-0 flex-col bg-sidebar text-white', className)}
      style={{ background: 'linear-gradient(180deg, #0B0F15 0%, #111827 100%)' }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <div className="brand-gradient-border flex h-9 w-9 items-center justify-center rounded-xl bg-[#E11D48]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <BrandMark variant="compact" light animate className="flex-1" />
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {visibleGroups.map((group) => {
          const Icon = group.icon
          const isOpen = expanded === group.id
          if (!group.children) {
            return (
              <NavLink
                key={group.id}
                to={group.to!}
                end={group.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-[#E11D48] to-[#ef4444] text-white shadow-lg shadow-primary/20'
                      : 'text-white/60 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{group.label}</span>
              </NavLink>
            )
          }

          return (
            <div key={group.id} className="pt-1">
              <button
                type="button"
                onClick={() => setExpanded((prev) => (prev === group.id ? null : group.id))}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isOpen || activeGroup === group.id
                    ? 'bg-white/10 text-white'
                    : 'text-white/60 hover:bg-white/5 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">{group.label}</span>
                <ChevronDown className={cn('h-4 w-4 transition', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="ml-3 space-y-0.5 border-l border-white/10 pl-3 pt-1">
                  {group.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end={child.end}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'block rounded-lg px-3 py-2 text-xs font-medium transition',
                          isActive ? 'bg-[#E11D48] text-white' : 'text-white/55 hover:bg-white/5 hover:text-white',
                        )
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="mx-3 mb-3 mt-auto rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
        <PoweredByCodeBondhu size="xs" className="text-white/45 [&_.brand-gradient-text]:text-[10px]" />
      </div>
    </aside>
  )
}
