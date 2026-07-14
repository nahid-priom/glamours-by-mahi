import { useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
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
import { brandConfig } from '@/config/brand'
import { cn } from '@/lib/utils'

type NavItem = { to: string; label: string; end?: boolean }
type NavGroup = {
  id: string
  label: string
  icon: typeof LayoutDashboard
  to?: string
  end?: boolean
  children?: NavItem[]
}

const groups: NavGroup[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard', end: true },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingBag,
    children: [
      { to: '/sales/new', label: 'POS / New Sale' },
      { to: '/sales', label: 'Sales List', end: true },
      { to: '/sales/returns', label: 'Returns' },
      { to: '/sales/collections', label: 'Collections' },
      { to: '/sales/commissions', label: 'Commission' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: Package,
    children: [
      { to: '/orders', label: 'All Orders', end: true },
      { to: '/orders/new', label: 'New Order' },
    ],
  },
  {
    id: 'inventory',
    label: 'Products & Inventory',
    icon: Boxes,
    children: [
      { to: '/products', label: 'Products', end: true },
      { to: '/inventory/branch-stock', label: 'Branch Stock' },
      { to: '/inventory/transfers', label: 'Transfers' },
      { to: '/inventory/adjustments', label: 'Adjustments' },
      { to: '/inventory/low-stock', label: 'Low Stock' },
      { to: '/inventory/ledger', label: 'Stock Ledger' },
    ],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: Warehouse,
    children: [
      { to: '/purchases', label: 'Purchase List', end: true },
      { to: '/purchases/new', label: 'New Purchase' },
      { to: '/purchases/returns', label: 'Purchase Returns' },
    ],
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    icon: Building2,
    children: [
      { to: '/suppliers', label: 'Supplier List', end: true },
      { to: '/suppliers/new', label: 'Add Supplier' },
    ],
  },
  { id: 'customers', label: 'Customers', icon: Users, to: '/customers' },
  {
    id: 'courier',
    label: 'Courier',
    icon: Truck,
    children: [
      { to: '/couriers', label: 'Couriers', end: true },
      { to: '/couriers/settlements', label: 'Settlements' },
      { to: '/couriers/returns', label: 'Returns' },
    ],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Wallet,
    children: [
      { to: '/accounts', label: 'Overview', end: true },
      { to: '/accounts/cashbook', label: 'Cashbook' },
      { to: '/accounts/banks', label: 'Bank' },
      { to: '/accounts/mobile-banking', label: 'Mobile Banking' },
      { to: '/accounts/income', label: 'Income' },
      { to: '/accounts/expenses', label: 'Expenses' },
      { to: '/accounts/customer-dues', label: 'Customer Due' },
      { to: '/accounts/supplier-dues', label: 'Supplier Due' },
      { to: '/accounts/profit-loss', label: 'Profit & Loss' },
      { to: '/accounts/daily-closing', label: 'Daily Closing' },
    ],
  },
  {
    id: 'hr',
    label: 'HR & Payroll',
    icon: UserCog,
    children: [
      { to: '/hr/employees', label: 'Employees' },
      { to: '/hr/attendance', label: 'Attendance' },
      { to: '/hr/leaves', label: 'Leave' },
      { to: '/hr/payroll', label: 'Payroll' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: BarChart3,
    children: [
      { to: '/reports', label: 'Overview', end: true },
      { to: '/reports/sales', label: 'Sales' },
      { to: '/reports/products', label: 'Products' },
      { to: '/reports/branches', label: 'Branches' },
      { to: '/reports/inventory', label: 'Inventory' },
      { to: '/reports/accounts', label: 'Accounts' },
      { to: '/reports/hr', label: 'HR' },
    ],
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    children: [
      { to: '/settings', label: 'General', end: true },
      { to: '/stores', label: 'Branches / Stores' },
      { to: '/fraud', label: 'Fraud Checker' },
      { to: '/invoices', label: 'Invoices' },
    ],
  },
]

interface AppSidebarProps {
  onNavigate?: () => void
  className?: string
}

export function AppSidebar({ onNavigate, className }: AppSidebarProps) {
  const location = useLocation()
  const activeGroup = useMemo(() => {
    return groups.find((g) => {
      if (g.to && (g.end ? location.pathname === g.to : location.pathname.startsWith(g.to))) return true
      return g.children?.some((c) =>
        c.end ? location.pathname === c.to : location.pathname.startsWith(c.to),
      )
    })?.id
  }, [location.pathname])

  const [expanded, setExpanded] = useState<string | null>(activeGroup ?? 'dashboard')

  const toggle = (id: string) => {
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <aside
      className={cn('flex h-full w-[260px] flex-col bg-sidebar text-white', className)}
      style={{ background: 'linear-gradient(180deg, #0B0F15 0%, #111827 100%)' }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E11D48]">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-bold leading-tight">{brandConfig.shortName}</h1>
          <p className="truncate text-[10px] text-white/50">by Mahi · Retail ERP</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {groups.map((group) => {
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
                onClick={() => toggle(group.id)}
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
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">{brandConfig.primaryLocation}</p>
        <p className="mt-1 text-xs font-semibold text-white/80">{brandConfig.name}</p>
      </div>
    </aside>
  )
}
