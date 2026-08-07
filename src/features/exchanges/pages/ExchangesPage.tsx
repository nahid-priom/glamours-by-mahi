import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { cancelExchange, listExchanges } from '../repositories/exchanges.repository'

function statusVariant(status: string): 'success' | 'danger' | 'warning' | 'info' {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'danger'
  if (status === 'draft') return 'warning'
  return 'info'
}

export function ExchangesPage() {
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const qc = useQueryClient()
  const { toast } = useToast()

  const filters = { page, pageSize: 30, status: status || undefined }
  const { data, isLoading, error } = useQuery({
    queryKey: ['exchanges', filters],
    queryFn: () => listExchanges(filters),
  })

  const cancelMut = useMutation({
    mutationFn: (exchangeId: string) =>
      cancelExchange({ exchange_id: exchangeId, reason: 'Cancelled from exchanges list' }),
    onSuccess: async () => {
      toast('Exchange cancelled')
      await qc.invalidateQueries({ queryKey: ['exchanges'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Product exchanges</h1>
          <p className="text-sm text-text-muted">
            Swap returned sale lines for catalogue replacements and settle the difference.
          </p>
        </div>
        <PermissionGate permission="exchange.create">
          <Button asChild className="rounded-xl">
            <Link to="/sales/exchanges/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New exchange
            </Link>
          </Button>
        </PermissionGate>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { value: '', label: 'All' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'draft', label: 'Draft' },
          ] as const
        ).map((opt) => (
          <button
            key={opt.value || 'all'}
            type="button"
            onClick={() => {
              setStatus(opt.value)
              setPage(1)
            }}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              status === opt.value
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-text-primary hover:bg-slate-50',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading exchanges…
        </div>
      ) : null}
      {error ? <p className="text-sm text-danger">Failed to load exchanges.</p> : null}

      <div className="overflow-hidden rounded-2xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Exchange #</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Difference</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.exchange_no}</TableCell>
                <TableCell>
                  <Link
                    to={`/sales/${row.sale_id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {row.sales?.invoice_no ?? row.sale_id.slice(0, 8)}
                  </Link>
                </TableCell>
                <TableCell>{row.branches?.name ?? '—'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBDT(Number(row.difference_amount))}
                </TableCell>
                <TableCell className="text-sm text-text-muted">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {row.status === 'completed' ? (
                      <Button asChild size="sm" variant="ghost" className="rounded-xl">
                        <Link to={`/print/exchanges/${row.id}`} target="_blank">
                          <Printer className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    ) : null}
                    {row.status !== 'cancelled' && row.status !== 'completed' ? (
                      <PermissionGate permission="exchange.cancel">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          disabled={cancelMut.isPending}
                          onClick={() => {
                            if (window.confirm('Cancel this exchange?')) {
                              cancelMut.mutate(row.id)
                            }
                          }}
                        >
                          Cancel
                        </Button>
                      </PermissionGate>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-8 text-center text-sm text-text-muted">No exchanges found.</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
