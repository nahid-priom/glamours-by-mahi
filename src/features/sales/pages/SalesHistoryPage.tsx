import { useCallback, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { listSales, searchBranches, searchCustomers } from '../repositories/sales.repository'

export function SalesHistoryPage() {
  const { activeBranchId } = useAuth()
  const [search, setSearch] = useState('')
  const [branchId, setBranchId] = useState<string | null>(activeBranchId)
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [paymentStatus, setPaymentStatus] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const onSearchCustomers = useCallback((q: string) => searchCustomers(q), [])
  const onSearchBranches = useCallback((q: string) => searchBranches(q), [])

  const filters = {
    search,
    branchId,
    customerId,
    paymentStatus: paymentStatus || null,
    fromDate: fromDate || null,
    toDate: toDate || null,
    page,
    pageSize: 30,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.sales(filters),
    queryFn: () => listSales(filters),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Sales history</h1>
        <p className="text-sm text-[#6B7280]">Filter completed and open invoices from Supabase.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Invoice #"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-[9rem]"
        />
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => {
            setFromDate(e.target.value)
            setPage(1)
          }}
          className="max-w-[10rem]"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => {
            setToDate(e.target.value)
            setPage(1)
          }}
          className="max-w-[10rem]"
        />
        <div className="w-44">
          <EntityCombobox
            value={branchId}
            onChange={(id) => {
              setBranchId(id)
              setPage(1)
            }}
            onSearch={onSearchBranches}
            placeholder="Branch"
          />
        </div>
        <div className="w-48">
          <EntityCombobox
            value={customerId}
            onChange={(id) => {
              setCustomerId(id)
              setPage(1)
            }}
            onSearch={onSearchCustomers}
            placeholder="Customer"
          />
        </div>
        <select
          className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          value={paymentStatus}
          onChange={(e) => {
            setPaymentStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">Payment status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
          <option value="overpaid">Overpaid</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading sales…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load sales.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link to={`/sales/${row.id}`} className="font-medium text-[#E11D48] hover:underline">
                    {row.invoice_no}
                  </Link>
                  <p className="text-xs text-[#9CA3AF]">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </TableCell>
                <TableCell>{row.customers?.name ?? 'Walk-in'}</TableCell>
                <TableCell className="text-[#6B7280]">{row.branches?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant="info">{row.status}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={row.payment_status === 'paid' ? 'success' : 'warning'}>
                    {row.payment_status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatBDT(Number(row.grand_total))}</TableCell>
                <TableCell className="text-right text-[#E11D48]">
                  {Number(row.due_total) > 0 ? formatBDT(Number(row.due_total)) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No sales match these filters.</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
