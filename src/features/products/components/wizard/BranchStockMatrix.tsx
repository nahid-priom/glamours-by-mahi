import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AppDateField } from '@/components/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { queryKeys } from '@/lib/query/keys'
import { listAccessibleBranches } from '@/features/inventory/repositories/inventory-valuation.repository'
import { listStockLocations } from '@/features/inventory/repositories/inventory.repository'
import { formatBDT } from '@/lib/format'
import type { VariantDraft } from '../../lib/variant-matrix'

export type StockMatrixRow = {
  variantKey: string
  branchId: string
  locationId: string
  quantity: number
  unitCost: number
}

type Props = {
  variants: Array<Pick<VariantDraft, 'key' | 'label' | 'purchase_price'>>
  /** Simple product uses a single synthetic key "default". */
  rows: StockMatrixRow[]
  onRowsChange: (rows: StockMatrixRow[]) => void
  defaultBranchId?: string
  requiresExpiry?: boolean
  batchNumber?: string
  expiresAt?: string
  onBatchChange?: (batchNumber: string, expiresAt: string) => void
}

export function BranchStockMatrix({
  variants,
  rows,
  onRowsChange,
  defaultBranchId,
  requiresExpiry,
  batchNumber = '',
  expiresAt = '',
  onBatchChange,
}: Props) {
  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: listAccessibleBranches,
  })

  const branchId =
    rows[0]?.branchId ||
    defaultBranchId ||
    branches.find((b) => b.is_central)?.id ||
    branches[0]?.id ||
    ''

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(branchId),
    queryFn: () => listStockLocations(branchId),
    enabled: Boolean(branchId),
  })

  const saleable = locations.filter(
    (l) => l.location_type === 'saleable' && l.is_active && !l.deleted_at,
  )
  const locationId = rows[0]?.locationId || saleable[0]?.id || ''

  const ensureRows = useMemo(() => {
    if (!variants.length || !branchId) return rows
    const byKey = new Map(rows.map((r) => [r.variantKey, r]))
    return variants.map((v) => {
      const existing = byKey.get(v.key)
      return (
        existing ?? {
          variantKey: v.key,
          branchId,
          locationId,
          quantity: 0,
          unitCost: v.purchase_price || 0,
        }
      )
    })
  }, [variants, rows, branchId, locationId])

  const setMeta = (nextBranch: string, nextLocation: string) => {
    const next = ensureRows.map((r) => ({
      ...r,
      branchId: nextBranch,
      locationId: nextLocation,
    }))
    onRowsChange(next)
  }

  const setQty = (variantKey: string, quantity: number) => {
    onRowsChange(
      ensureRows.map((r) => (r.variantKey === variantKey ? { ...r, quantity } : r)),
    )
  }

  const setCost = (variantKey: string, unitCost: number) => {
    onRowsChange(
      ensureRows.map((r) => (r.variantKey === variantKey ? { ...r, unitCost } : r)),
    )
  }

  const totals = ensureRows.reduce(
    (acc, r) => {
      acc.qty += r.quantity
      acc.value += r.quantity * r.unitCost
      return acc
    },
    { qty: 0, value: 0 },
  )

  return (
    <div className="product-module space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <select
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={branchId}
            onChange={(e) => setMeta(e.target.value, '')}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <select
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={locationId}
            onChange={(e) => setMeta(branchId, e.target.value)}
            disabled={!branchId}
          >
            <option value="">Select location</option>
            {saleable.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {onBatchChange ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Batch / Lot (optional)</Label>
            <Input
              value={batchNumber}
              onChange={(e) => onBatchChange(e.target.value, expiresAt)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Expiry{requiresExpiry ? ' *' : ''}</Label>
            <AppDateField
              value={expiresAt}
              onChange={(ymd) => onBatchChange(batchNumber, ymd)}
              clearable
            />
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#FFF1F2] text-xs uppercase tracking-wide text-[#9F1239]">
            <tr>
              <th className="px-3 py-2 font-semibold">Variant</th>
              <th className="px-3 py-2 font-semibold">Opening qty</th>
              <th className="px-3 py-2 font-semibold">Unit cost</th>
              <th className="px-3 py-2 font-semibold">Value</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => {
              const row = ensureRows.find((r) => r.variantKey === v.key)
              const qty = row?.quantity ?? 0
              const cost = row?.unitCost ?? v.purchase_price ?? 0
              return (
                <tr key={v.key} className="border-t border-border bg-white">
                  <td className="px-3 py-2 font-medium">{v.label}</td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-24"
                      value={qty}
                      onChange={(e) => setQty(v.key, Math.max(0, Number(e.target.value) || 0))}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-8 w-28"
                      value={cost}
                      onChange={(e) => setCost(v.key, Math.max(0, Number(e.target.value) || 0))}
                    />
                  </td>
                  <td className="px-3 py-2 text-[#6B7280]">{formatBDT(qty * cost)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 rounded-xl bg-slate-50 px-3 py-2 text-xs text-[#6B7280]">
        <span>
          Total qty: <strong className="text-[#111111]">{totals.qty}</strong>
        </span>
        <span>
          Est. value: <strong className="text-[#111111]">{formatBDT(totals.value)}</strong>
        </span>
      </div>
      <p className="text-xs text-[#6B7280]">
        Opening stock posts once via the inventory engine. Retries use the same client transaction
        key and will not double-receive.
      </p>
    </div>
  )
}
