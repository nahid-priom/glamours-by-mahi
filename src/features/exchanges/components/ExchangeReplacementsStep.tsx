import { useEffect, useState } from 'react'
import { Loader2, Search, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { searchCatalogueVariants } from '../repositories/exchanges.repository'
import type { ExchangeCatalogueVariant, ReplacementLine } from '../types'
import { ExchangeCatalogueCard } from './ExchangeCatalogueCard'
import { ExchangeReplacementCart } from './ExchangeReplacementCart'
import { differenceLabel } from './ExchangeSummaryRail'

type Props = {
  returnTotal: number
  replacementTotal: number
  difference: number
  replacements: ReplacementLine[]
  onAdd: (variant: ExchangeCatalogueVariant) => void
  onAdjustQty: (key: string, delta: number) => void
  onSetQty: (key: string, qty: number) => void
  onSetPrice: (key: string, unitPrice: number) => void
  onRemove: (key: string) => void
  onBack: () => void
  onContinue: () => void
}

export function ExchangeReplacementsStep({
  returnTotal,
  replacementTotal,
  difference,
  replacements,
  onAdd,
  onAdjustQty,
  onSetQty,
  onSetPrice,
  onRemove,
  onBack,
  onContinue,
}: Props) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim()), 280)
    return () => window.clearTimeout(t)
  }, [query])

  const catalogueQuery = useQuery({
    queryKey: ['exchange-catalogue', debounced],
    queryFn: () => searchCatalogueVariants(debounced),
  })

  const cartPanel = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <p className="text-sm font-semibold text-text-primary">Replacement cart</p>
        <p className="text-xs text-text-muted">
          Return {formatBDT(returnTotal)} · Out {formatBDT(replacementTotal)}
        </p>
        <div
          className={cn(
            'mt-2 rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums',
            difference > 0 && 'border-primary/30 bg-primary/5 text-primary',
            difference < 0 && 'border-success/30 bg-success/5 text-success',
            difference === 0 && 'border-border bg-slate-50 text-text-primary',
          )}
        >
          {differenceLabel(difference)} {formatBDT(Math.abs(difference))}
        </div>
      </div>
      <ExchangeReplacementCart
        lines={replacements}
        onAdjustQty={onAdjustQty}
        onSetQty={onSetQty}
        onSetPrice={onSetPrice}
        onRemove={onRemove}
      />
      <div className="flex shrink-0 gap-2 border-t border-border pt-3">
        <Button variant="outline" className="flex-1 rounded-xl" onClick={onBack}>
          Back
        </Button>
        <Button
          className="flex-1 rounded-xl"
          disabled={replacements.length === 0}
          onClick={() => {
            setMobileOpen(false)
            onContinue()
          }}
        >
          Review · {formatBDT(Math.abs(difference))}
        </Button>
      </div>
    </div>
  )

  return (
    <>
      <div className="grid h-full min-h-0 gap-2 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex min-h-0 flex-col gap-3 rounded-2xl border border-border bg-white p-3 sm:p-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Catalogue replacements</h2>
            <p className="text-xs text-text-muted">
              Scan or search by name, SKU, or barcode — then add to the cart.
            </p>
          </div>

          <div className="relative shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
            {catalogueQuery.isFetching ? (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-text-muted" />
            ) : null}
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Scan or search catalogue…"
              className="h-11 rounded-xl pl-9 pr-9"
              autoFocus
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {catalogueQuery.isLoading ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-[220px] rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                {(catalogueQuery.data ?? []).map((v) => (
                  <ExchangeCatalogueCard key={v.id} variant={v} onAdd={onAdd} />
                ))}
              </div>
            )}
            {!catalogueQuery.isLoading && (catalogueQuery.data?.length ?? 0) === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-text-muted">
                No catalogue matches.
              </p>
            ) : null}
          </div>
        </section>

        <aside className="hidden min-h-0 rounded-2xl border border-border bg-white p-3 lg:flex lg:flex-col">
          {cartPanel}
        </aside>
      </div>

      <div
        className={cn(
          'fixed inset-x-0 z-40 px-3 lg:hidden',
          'bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))]',
        )}
      >
        <Button
          type="button"
          className="h-12 w-full rounded-full shadow-lg"
          onClick={() => setMobileOpen(true)}
        >
          <ShoppingCart className="h-4 w-4" />
          Cart ({replacements.length}) · {differenceLabel(difference)}{' '}
          {formatBDT(Math.abs(difference))}
        </Button>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[min(92dvh,100%)] max-h-[92dvh] flex-col gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom,0px)]"
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <SheetTitle>Replacement cart</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden p-3">{cartPanel}</div>
        </SheetContent>
      </Sheet>
    </>
  )
}
