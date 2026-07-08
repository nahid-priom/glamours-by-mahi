import { NavLink } from 'react-router-dom'
import { Home, LayoutGrid, Heart, ShoppingBag, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'

const items = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/shop', label: 'Shop', icon: LayoutGrid, end: false },
  { to: '/account/wishlist', label: 'Wishlist', icon: Heart, end: false },
  { to: '/cart', label: 'Cart', icon: ShoppingBag, end: false, isCart: true },
  { to: '/account', label: 'Account', icon: User, end: false },
]

export function MobileBottomNav() {
  const { itemCount } = useCart()
  const { openCart } = useStorefrontUI()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#111111]/5 bg-white/95 backdrop-blur-md lg:hidden">
      <div className="flex items-center justify-around px-1 py-2">
        {items.map(({ to, label, icon: Icon, end, isCart }) =>
          isCart ? (
            <button
              key={label}
              type="button"
              onClick={openCart}
              className="relative flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium text-[#6B7280]"
            >
              <Icon className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 top-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#111111] text-[9px] text-white">
                  {itemCount}
                </span>
              )}
              <span>{label}</span>
            </button>
          ) : (
            <NavLink
              key={label}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-medium',
                  isActive ? 'text-[#111111]' : 'text-[#6B7280]',
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}
