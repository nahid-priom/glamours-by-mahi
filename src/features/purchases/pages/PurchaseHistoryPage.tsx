import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { purchasesRepository } from '../repositories/purchases.repository'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'

export function PurchaseHistoryPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: queryKeys.sales({ scope: 'purchases' }),
    queryFn: () => purchasesRepository.listPurchases(),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Purchases</h1>
          <p className="text-sm text-[#6B7280]">Completed purchase invoices from Supabase.</p>
        </div>
        <Button asChild size="sm">
          <Link to="/purchases/new">New purchase</Link>
        </Button>
      </div>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load purchases.</p> : null}
      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No purchases yet.
        </div>
      ) : null}
      <ul className="space-y-2">
        {data.map((p) => {
          const supplier = p.suppliers as unknown as { name: string } | null
          return (
            <li key={p.id}>
              <Link
                to={`/purchases/${p.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-white px-4 py-3 hover:border-[#E11D48]/40"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{p.invoice_no}</p>
                  <p className="text-xs text-[#9CA3AF]">
                    {supplier?.name || 'Supplier'} · {p.payment_status} ·{' '}
                    {p.completed_at ? new Date(p.completed_at).toLocaleString() : '—'}
                  </p>
                </div>
                <p className="font-semibold">{formatBDT(Number(p.grand_total))}</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
