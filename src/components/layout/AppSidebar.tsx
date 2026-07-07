import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  Store,
  Truck,
  Users,
  ShoppingBag,
  ShieldAlert,
  FileText,
  BarChart3,
  Settings,
  Zap,
} from 'lucide-react'
import { APP_NAME } from '@/lib/constants'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/stores', label: 'Stores', icon: Store },
  { to: '/couriers', label: 'Couriers', icon: Truck },
  { to: '/customers', label: 'Customers', icon: Users },
  { to: '/products', label: 'Products', icon: ShoppingBag },
  { to: '/fraud', label: 'Fraud Checker', icon: ShieldAlert },
  { to: '/invoices', label: 'Invoices', icon: FileText },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface AppSidebarProps {
  onNavigate?: () => void
  className?: string
}

export function AppSidebar({ onNavigate, className }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        'flex h-full w-[260px] flex-col bg-sidebar text-white',
        className,
      )}
      style={{ background: 'linear-gradient(180deg, #0B0F15 0%, #111827 100%)' }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold leading-tight">{APP_NAME}</h1>
          <p className="text-[10px] text-white/50">Order Management</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-gradient-to-r from-primary-dark to-primary text-white shadow-lg shadow-primary/20'
                  : 'text-white/60 hover:bg-white/5 hover:text-white',
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-brand-credit mx-3 mb-3 mt-auto shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400">
          Powered by
        </p>
        <p className="animated-brand-text mt-2 text-sm font-black tracking-wide">
          CODE BONDHU IT
        </p>
      </div>
    </aside>
  )
}
