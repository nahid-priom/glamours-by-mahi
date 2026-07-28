import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CustomerRatingStars, listTopCustomers } from '@/features/customer-rating'
import { formatBDT } from '@/lib/format'
import { ReportShell, useReportRange } from '../components/ReportShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type SortKey = 'rating' | 'spent' | 'orders' | 'recent'

export function TopCustomersReportPage() {
  const { range, setRange } = useReportRange()
  const [sort, setSort] = useState<SortKey>('spent')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const pageSize = 25

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['report-top-customers', sort, search, page, range.from, range.to],
    queryFn: () =>
      listTopCustomers({
        limit: pageSize,
        offset: page * pageSize,
        sort,
        search: search.trim() || undefined,
        from: range.from,
        to: range.to,
      }),
  })

  return (
    <ReportShell
      title="Top customers"
      subtitle="Period ranking by spend/orders; rating is lifetime auto-score."
      range={range}
      onRangeChange={(r) => {
        setRange(r)
        setPage(0)
      }}
      showRange
      onExport={() => {
        const rows = data.map((r) => [
          r.rank ?? '',
          r.name,
          r.phone,
          r.rating_status,
          r.rating ?? '',
          r.completed_orders,
          r.total_spent,
          r.return_total,
          r.current_due,
          r.current_advance,
          r.last_purchase_at || '',
        ])
        const header = [
          'Rank',
          'Name',
          'Phone',
          'Rating status',
          'Rating',
          'Orders',
          'Net sales',
          'Returns',
          'Due',
          'Advance',
          'Last purchase',
        ]
        const csv = [header, ...rows]
          .map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
          .join('\n')
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `top-customers-${range.from}_${range.to}-${sort}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }}
    >
      <p className="mb-3 text-xs text-[#6B7280]">
        Ranking by <strong>{sort}</strong> for {range.from} → {range.to}. Cancelled/draft sales
        excluded. Unrated customers are not shown as 3.0 stars.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder="Search name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        {(
          [
            ['spent', 'By spend'],
            ['orders', 'By orders'],
            ['rating', 'By rating'],
            ['recent', 'By recent'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={sort === key ? 'default' : 'outline'}
            onClick={() => {
              setSort(key)
              setPage(0)
            }}
          >
            {label}
          </Button>
        ))}
      </div>
      {isLoading ? <p className="text-sm text-[#6B7280]">Loading…</p> : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load top customers.</p> : null}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Rank</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Rating</th>
              <th className="px-3 py-2 text-left">Orders</th>
              <th className="px-3 py-2 text-left">Net sales</th>
              <th className="px-3 py-2 text-left">Returns</th>
              <th className="px-3 py-2 text-left">Due / Advance</th>
              <th className="px-3 py-2 text-left">Last purchase</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2 text-[#6B7280]">{r.rank ?? page * pageSize + i + 1}</td>
                <td className="px-3 py-2">
                  <Link to={`/customers/${r.id}`} className="font-medium text-[#E11D48] hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-xs text-[#6B7280]">{r.phone}</p>
                </td>
                <td className="px-3 py-2">
                  <CustomerRatingStars score={r.rating} status={r.rating_status} />
                </td>
                <td className="px-3 py-2">{r.completed_orders}</td>
                <td className="px-3 py-2">{formatBDT(r.total_spent)}</td>
                <td className="px-3 py-2">
                  {r.return_total > 0 ? formatBDT(r.return_total) : '—'}
                </td>
                <td className="px-3 py-2">
                  {r.current_due > 0
                    ? `Due ${formatBDT(r.current_due)}`
                    : r.current_advance > 0
                      ? `Adv ${formatBDT(r.current_advance)}`
                      : 'Settled'}
                </td>
                <td className="px-3 py-2 text-xs text-[#6B7280]">
                  {r.last_purchase_at ? new Date(r.last_purchase_at).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && data.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No customers found.</p>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={data.length < pageSize}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </ReportShell>
  )
}
