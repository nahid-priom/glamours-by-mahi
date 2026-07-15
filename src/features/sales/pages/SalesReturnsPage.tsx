import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { listSaleReturns } from '../repositories/sales.repository'

export function SalesReturnsPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')

  const filters = { page, pageSize: 30, status: status || undefined }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.saleReturns(filters),
    queryFn: () => listSaleReturns(filters),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Sales returns</h1>
        <p className="text-sm text-[#6B7280]">Return documents from Supabase sale_returns.</p>
      </div>

      <select
        className="flex h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        value={status}
        onChange={(e) => {
          setStatus(e.target.value)
          setPage(1)
        }}
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="completed">Completed</option>
      </select>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading returns…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load returns.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Return #</TableHead>
              <TableHead>Sale</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.return_no}</TableCell>
                <TableCell>
                  <Link
                    to={`/sales/${row.sale_id}`}
                    className="text-[#E11D48] hover:underline"
                  >
                    {row.sales?.invoice_no ?? row.sale_id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="info">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">{formatBDT(Number(row.total))}</TableCell>
                <TableCell className="text-sm text-[#6B7280]">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No returns found.</p>
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
