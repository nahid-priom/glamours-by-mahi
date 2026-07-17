import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Brush,
  ChevronRight,
  Eye,
  Footprints,
  Gem,
  Glasses,
  Palette,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  Watch,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MenuCategory } from '../repositories/menu-categories.repository'
import { getCategoryFallback } from '../lib/category-images'
import { categoryShopUrl } from '../lib/category-links'
import { CategoryImage } from './CategoryImage'

const ICON_MAP: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  palette: Palette,
  brush: Brush,
  eye: Eye,
  shirt: Shirt,
  footprints: Footprints,
  'shopping-bag': ShoppingBag,
  gem: Gem,
  glasses: Glasses,
  watch: Watch,
}

function CategoryIcon({ category }: { category: MenuCategory }) {
  if (category.imageUrl || getCategoryFallback(category.slug)) {
    return (
      <CategoryImage
        src={category.imageUrl}
        fallbackSrc={getCategoryFallback(category.slug)}
        alt=""
        className="h-9 w-9 shrink-0 rounded-lg"
      />
    )
  }
  const Icon = (category.icon && ICON_MAP[category.icon]) || Tag
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--sf-primary-soft)] text-[var(--sf-primary)]">
      <Icon className="h-4 w-4" aria-hidden />
    </span>
  )
}

type CategoryMegaMenuProps = {
  id: string
  open: boolean
  categories: MenuCategory[]
  /** Dismissal (Escape / overlay click) — caller restores focus to the trigger. */
  onClose: () => void
  /** Closing because a category link navigated — no focus restore. */
  onNavigate: () => void
}

/**
 * Desktop mega menu: left parent-category rail, right subcategory columns.
 * Anchored below the sticky header, aligned to the shared container.
 */
export function CategoryMegaMenu({ id, open, categories, onClose, onNavigate }: CategoryMegaMenuProps) {
  const [activeId, setActiveId] = useState<string | null>(categories[0]?.id ?? null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) setActiveId(categories[0]?.id ?? null)
  }, [open, categories])

  const active = useMemo(
    () => categories.find((c) => c.id === activeId) ?? categories[0] ?? null,
    [categories, activeId],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open || categories.length === 0) return null

  const moveFocus = (delta: number) => {
    const items = listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-parent]')
    if (!items || items.length === 0) return
    const current = document.activeElement
    const index = Array.from(items).findIndex((el) => el === current)
    const next = items[(index + delta + items.length) % items.length]
    next?.focus()
  }

  return (
    <>
      {/* Page overlay below the header keeps hero/carousel muted while open. */}
      <button
        type="button"
        aria-label="Close categories menu"
        onClick={onClose}
        className="absolute left-0 right-0 top-full h-screen cursor-default bg-[var(--sf-ink)]/25"
        tabIndex={-1}
      />

      <div className="absolute left-0 right-0 top-full">
        <div className="sf-container max-w-[1440px]">
          <div
            id={id}
            role="region"
            aria-label="Product categories"
            className="overflow-hidden rounded-b-2xl border border-t-0 border-[var(--sf-border)] bg-white shadow-2xl"
          >
            <div className="grid max-h-[min(560px,calc(100vh-160px))] min-h-[380px] grid-cols-[280px_minmax(0,1fr)]">
              <ul
                ref={listRef}
                className="overflow-y-auto border-r border-[var(--sf-border)] bg-[var(--sf-bg)] py-2"
              >
                {categories.map((category) => {
                  const isActive = active?.id === category.id
                  return (
                    <li key={category.id}>
                      <Link
                        to={categoryShopUrl(category.slug)}
                        data-parent
                        onClick={onNavigate}
                        onMouseEnter={() => setActiveId(category.id)}
                        onFocus={() => setActiveId(category.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            moveFocus(1)
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            moveFocus(-1)
                          }
                        }}
                        className={cn(
                          'flex min-h-[44px] items-center gap-3 px-4 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-[var(--sf-primary-soft)] text-[var(--sf-primary)]'
                            : 'text-[var(--sf-ink)] hover:bg-white',
                        )}
                      >
                        <CategoryIcon category={category} />
                        <span className="min-w-0 flex-1 truncate">{category.name}</span>
                        <ChevronRight
                          className={cn(
                            'h-4 w-4 shrink-0 transition-transform',
                            isActive ? 'text-[var(--sf-primary)]' : 'text-[var(--sf-muted)]',
                          )}
                          aria-hidden
                        />
                      </Link>
                    </li>
                  )
                })}
              </ul>

              <div className="overflow-y-auto p-6">
                {active ? (
                  <>
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h3 className="font-serif text-lg text-[var(--sf-ink)]">{active.name}</h3>
                      <Link
                        to={categoryShopUrl(active.slug)}
                        onClick={onNavigate}
                        className="flex items-center gap-1 text-sm font-semibold text-[var(--sf-primary)]"
                      >
                        View All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    </div>

                    {active.children.length > 0 ? (
                      <ul className="grid grid-cols-2 gap-x-6 gap-y-0.5 xl:grid-cols-3">
                        {active.children.map((child) => (
                          <li key={child.id}>
                            <Link
                              to={categoryShopUrl(child.slug)}
                              onClick={onNavigate}
                              className="block rounded-lg px-2 py-2 text-sm text-[var(--sf-muted)] transition-colors hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary)]"
                            >
                              {child.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex max-w-sm flex-col items-start gap-4">
                        <CategoryImage
                          src={active.imageUrl}
                          fallbackSrc={getCategoryFallback(active.slug)}
                          alt={active.name}
                          className="w-48 rounded-2xl border border-[var(--sf-border)]"
                        />
                        <p className="text-sm text-[var(--sf-muted)]">
                          {active.description ??
                            `Explore our curated ${active.name} collection with nationwide delivery.`}
                        </p>
                        <Link
                          to={categoryShopUrl(active.slug)}
                          onClick={onNavigate}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--sf-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#d91e5b]"
                        >
                          Shop All {active.name}
                          <ArrowRight className="h-4 w-4" aria-hidden />
                        </Link>
                      </div>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
