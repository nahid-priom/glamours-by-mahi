import { Link, useLocation } from 'react-router-dom'
import {
  Heart,
  LayoutDashboard,
  LogOut,
  MapPin,
  Package,
  Search,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAccount } from './account.context'
import { getInitials } from './account.service'

const NAV = [
  { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package, end: false },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart, end: false },
  { to: '/account/profile', label: 'Profile', icon: User, end: false },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin, end: false },
  { to: '/track-order', label: 'Track Order', icon: Search, end: false, external: true },
] as const

export function AccountSidebar() {
  const location = useLocation()
  const { session, logout } = useAccount()

  if (!session) return null

  const initials = getInitials(session.name || 'Customer')

  return (
    <aside className="hidden shrink-0 lg:block lg:w-[280px]">
      <div className="sticky top-[88px] rounded-3xl border border-[var(--sf-border)] bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--sf-primary)] font-serif text-lg text-white">
            {initials || 'RS'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-[var(--sf-ink)]">{session.name || 'Customer'}</p>
            <p className="truncate text-sm text-[var(--sf-muted)]">{session.phone}</p>
          </div>
        </div>

        <span className="mt-4 inline-flex rounded-full bg-[var(--sf-primary-soft)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--sf-primary)]">
          COD Customer
        </span>

        <nav className="mt-6 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => {
            const active = end ? location.pathname === to : location.pathname.startsWith(to)
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition',
                  active
                    ? 'bg-[var(--sf-primary)] text-white'
                    : 'text-[var(--sf-muted)] hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary)]',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={logout}
          className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-[var(--sf-border)] px-3 py-2.5 text-sm font-medium text-[var(--sf-muted)] transition hover:border-[var(--sf-primary)]/30 hover:text-[var(--sf-primary)]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export function AccountMobileTabs() {
  const location = useLocation()

  const tabs = NAV.filter((item) => item.to !== '/track-order')

  return (
    <nav className="scrollbar-hide -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 lg:hidden">
      {tabs.map(({ to, label, end }) => {
        const active = end ? location.pathname === to : location.pathname.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition',
              active
                ? 'bg-[#22171C] text-white'
                : 'border border-[#22171C]/10 bg-white text-[#6B7280]',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
