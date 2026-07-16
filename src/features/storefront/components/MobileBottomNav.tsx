import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, Heart, Search, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/shop', label: 'Categories', icon: LayoutGrid, end: false },
  { to: '/search', label: 'Search', icon: Search, end: false, isSearch: true },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart, end: false },
  { to: '/cart', label: 'Cart', icon: ShoppingBag, end: false, isCart: true },
]

export function MobileBottomNav() {
  const { itemCount, wishlistIds } = useCart()
  const { openCart, openSearch } = useStorefrontUI()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--sf-border)] bg-white/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Primary"
    >
      <div className="flex items-center justify-around px-1 py-2">
        {items.map(({ to, label, icon: Icon, end, isCart, isSearch }) => {
          if (isCart) {
            return (
              <button
                key={label}
                type="button"
                onClick={openCart}
                className="relative flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold text-[var(--sf-muted)]"
              >
                <Icon className="h-5 w-5" />
                {itemCount > 0 ? (
                  <span className="absolute right-1 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] text-[9px] text-white">
                    {itemCount}
                  </span>
                ) : null}
                <span>{label}</span>
              </button>
            )
          }
          if (isSearch) {
            return (
              <button
                key={label}
                type="button"
                onClick={openSearch}
                className="flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold text-[var(--sf-muted)]"
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            )
          }
          return (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'relative flex min-w-[56px] flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold',
                  isActive ? 'text-[var(--sf-primary)]' : 'text-[var(--sf-muted)]',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label === 'Wishlist' && wishlistIds.size > 0 ? (
                <span className="absolute right-1 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] text-[9px] text-white">
                  {wishlistIds.size}
                </span>
              ) : null}
              <span>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
