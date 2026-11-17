import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { invalidateInventoryQueries } from '../lib/invalidate-inventory-queries'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { pickDefaultSaleableLocation } from '../lib/resolve-saleable-location'
import {
  createTransfer,
  listStockLocations,
  searchBranches,
  searchVariants,
} from '../repositories/inventory.repository'

type Line = { key: string; variant_id: string | null; quantity_sent: string }

export function TransferFormPage() {
  const { profile, activeBranchId } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [toBranchId, setToBranchId] = useState<string | null>(null)
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { key: crypto.randomUUID(), variant_id: null, quantity_sent: '1' },
  ])

  const onSearchBranches = useCallback((q: string) => searchBranches(q), [])
  const onSearchVariants = useCallback((q: string) => searchVariants(q), [])

  const { data: fromLocations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(activeBranchId ?? ''),
    queryFn: () => listStockLocations(activeBranchId!),
    enabled: Boolean(activeBranchId),
  })

  const { data: toLocations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(toBranchId ?? ''),
    queryFn: () => listStockLocations(toBranchId!),
    enabled: Boolean(toBranchId),
  })

  useEffect(() => {
    setFromLocationId(pickDefaultSaleableLocation(fromLocations)?.id ?? '')
  }, [fromLocations, activeBranchId])

  useEffect(() => {
    setToLocationId(pickDefaultSaleableLocation(toLocations)?.id ?? '')
  }, [toLocations, toBranchId])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      if (!activeBranchId) throw new Error('Select source branch in the header')
      if (!toBranchId) throw new Error('Select destination branch')
      if (!fromLocationId || !toLocationId) {
        throw new Error(
          'Saleable stock locations could not be resolved for source or destination branch.',
        )
      }
      const items = lines
        .filter((l) => l.variant_id)
        .map((l) => ({
          variant_id: l.variant_id!,
          quantity_sent: Number(l.quantity_sent),
        }))
      if (!items.length) throw new Error('Add at least one line')
      const seen = new Set<string>()
      for (const item of items) {
        if (seen.has(item.variant_id)) {
          throw new Error('Duplicate variants are not allowed — combine quantities on one line')
        }
        seen.add(item.variant_id)
        if (!(item.quantity_sent > 0)) throw new Error('Quantity sent must be greater than 0')
      }
      if (toBranchId === activeBranchId) {
        throw new Error('Destination branch must differ from source')
      }
      return createTransfer({
        organizationId: profile.organization_id,
        fromBranchId: activeBranchId,
        toBranchId,
        fromLocationId,
        toLocationId,
        notes: notes || undefined,
        items,
      })
    },
    onSuccess: () => {
      invalidateInventoryQueries(qc)
      toast('Stock transfer created')
      navigate('/inventory/transfers')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">New transfer</h1>
        <p className="text-sm text-[#6B7280]">Create a draft transfer, then dispatch from the list.</p>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select the source branch in the header.</p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="space-y-1.5">
          <Label>Destination branch</Label>
          <EntityCombobox
            value={toBranchId}
            onChange={(id) => {
              setToBranchId(id)
              setToLocationId('')
            }}
            onSearch={onSearchBranches}
            placeholder="To branch"
          />
        </div>
        <p className="text-xs text-[#6B7280]">
          Source and destination saleable locations are resolved automatically for each branch.
          {!fromLocationId && activeBranchId
            ? ' Source branch has no saleable location.'
            : null}
          {toBranchId && !toLocationId ? ' Destination branch has no saleable location.' : null}
        </p>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Items</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((p) => [
                  ...p,
                  { key: crypto.randomUUID(), variant_id: null, quantity_sent: '1' },
                ])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={line.key} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <EntityCombobox
                  value={line.variant_id}
                  onChange={(id) =>
                    setLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, variant_id: id } : l)),
                    )
                  }
                  onSearch={onSearchVariants}
                  placeholder="Variant"
                />
              </div>
              <Input
                type="number"
                min={0.001}
                step="0.001"
                className="w-28"
                value={line.quantity_sent}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === idx ? { ...l, quantity_sent: e.target.value } : l,
                    ),
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 text-[#E11D48]"
                disabled={lines.length <= 1}
                onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/inventory/transfers')}>
            Cancel
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Create draft
          </Button>
        </div>
      </div>
    </div>
  )
}
