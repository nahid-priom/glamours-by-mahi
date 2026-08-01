import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { formatBDT } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ResponsiveDataView, MobileEntityCard } from '@/components/data-view'
import { listStaffSales } from '../repositories/staff.repository'

export function MySalesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const page = Number(params.get('page') ?? '1') || 1
  const branchId = params.get('branch_id')
  const dateFrom = params.get('date_from')
  const dateTo = params.get('date_to')
  const status = params.get('status')

  const filters = useMemo(
    () => ({
      page,
      page_size: 20,
      search: search || null,
      branch_id: branchId,
      date_from: dateFrom,
      date_to: dateTo,
      status: status || null,
    }),
    [page, search, branchId, dateFrom, dateTo, status],
  )

  const { data, isLoading, error } = useQuery({
    queryKey: ['staff-my-sales', filters],
    queryFn: () => listStaffSales(filters),
  })

  const items = data?.items ?? []
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20))

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {!embedded ? (
        <div>
          <h1 className="text-xl font-bold">My Sales</h1>
          <p className="text-sm text-[#6B7280]">আপনার নামে attributed Sale ও Order</p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Invoice খুঁজুন…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams(params)
            if (search) next.set('q', search)
            else next.delete('q')
            next.set('page', '1')
            setParams(next, { replace: true })
          }}
        >
          Search
        </Button>
      </div>

      <ResponsiveDataView
        items={items}
        getKey={(r) => r.id}
        isLoading={isLoading}
        error={error as Error | null}
        emptyTitle="কোনো Sale পাওয়া যায়নি"
        renderTable={(rows) => (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
                <tr>
                  <th className="px-3 py-2">Invoice</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-3 py-2">
                      <Link className="font-medium text-[#E11D48]" to={`/sales/${r.id}`}>
                        {r.invoice_no}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.customer_name ?? '—'}</td>
                    <td className="px-3 py-2">{formatBDT(Number(r.grand_total))}</td>
                    <td className="px-3 py-2">
                      {formatBDT(Number((r as { commission_amount?: number }).commission_amount ?? 0))}
                    </td>
                    <td className="px-3 py-2">{r.fulfilment_status ?? r.status}</td>
                    <td className="px-3 py-2 text-xs text-[#6B7280]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        renderCard={(r) => (
          <MobileEntityCard
            title={r.invoice_no}
            subtitle={r.customer_name ?? 'Walk-in'}
            onClick={() => {
              window.location.href = `/sales/${r.id}`
            }}
            rows={[
              { label: 'Amount', value: formatBDT(Number(r.grand_total)) },
              { label: 'Due', value: formatBDT(Number(r.due_total)) },
              { label: 'Status', value: r.fulfilment_status ?? r.status },
              {
                label: 'Commission',
                value: formatBDT(Number((r as { commission_amount?: number }).commission_amount ?? 0)),
              },
            ]}
          />
        )}
      />

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('page', String(page - 1))
            setParams(next)
          }}
        >
          Previous
        </Button>
        <span className="text-xs text-[#6B7280]">
          Page {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => {
            const next = new URLSearchParams(params)
            next.set('page', String(page + 1))
            setParams(next)
          }}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
