import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  createAdjustment,
  listStockLocations,
  searchVariants,
} from '../repositories/inventory.repository'

type Line = {
  key: string
  variant_id: string | null
  label: string
  quantity_counted: string
}

export function StockAdjustmentPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [locationId, setLocationId] = useState<string>('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([
    { key: crypto.randomUUID(), variant_id: null, label: '', quantity_counted: '' },
  ])

  const onSearchVariants = useCallback((q: string) => searchVariants(q), [])

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(activeBranchId ?? ''),
    queryFn: () => listStockLocations(activeBranchId!),
    enabled: Boolean(activeBranchId),
  })

  useEffect(() => {
    const saleable = pickDefaultSaleableLocation(locations)
    setLocationId(saleable?.id ?? '')
  }, [locations, activeBranchId])

  const mutation = useMutation({
    mutationFn: async () => {
      if (!activeBranchId) throw new Error('Select a branch in the header (All Branches is reporting-only)')
      if (!locationId) {
        throw new Error(
          'No saleable stock location configured for this branch. Add a default saleable location in inventory settings.',
        )
      }
      const items = lines
        .filter((l) => l.variant_id)
        .map((l) => ({
          variant_id: l.variant_id!,
          quantity_counted: Number(l.quantity_counted),
        }))
      if (!items.length) throw new Error('Add at least one variant')
      return createAdjustment({
        branch_id: activeBranchId,
        location_id: locationId,
        reason: reason || undefined,
        notes: notes || undefined,
        client_txn_key: crypto.randomUUID(),
        items,
      })
    },
    onSuccess: () => {
      invalidateInventoryQueries(qc)
      toast('Stock adjusted successfully')
      setLines([{ key: crypto.randomUUID(), variant_id: null, label: '', quantity_counted: '' }])
      setReason('')
      setNotes('')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Stock adjustment</h1>
        <p className="text-sm text-[#6B7280]">Post counted quantities via create_stock_adjustment RPC.</p>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch before adjusting stock.</p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <p className="text-xs text-[#6B7280]">
          Adjustments post to the active branch’s default saleable location
          {locationId ? ' (resolved automatically).' : '.'}
          {!locationId && activeBranchId
            ? ' No saleable location configured for this branch.'
            : null}
        </p>
        <div className="space-y-1.5">
          <Label>Reason</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cycle count, damage…" />
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Lines</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { key: crypto.randomUUID(), variant_id: null, label: '', quantity_counted: '' },
                ])
              }
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add line
            </Button>
          </div>
          {lines.map((line, idx) => (
            <div key={line.key} className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <EntityCombobox
                  value={line.variant_id}
                  onChange={(id, opt) =>
                    setLines((prev) =>
                      prev.map((l, i) =>
                        i === idx
                          ? { ...l, variant_id: id, label: opt?.label ?? '' }
                          : l,
                      ),
                    )
                  }
                  onSearch={onSearchVariants}
                  placeholder="Variant"
                />
              </div>
              <Input
                type="number"
                min={0}
                step="0.001"
                placeholder="Counted qty"
                className="w-28"
                value={line.quantity_counted}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) =>
                      i === idx ? { ...l, quantity_counted: e.target.value } : l,
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

        <Button
          disabled={!activeBranchId || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          Post adjustment
        </Button>
      </div>
    </div>
  )
}
