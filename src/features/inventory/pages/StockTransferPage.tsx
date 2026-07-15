import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { dispatch, listTransfers, receive } from '../repositories/inventory.repository'

export function StockTransferPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)

  const filters = { branchId: activeBranchId, page, pageSize: 30 }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.stockTransfers(filters),
    queryFn: () => listTransfers(filters),
  })

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['stock-transfers'] })

  const dispatchMutation = useMutation({
    mutationFn: dispatch,
    onSuccess: () => {
      toast('Transfer dispatched')
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const receiveMutation = useMutation({
    mutationFn: (id: string) => receive(id),
    onSuccess: () => {
      toast('Transfer received')
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Stock transfers</h1>
          <p className="text-sm text-[#6B7280]">Move inventory between branches.</p>
        </div>
        <PermissionGate permission="inventory.transfer">
          <Button size="sm" asChild>
            <Link to="/inventory/transfers/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New transfer
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load transfers.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Transfer #</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.transfer_no}</TableCell>
                <TableCell>
                  <Badge variant="info">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-sm text-[#6B7280]">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {row.status === 'draft' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dispatchMutation.isPending}
                        onClick={() => dispatchMutation.mutate(row.id)}
                      >
                        Dispatch
                      </Button>
                    ) : null}
                    {row.status === 'in_transit' ? (
                      <Button
                        size="sm"
                        disabled={receiveMutation.isPending}
                        onClick={() => receiveMutation.mutate(row.id)}
                      >
                        Receive
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No transfers yet.</p>
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
