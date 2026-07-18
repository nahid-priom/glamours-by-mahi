import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  Heart,
  LayoutGrid,
  Menu,
  Search,
  ShoppingBag,
  User,
  X,
} from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useCart } from '../cart.context'
import { useStorefrontUI } from '../storefront-ui.context'
import { useMenuCategories } from '../hooks/useMenuCategories'
import { useOnClickOutside } from '../hooks/useOnClickOutside'
import { PWAInstallButton } from '@/features/pwa'
import { UtilityBar } from './UtilityBar'
import { categoryShopUrl } from '../lib/category-links'
import { CategoryMegaMenu } from './CategoryMegaMenu'
import { HeaderSearch } from './HeaderSearch'

const MEGA_MENU_ID = 'storefront-category-menu'

function BrandLogo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="Glamours Gallery by Mahi — home"
      className={cn(
        'block w-[150px] shrink-0 whitespace-nowrap text-[var(--sf-ink)] sm:w-[190px]',
        'rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-primary)]/50',
        className,
      )}
    >
      <span className="block text-[8px] font-semibold uppercase leading-none tracking-[0.32em] text-[var(--sf-muted)] sm:text-[10px]">
        Glamours Gallery
      </span>
      <span className="mt-0.5 block font-serif text-xl font-semibold leading-none tracking-[0.24em] sm:text-2xl">
        BY MAHI
      </span>
    </Link>
  )
}

export function StoreHeader() {
  const { itemCount, total, wishlistIds } = useCart()
  const { openSearch, openCart } = useStorefrontUI()
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [megaOpen, setMegaOpen] = useState(false)
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null)
  const categoriesTriggerRef = useRef<HTMLButtonElement>(null)
  const megaWrapperRef = useRef<HTMLDivElement>(null)

  const { data: menuCategories = [] } = useMenuCategories()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close menu + drawer after any route navigation.
  useEffect(() => {
    setMegaOpen(false)
    setDrawerOpen(false)
  }, [location.pathname, location.search])

  // Escape closes the mobile navigation drawer.
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const closeMega = useCallback(() => setMegaOpen(false), [])

  const dismissMega = useCallback(() => {
    setMegaOpen(false)
    categoriesTriggerRef.current?.focus()
  }, [])

  // Close the desktop mega menu on any pointer press outside the trigger+menu.
  useOnClickOutside(megaWrapperRef, closeMega, megaOpen)

  return (
    <>
      <header
        className={cn(
          'fixed left-0 right-0 z-50 transition-all duration-300',
          scrolled || megaOpen
            ? 'border-b border-[var(--sf-border)] bg-white/95 shadow-[0_8px_30px_-12px_rgba(255,63,127,0.18)] backdrop-blur-md'
            : 'bg-[var(--sf-bg)]/90 backdrop-blur-sm',
        )}
        style={{
          top: 'calc(var(--pwa-install-bar-height, 0px) + env(safe-area-inset-top, 0px))',
        }}
      >
        <UtilityBar />

        <div className="relative">
          <div className="sf-container flex h-[60px] max-w-[1440px] items-center gap-3 sm:h-[72px] lg:gap-5">
            <button
              type="button"
              className="-ml-1 grid h-11 w-11 place-items-center rounded-lg text-[var(--sf-ink)] transition-colors hover:bg-[var(--sf-primary-soft)] lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <BrandLogo />

            {/* display:contents wrapper keeps the trigger in the flex row while
                grouping it with the absolutely-positioned menu for outside-click
                detection. */}
            <div ref={megaWrapperRef} className="contents">
              {menuCategories.length > 0 ? (
                <button
                  ref={categoriesTriggerRef}
                  type="button"
                  onClick={() => setMegaOpen((prev) => !prev)}
                  aria-expanded={megaOpen}
                  aria-controls={MEGA_MENU_ID}
                  aria-haspopup="true"
                  className={cn(
                    'hidden h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-white outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--sf-primary)]/50 lg:flex',
                    megaOpen
                      ? 'bg-[var(--sf-primary)]'
                      : 'bg-[var(--sf-ink)] hover:bg-[var(--sf-primary)]',
                  )}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  Categories
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', megaOpen && 'rotate-180')}
                    aria-hidden
                  />
                </button>
              ) : null}

              <div className="hidden lg:contents">
                <CategoryMegaMenu
                  id={MEGA_MENU_ID}
                  open={megaOpen}
                  categories={menuCategories}
                  onClose={dismissMega}
                  onNavigate={closeMega}
                />
              </div>
            </div>

            <div className="hidden min-w-0 flex-1 justify-center md:flex">
              <HeaderSearch className="w-full max-w-[600px]" />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
              <button
                type="button"
                onClick={openSearch}
                className="rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)] md:hidden"
                aria-label="Search"
                title="Search"
              >
                <Search className="h-5 w-5" />
              </button>
              <PWAInstallButton />
              <Link
                to="/account"
                className="hidden rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)] sm:block"
                aria-label="Account"
                title="My account"
              >
                <User className="h-5 w-5" />
              </Link>
              <Link
                to="/account/wishlist"
                className="relative hidden rounded-full p-2.5 text-[var(--sf-ink)] hover:bg-[var(--sf-primary-soft)] sm:block"
                aria-label="Wishlist"
                title="Wishlist"
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
                title="Cart"
              >
                <ShoppingBag className="h-5 w-5" />
                <span className="hidden text-sm font-semibold xl:inline">{formatBDT(total)}</span>
                {itemCount > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sf-primary)] text-[9px] font-bold text-white xl:static xl:ml-0 xl:h-5 xl:w-5 xl:text-[10px]">
                    {itemCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-[var(--sf-ink)]/40"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute left-0 top-0 flex h-full w-[min(340px,90vw)] flex-col bg-[var(--sf-bg)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--sf-border)] px-5 py-4">
              <BrandLogo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close"
                className="rounded-lg p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-4" aria-label="Categories">
              <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--sf-muted)]">
                Categories
              </p>
              <ul className="mt-1">
                {menuCategories.map((category) => {
                  const expanded = expandedCategoryId === category.id
                  const hasChildren = category.children.length > 0
                  return (
                    <li key={category.id} className="border-b border-[var(--sf-border)]/60 last:border-0">
                      <div className="flex items-center">
                        <Link
                          to={categoryShopUrl(category.slug)}
                          className="min-h-[44px] flex-1 px-3 py-3 text-sm font-semibold text-[var(--sf-ink)]"
                          onClick={() => setDrawerOpen(false)}
                        >
                          {category.name}
                        </Link>
                        {hasChildren ? (
                          <button
                            type="button"
                            className="grid h-11 w-11 shrink-0 place-items-center text-[var(--sf-muted)]"
                            aria-expanded={expanded}
                            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
                            onClick={() =>
                              setExpandedCategoryId(expanded ? null : category.id)
                            }
                          >
                            <ChevronDown
                              className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')}
                            />
                          </button>
                        ) : null}
                      </div>
                      {expanded && hasChildren ? (
                        <ul className="mb-2 space-y-0.5 pl-4">
                          {category.children.map((child) => (
                            <li key={child.id}>
                              <Link
                                to={categoryShopUrl(child.slug)}
                                className="block min-h-[44px] rounded-lg px-3 py-2.5 text-sm text-[var(--sf-muted)]"
                                onClick={() => setDrawerOpen(false)}
                              >
                                {child.name}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              to={categoryShopUrl(category.slug)}
                              className="block min-h-[44px] rounded-lg px-3 py-2.5 text-sm font-semibold text-[var(--sf-primary)]"
                              onClick={() => setDrawerOpen(false)}
                            >
                              View All {category.name}
                            </Link>
                          </li>
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>

              <div className="mt-4 space-y-1 border-t border-[var(--sf-border)] pt-3">
                <Link
                  to="/account"
                  className="block min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-medium"
                  onClick={() => setDrawerOpen(false)}
                >
                  My account
                </Link>
                <Link
                  to="/account/wishlist"
                  className="block min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-medium"
                  onClick={() => setDrawerOpen(false)}
                >
                  Wishlist
                </Link>
                <Link
                  to="/track-order"
                  className="block min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-medium"
                  onClick={() => setDrawerOpen(false)}
                >
                  Track order
                </Link>
                <PWAInstallButton variant="menu" onAfterClick={() => setDrawerOpen(false)} />
              </div>
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
