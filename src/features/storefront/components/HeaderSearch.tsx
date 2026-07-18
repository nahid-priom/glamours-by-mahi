import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { formatBDT } from '@/lib/format'
import { ProductImage } from '@/components/common/ProductImage'
import { storefrontService } from '../storefront.service'
import { useOnClickOutside } from '../hooks/useOnClickOutside'

type HeaderSearchProps = {
  className?: string
}

/**
 * Compact inline storefront search: left icon, clear button, and a suggestion
 * dropdown aligned to the field. Enter (or a suggestion click) performs the
 * existing `/search` navigation and product routing.
 */
export function HeaderSearch({ className }: HeaderSearchProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const trimmed = query.trim()
  const { data: results } = useQuery({
    queryKey: ['storefront', 'header-search', trimmed],
    queryFn: () => storefrontService.search(trimmed, 6),
    enabled: trimmed.length >= 2,
  })

  useOnClickOutside(wrapperRef, () => setOpen(false), open)

  const closeSuggestions = () => setOpen(false)

  const runSearch = () => {
    if (!trimmed) return
    closeSuggestions()
    inputRef.current?.blur()
    navigate(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    runSearch()
  }

  const clear = () => {
    setQuery('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const showSuggestions = open && trimmed.length >= 2 && Boolean(results)

  return (
    <div ref={wrapperRef} className={cn('relative', className)}>
      <form onSubmit={handleSubmit} role="search">
        <div className="group relative flex h-11 items-center rounded-2xl border border-[var(--sf-border)] bg-white transition-colors focus-within:border-[var(--sf-primary)] focus-within:ring-2 focus-within:ring-[var(--sf-primary)]/30">
          <Search
            className="pointer-events-none absolute left-3.5 h-4 w-4 text-[var(--sf-primary)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                closeSuggestions()
                inputRef.current?.blur()
              }
            }}
            placeholder="Search products, categories or brands…"
            aria-label="Search products, categories or brands"
            className="h-full w-full min-w-0 flex-1 rounded-2xl bg-transparent pl-10 pr-10 text-sm text-[var(--sf-ink)] outline-none placeholder:text-[var(--sf-muted)]/80 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className="absolute right-2 grid h-7 w-7 place-items-center rounded-full text-[var(--sf-muted)] transition-colors hover:bg-[var(--sf-primary-soft)] hover:text-[var(--sf-primary)]"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </form>

      {showSuggestions ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-[var(--sf-border)] bg-white shadow-[0_18px_40px_-16px_rgba(34,23,28,0.35)]">
          {results && results.length > 0 ? (
            <ul className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
              {results.map((product) => (
                <li key={product.id}>
                  <Link
                    to={`/product/${product.slug}`}
                    onClick={() => {
                      closeSuggestions()
                      setQuery('')
                    }}
                    className="flex items-center gap-3 px-3 py-2 transition-colors hover:bg-[var(--sf-primary-soft)]"
                  >
                    <div className="h-12 w-10 shrink-0 overflow-hidden rounded-lg">
                      <ProductImage
                        product={product}
                        alt={product.alt}
                        aspectRatio="portrait"
                        className="h-12 w-10"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--sf-ink)]">{product.name}</p>
                      <p className="text-xs capitalize text-[var(--sf-muted)]">
                        {product.category.replace('-', ' ')}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[var(--sf-ink)]">
                      {formatBDT(product.displayPrice)}
                    </p>
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={runSearch}
                  className="w-full px-3 py-2.5 text-left text-sm font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary-soft)]"
                >
                  See all results for “{trimmed}”
                </button>
              </li>
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-[var(--sf-muted)]">
              No matches for “{trimmed}”
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
