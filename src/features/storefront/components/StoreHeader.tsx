import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { STOREFRONT_BRAND, STOREFRONT_CATEGORIES } from '@/lib/constants'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'

const NAV = [
  { to: '/shop', label: 'Shop' },
  { to: '/category/new-arrival', label: 'New In' },
  { to: '/category/dress', label: 'Dresses' },
  { to: '/category/co-ord-set', label: 'Co-ords' },
  { to: '/category/sale', label: 'Sale' },
]

export function StoreHeader() {
  const { itemCount, total, wishlistIds } = useCart()
  const { openSearch, openCart } = useStorefrontUI()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 top-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-[#111111]/5 bg-[#F8F6F2]/95 py-2 shadow-[0_4px_30px_-10px_rgba(17,17,17,0.08)] backdrop-blur-md'
            : 'bg-transparent py-4',
        )}
      >
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="-ml-2 rounded-lg p-2 lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link
              to="/"
              className={cn(
                'font-serif tracking-[0.2em] text-[#111111] transition-all',
                scrolled ? 'text-lg' : 'text-lg sm:text-2xl',
              )}
            >
              {STOREFRONT_BRAND}
            </Link>
          </div>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'text-sm font-medium transition',
                    isActive ? 'text-[#111111]' : 'text-[#6B7280] hover:text-[#111111]',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <button type="button" className="text-sm font-medium text-[#6B7280] hover:text-[#111111]">
                Categories
              </button>
              {megaOpen && (
                <div className="absolute left-1/2 top-full z-50 mt-3 w-[480px] -translate-x-1/2 rounded-2xl bg-white p-6 shadow-[0_20px_60px_-15px_rgba(17,17,17,0.15)]">
                  <div className="grid grid-cols-2 gap-2">
                    {STOREFRONT_CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/category/${c.slug}`}
                        className="rounded-xl px-3 py-2.5 text-sm text-[#6B7280] transition hover:bg-[#F8F6F2] hover:text-[#111111]"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </nav>

          <div className="flex items-center gap-1 sm:gap-2">
            <button type="button" onClick={openSearch} className="rounded-full p-2.5 hover:bg-white/60" aria-label="Search">
              <Search className="h-5 w-5" />
            </button>
            <Link to="/account" className="hidden rounded-full p-2.5 hover:bg-white/60 sm:block" aria-label="Account">
              <User className="h-5 w-5" />
            </Link>
            <Link to="/account" className="relative hidden rounded-full p-2.5 hover:bg-white/60 sm:block" aria-label="Wishlist">
              <Heart className="h-5 w-5" />
              {wishlistIds.size > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E11D48] text-[9px] font-bold text-white">
                  {wishlistIds.size}
                </span>
              )}
            </Link>
            <button type="button" onClick={openCart} className="relative flex items-center gap-2 rounded-full p-2.5 hover:bg-white/60">
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden text-sm font-medium lg:inline">{formatBDT(total)}</span>
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#111111] text-[9px] font-bold text-white lg:static lg:ml-0 lg:h-5 lg:w-5 lg:text-xs">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />
          <div className="absolute left-0 top-0 flex h-full w-[300px] flex-col bg-[#F8F6F2]">
            <div className="flex items-center justify-between border-b border-[#111111]/5 px-5 py-4">
              <span className="font-serif tracking-widest">{STOREFRONT_BRAND}</span>
              <button type="button" onClick={() => setMenuOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              {NAV.map((item) => (
                <Link key={item.to} to={item.to} className="block rounded-xl px-3 py-3 text-sm font-medium" onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ))}
              <p className="mt-4 px-3 text-[10px] uppercase tracking-widest text-[#6B7280]">Categories</p>
              {STOREFRONT_CATEGORIES.map((c) => (
                <Link key={c.slug} to={`/category/${c.slug}`} className="block rounded-xl px-3 py-2.5 text-sm text-[#6B7280]" onClick={() => setMenuOpen(false)}>
                  {c.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
