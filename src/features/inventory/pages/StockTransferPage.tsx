import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { invalidateInventoryQueries } from '../lib/invalidate-inventory-queries'
import {
  cancelTransfer,
  dispatch,
  getTransfer,
  listTransfers,
  receive,
} from '../repositories/inventory.repository'

type ReceiveLine = {
  id: string
  variant_id: string
  quantity_sent: number
  quantity_received: number
  quantity_damaged: number
  recvNow: number
  damagedNow: number
}

export function StockTransferPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [receiveId, setReceiveId] = useState<string | null>(null)
  const [receiveLines, setReceiveLines] = useState<ReceiveLine[]>([])
  const [finalize, setFinalize] = useState(false)

  const filters = { branchId: activeBranchId, page, pageSize: 30 }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.stockTransfers(filters),
    queryFn: () => listTransfers(filters),
  })

  const invalidate = () => {
    invalidateInventoryQueries(qc)
    void qc.invalidateQueries({ queryKey: ['stock-transfers'] })
  }

  const dispatchMutation = useMutation({
    mutationFn: dispatch,
    onSuccess: () => {
      toast('Transfer dispatched')
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelTransfer(id, 'Cancelled from transfers list'),
    onSuccess: () => {
      toast('Transfer cancelled')
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const receiveMutation = useMutation({
    mutationFn: async ({ id, lines, finalizeReceive }: { id: string; lines: ReceiveLine[]; finalizeReceive: boolean }) => {
      const items = lines
        .filter((l) => l.recvNow > 0 || l.damagedNow > 0)
        .map((l) => ({
          id: l.id,
          variant_id: l.variant_id,
          quantity_received: l.recvNow,
          quantity_damaged: l.damagedNow,
        }))
      if (items.length === 0) {
        const full = await getTransfer(id)
        const fallback = (full?.stock_transfer_items ?? [])
          .filter((i: { deleted_at: string | null }) => !i.deleted_at)
          .map((i: { id: string; variant_id: string; quantity_sent: number; quantity_received: number | null }) => ({
            id: i.id,
            variant_id: i.variant_id,
            quantity_received: Math.max(0, Number(i.quantity_sent) - Number(i.quantity_received ?? 0)),
          }))
        return receive(id, fallback, finalizeReceive)
      }
      return receive(id, items, finalizeReceive)
    },
    onSuccess: (res) => {
      const status = (res as { status?: string })?.status
      toast(status === 'received' ? 'Transfer received successfully' : 'Transfer updated')
      setReceiveId(null)
      setReceiveLines([])
      invalidate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const openPartialReceive = async (id: string) => {
    const tr = await getTransfer(id)
    const lines: ReceiveLine[] = (tr?.stock_transfer_items ?? [])
      .filter((i: { deleted_at: string | null }) => !i.deleted_at)
      .map((i: {
        id: string
        variant_id: string
        quantity_sent: number
        quantity_received: number | null
        quantity_damaged?: number | null
      }) => ({
        id: i.id,
        variant_id: i.variant_id,
        quantity_sent: Number(i.quantity_sent),
        quantity_received: Number(i.quantity_received ?? 0),
        quantity_damaged: Number(i.quantity_damaged ?? 0),
        recvNow: 0,
        damagedNow: 0,
      }))
    setReceiveLines(lines)
    setReceiveId(id)
    setFinalize(false)
  }

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

      {receiveId ? (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Partial receive</h2>
            <Button size="sm" variant="ghost" onClick={() => setReceiveId(null)}>
              Close
            </Button>
          </div>
          {receiveLines.map((l) => (
            <div key={l.id} className="grid gap-2 text-sm sm:grid-cols-[1fr_repeat(4,minmax(0,5rem))] sm:items-center">
              <span>
                Sent {l.quantity_sent} · recv {l.quantity_received} · dmg {l.quantity_damaged}
              </span>
              <Input
                type="number"
                min={0}
                placeholder="Recv"
                value={l.recvNow || ''}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setReceiveLines((prev) =>
                    prev.map((x) => (x.id === l.id ? { ...x, recvNow: v } : x)),
                  )
                }}
              />
              <Input
                type="number"
                min={0}
                placeholder="Damaged"
                value={l.damagedNow || ''}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setReceiveLines((prev) =>
                    prev.map((x) => (x.id === l.id ? { ...x, damagedNow: v } : x)),
                  )
                }}
              />
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={finalize} onChange={(e) => setFinalize(e.target.checked)} />
            Finalize short receive (close transfer)
          </label>
          <Button
            size="sm"
            disabled={receiveMutation.isPending}
            onClick={() =>
              receiveMutation.mutate({ id: receiveId, lines: receiveLines, finalizeReceive: finalize })
            }
          >
            Post receive
          </Button>
        </div>
      ) : null}

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
              <TableHead className="w-48" />
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
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={dispatchMutation.isPending}
                          onClick={() => dispatchMutation.mutate(row.id)}
                        >
                          Dispatch
                        </Button>
                        <PermissionGate permission="inventory.transfer">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelMutation.isPending}
                            onClick={() => {
                              if (window.confirm('Cancel this draft transfer?')) {
                                cancelMutation.mutate(row.id)
                              }
                            }}
                          >
                            Cancel
                          </Button>
                        </PermissionGate>
                      </>
                    ) : null}
                    {row.status === 'in_transit' || row.status === 'partially_received' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={receiveMutation.isPending}
                          onClick={() => openPartialReceive(row.id)}
                        >
                          Partial
                        </Button>
                        <Button
                          size="sm"
                          disabled={receiveMutation.isPending}
                          onClick={() => receiveMutation.mutate({ id: row.id, lines: [], finalizeReceive: true })}
                        >
                          Receive all
                        </Button>
                        {row.status === 'in_transit' ? (
                          <PermissionGate permission="inventory.transfer">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={cancelMutation.isPending}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    'Cancel in-transit transfer and restore unreceived stock to source?',
                                  )
                                ) {
                                  cancelMutation.mutate(row.id)
                                }
                              }}
                            >
                              Cancel
                            </Button>
                          </PermissionGate>
                        ) : null}
                      </>
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
