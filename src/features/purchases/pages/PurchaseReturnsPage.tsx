import { useQuery } from '@tanstack/react-query'
import { purchasesRepository } from '../repositories/purchases.repository'
import { formatBDT } from '@/lib/format'

export function PurchaseReturnsPage() {
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['purchase-returns'],
    queryFn: () => purchasesRepository.listPurchaseReturns(),
  })

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Purchase Returns</h1>
        <p className="text-sm text-[#6B7280]">Returns posted against supplier purchases.</p>
      </div>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load returns.</p> : null}
      {!isLoading && data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
          No purchase returns yet.
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Return #</th>
              <th className="px-3 py-2 text-left">Supplier</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const s = r.suppliers as unknown as { name: string } | null
              return (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.return_no}</td>
                  <td className="px-3 py-2">{s?.name || '—'}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{formatBDT(Number(r.total))}</td>
                  <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
