import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useStorefrontUI } from '../storefront-ui.context'
import { storefrontService } from '../storefront.service'
import { formatBDT } from '@/lib/format'
import { ProductImage } from '@/components/common/ProductImage'

export function SearchModal() {
  const { searchOpen, closeSearch } = useStorefrontUI()
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const { data: results } = useQuery({
    queryKey: ['storefront', 'live-search', query],
    queryFn: () => storefrontService.search(query, 12),
    enabled: query.trim().length >= 2,
  })

  useEffect(() => {
    if (searchOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setQuery('')
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [searchOpen])

  if (!searchOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    closeSearch()
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-[#FFF9FB]/98 backdrop-blur-md">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-16">
        <div className="flex items-center justify-between">
          <p className="font-serif text-2xl text-[#22171C]">Search</p>
          <button type="button" onClick={closeSearch} className="rounded-full p-2 hover:bg-white">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="relative mt-8">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, categories..."
            className="w-full rounded-2xl border border-[var(--sf-border)] bg-white py-4 pl-12 pr-4 text-lg outline-none focus:border-[var(--sf-primary)]"
          />
        </form>

        {query.length >= 2 && results && (
          <div className="mt-8 max-h-[60vh] overflow-y-auto">
            {results.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No results for &quot;{query}&quot;</p>
            ) : (
              <ul className="space-y-2">
                {results.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/product/${p.slug}`}
                      onClick={closeSearch}
                      className="flex items-center gap-4 rounded-2xl bg-white p-3 transition hover:shadow-md"
                    >
                      <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl">
                        <ProductImage product={p} alt={p.alt} aspectRatio="portrait" className="h-16 w-14" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-[#6B7280]">{p.category.replace('-', ' ')}</p>
                      </div>
                      <p className="text-sm font-semibold">{formatBDT(p.displayPrice)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
