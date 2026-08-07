import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExchangeSaleSearchRow } from '../repositories/exchanges.repository'

type Props = {
  query: string
  onQueryChange: (q: string) => void
  sales: ExchangeSaleSearchRow[]
  loading: boolean
  selectedId?: string | null
  onSelect: (sale: ExchangeSaleSearchRow) => void
}

export function ExchangeInvoiceStep({
  query,
  onQueryChange,
  sales,
  loading,
  selectedId,
  onSelect,
}: Props) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-white p-3 sm:p-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Find invoice</h2>
        <p className="text-xs text-text-muted">
          Search by invoice number, then select a completed sale.
        </p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Invoice number…"
          className="h-11 rounded-xl pl-9"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))
          : sales.map((sale) => {
              const selected = sale.id === selectedId
              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => onSelect(sale)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-white px-3 py-3 text-left transition-shadow hover:ring-2 hover:ring-primary/30',
                    selected && 'ring-2 ring-primary/40',
                  )}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-text-primary">
                      {sale.invoice_no}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      {sale.customers?.name ?? 'Walk-in'} ·{' '}
                      {new Date(sale.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatBDT(sale.grand_total)}
                  </span>
                </button>
              )
            })}
        {!loading && sales.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-muted">
            No completed sales found.
          </p>
        ) : null}
      </div>
    </section>
  )
}
