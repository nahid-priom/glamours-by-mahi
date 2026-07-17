import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { Heart, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { STOREFRONT_BRAND, STOREFRONT_CATEGORIES } from '@/lib/constants'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { PWAInstallButton } from '@/features/pwa'
import { UtilityBar } from './UtilityBar'

const NAV = [
  { to: '/category/new-arrival', label: 'New Arrivals' },
  { to: '/category/dress', label: 'Dress' },
  { to: '/shop', label: 'Beauty' },
]

export function StoreHeader() {
  const { itemCount, total, wishlistIds } = useCart()
  const { openSearch, openCart } = useStorefrontUI()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300',
          scrolled
            ? 'border-b border-[var(--sf-border)] bg-[var(--sf-bg)]/95 shadow-[0_8px_30px_-12px_rgba(255,63,127,0.18)] backdrop-blur-md'
            : 'bg-[var(--sf-bg)]/90 backdrop-blur-sm',
        )}
        style={{
          top: 'calc(var(--pwa-install-bar-height, 0px) + env(safe-area-inset-top, 0px))',
        }}
      >
        <UtilityBar />

        <div className="sf-container flex max-w-[1440px] items-center gap-3 py-2.5 sm:gap-4 sm:py-3">
          <button
            type="button"
            className="-ml-1 rounded-lg p-2 text-[var(--sf-ink)] lg:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link
            to="/"
            className="hidden shrink-0 font-serif tracking-[0.12em] text-[var(--sf-ink)] sm:block sm:text-xl"
          >
            {STOREFRONT_BRAND}
          </Link>

          <button
            type="button"
            onClick={openSearch}
            className="hidden min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--sf-border)] bg-white px-4 py-2.5 text-left text-sm text-[var(--sf-muted)] transition hover:border-[var(--sf-primary)] md:flex"
            aria-label="Search products"
          >
            <Search className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" />
            <span className="truncate">Search products, brands, categories...</span>
          </button>

          <nav className="ml-auto hidden items-center gap-5 xl:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'text-[13px] font-semibold transition',
                    isActive
                      ? 'text-[var(--sf-primary)]'
                      : 'text-[var(--sf-muted)] hover:text-[var(--sf-primary)]',
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
              <button
                type="button"
                className="text-[13px] font-semibold text-[var(--sf-muted)] hover:text-[var(--sf-primary)]"
              >
                Categories
              </button>
              {megaOpen ? (
                <div className="absolute left-1/2 top-full z-50 mt-3 w-[440px] -translate-x-1/2 rounded-2xl border border-[var(--sf-border)] bg-white p-5 shadow-[0_20px_60px_-20px_rgba(255,63,127,0.25)]">
                  <div className="grid grid-cols-2 gap-1">
                    {STOREFRONT_CATEGORIES.map((c) => (
                      <Link
                        key={c.slug}
                        to={`/category/${c.slug}`}
                        className="rounded-xl px-3 py-2.5 text-sm text-[var(--sf-muted)] transition hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary)]"
                      >
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1 xl:ml-2">
            <button
              type="button"
              onClick={openSearch}
              className="rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)] md:hidden"
              aria-label="Search"
            >
              <Search className="h-5 w-5" />
            </button>
            <PWAInstallButton />
            <Link
              to="/account"
              className="hidden rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)] sm:block"
              aria-label="Account"
            >
              <User className="h-5 w-5" />
            </Link>
            <Link
              to="/account/wishlist"
              className="relative rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)]"
              aria-label="Wishlist"
            >
              <Heart className="h-5 w-5" />
              {wishlistIds.size > 0 ? (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] text-[9px] font-bold text-white">
                  {wishlistIds.size}
                </span>
              ) : null}
            </Link>
            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center gap-2 rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)]"
              aria-label="Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="hidden text-sm font-semibold lg:inline">{formatBDT(total)}</span>
              {itemCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] text-[9px] font-bold text-white lg:static lg:ml-0 lg:h-5 lg:w-5 lg:text-[10px]">
                  {itemCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--sf-ink)]/40"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(320px,88vw)] flex-col bg-[var(--sf-bg)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--sf-border)] px-5 py-4">
              <span className="font-serif tracking-widest text-[var(--sf-ink)]">{STOREFRONT_BRAND}</span>
              <button type="button" onClick={() => setMenuOpen(false)} aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
                Shop
              </p>
              {NAV.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="block rounded-xl px-3 py-3 text-sm font-semibold text-[var(--sf-ink)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <p className="mt-4 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
                Categories
              </p>
              {STOREFRONT_CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  to={`/category/${c.slug}`}
                  className="block rounded-xl px-3 py-2.5 text-sm text-[var(--sf-muted)]"
                  onClick={() => setMenuOpen(false)}
                >
                  {c.label}
                </Link>
              ))}
              <div className="mt-4 space-y-1 border-t border-[var(--sf-border)] pt-3">
                <Link
                  to="/track-order"
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  Track order
                </Link>
                <Link
                  to="/account"
                  className="block rounded-xl px-3 py-2.5 text-sm font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  My account
                </Link>
                <PWAInstallButton variant="menu" onAfterClick={() => setMenuOpen(false)} />
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
