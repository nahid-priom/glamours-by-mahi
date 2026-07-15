import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { ledger } from '../repositories/inventory.repository'

export function StockLedgerPage() {
  const { activeBranchId } = useAuth()
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)

  const filters = {
    branchId: activeBranchId,
    fromDate: fromDate || null,
    toDate: toDate || null,
    page,
    pageSize: 50,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.stockLedger(filters),
    queryFn: () => ledger(filters),
    enabled: Boolean(activeBranchId),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 50))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Stock ledger</h1>
        <p className="text-sm text-[#6B7280]">Immutable movement history.</p>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch to view the ledger.</p>
      ) : null}

      <div className="flex flex-wrap gap-3">
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
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load ledger.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Δ</TableHead>
              <TableHead className="text-right">After</TableHead>
              <TableHead>Ref</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs text-[#6B7280]">
                  {new Date(row.occurred_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <p className="font-medium">{row.productName ?? '—'}</p>
                  <p className="text-xs text-[#9CA3AF]">{row.sku}</p>
                </TableCell>
                <TableCell>{row.movement_type}</TableCell>
                <TableCell
                  className={`text-right font-medium ${
                    Number(row.quantity_delta) < 0 ? 'text-[#E11D48]' : 'text-emerald-600'
                  }`}
                >
                  {Number(row.quantity_delta) > 0 ? '+' : ''}
                  {row.quantity_delta}
                </TableCell>
                <TableCell className="text-right">{row.quantity_after}</TableCell>
                <TableCell className="text-xs text-[#9CA3AF]">
                  {row.reference_type ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && activeBranchId && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No ledger entries.</p>
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
