import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, ShoppingBag, Boxes, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

const items = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/sales/new', label: 'New Sale', icon: ShoppingBag },
  { to: '/orders', label: 'Orders', icon: Package },
  { to: '/inventory/branch-stock', label: 'Stock', icon: Boxes },
  { to: '/settings', label: 'More', icon: MoreHorizontal },
]

export function MobileBottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="flex items-center justify-around px-1 py-1.5">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              cn(
                'flex min-w-0 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-text-muted',
              )
            }
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
