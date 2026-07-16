import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Save } from 'lucide-react'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { storesService } from '@/features/stores/stores.service'
import {
  listBranchPrices,
  upsertBranchPrice,
  type BranchProductPrice,
} from '../repositories/catalog.repository'

type Props = {
  productId: string
  variantId?: string | null
}

type RowState = {
  branchId: string
  branchName: string
  retail: string
  wholesale: string
  priceId?: string
}

export function BranchPriceEditor({ productId, variantId }: Props) {
  const qc = useQueryClient()
  const [rows, setRows] = useState<RowState[]>([])

  const { data: branches, isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => storesService.getStores(),
  })

  const { data: prices, isLoading: pricesLoading } = useQuery({
    queryKey: ['branch-prices', productId, variantId],
    queryFn: () => listBranchPrices(productId, variantId),
  })

  useEffect(() => {
    if (!branches) return
    const priceMap = new Map<string, BranchProductPrice>()
    for (const p of prices ?? []) {
      priceMap.set(p.branch_id, p)
    }
    setRows(
      branches.map((b) => {
        const existing = priceMap.get(b.id)
        return {
          branchId: b.id,
          branchName: b.name,
          retail: existing?.retail_price != null ? String(existing.retail_price) : '',
          wholesale: existing?.wholesale_price != null ? String(existing.wholesale_price) : '',
          priceId: existing?.id,
        }
      }),
    )
  }, [branches, prices])

  const saveMutation = useMutation({
    mutationFn: async () => {
      for (const row of rows) {
        const retail = row.retail.trim() ? Number(row.retail) : null
        const wholesale = row.wholesale.trim() ? Number(row.wholesale) : null
        if (retail == null && wholesale == null) continue
        await upsertBranchPrice({
          branch_id: row.branchId,
          product_id: productId,
          variant_id: variantId ?? null,
          retail_price: retail,
          wholesale_price: wholesale,
        })
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branch-prices', productId, variantId] })
    },
  })

  const setRow = (branchId: string, patch: Partial<RowState>) => {
    setRows((prev) => prev.map((r) => (r.branchId === branchId ? { ...r, ...patch } : r)))
  }

  const loading = branchesLoading || pricesLoading

  return (
    <PermissionGate permission="products.manage_prices">
      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-[#111111]">Branch prices</h3>
            <p className="text-xs text-[#6B7280]">Override retail and wholesale per branch.</p>
          </div>
          <Button
            size="sm"
            disabled={saveMutation.isPending || loading}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="mr-1 h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-[#6B7280]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading branches…
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div
                key={row.branchId}
                className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_120px_120px]"
              >
                <Label className="self-center font-medium">{row.branchName}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Retail"
                  value={row.retail}
                  onChange={(e) => setRow(row.branchId, { retail: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Wholesale"
                  value={row.wholesale}
                  onChange={(e) => setRow(row.branchId, { wholesale: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </PermissionGate>
  )
}
