import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { queryKeys } from '@/lib/query/keys'
import { listAccessibleBranches } from '@/features/inventory/repositories/inventory-valuation.repository'
import { listStockLocations } from '@/features/inventory/repositories/inventory.repository'
import { MoneyValue } from '@/features/inventory/components/InventoryValuationUi'

export type OpeningStockInput = {
  branchId: string
  locationId: string
  quantity: number
  unitCost: number
}

type Props = {
  value: OpeningStockInput
  onChange: (next: OpeningStockInput) => void
  purchasePrice: number
  sellingPrice: number
  variantCount?: number
  disabled?: boolean
}

export function OpeningStockFields({
  value,
  onChange,
  purchasePrice,
  sellingPrice,
  variantCount = 1,
  disabled,
}: Props) {
  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: listAccessibleBranches,
  })

  const { data: locations = [] } = useQuery({
    queryKey: queryKeys.stockLocations(value.branchId),
    queryFn: () => listStockLocations(value.branchId),
    enabled: Boolean(value.branchId),
  })

  const saleableLocations = locations.filter(
    (l) => l.location_type === 'saleable' && l.is_active && !l.deleted_at,
  )

  const totalQty = value.quantity * variantCount
  const totalCost = totalQty * (value.unitCost || purchasePrice)
  const totalValue = totalQty * sellingPrice

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border bg-[#FAFAFA] p-4">
      <div>
        <p className="text-sm font-semibold text-[#111827]">Opening stock</p>
        <p className="text-xs text-[#6B7280]">
          Branch, location, quantity and unit purchase cost are required when adding stock.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Branch</Label>
          <select
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={value.branchId}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, branchId: e.target.value, locationId: '' })
            }
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.is_central ? ' (Head Office)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label>Location</Label>
          <select
            className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
            value={value.locationId}
            disabled={disabled || !value.branchId}
            onChange={(e) => onChange({ ...value, locationId: e.target.value })}
          >
            <option value="">Select location</option>
            {saleableLocations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opening-qty">Quantity per variant</Label>
          <Input
            id="opening-qty"
            type="number"
            min={0}
            step="1"
            disabled={disabled}
            value={value.quantity || ''}
            onChange={(e) =>
              onChange({ ...value, quantity: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="opening-cost">Unit purchase cost (৳)</Label>
          <Input
            id="opening-cost"
            type="number"
            min={0}
            step="0.01"
            disabled={disabled}
            value={value.unitCost || ''}
            onChange={(e) =>
              onChange({ ...value, unitCost: Math.max(0, Number(e.target.value) || 0) })
            }
          />
        </div>
      </div>

      {value.quantity > 0 ? (
        <div className="grid grid-cols-2 gap-2 rounded-md bg-white p-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Variants</p>
            <p className="font-semibold">{variantCount}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Total qty</p>
            <p className="font-semibold">{totalQty}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Opening cost</p>
            <p className="font-semibold">
              <MoneyValue amount={totalCost} />
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-[#9CA3AF]">Selling value</p>
            <p className="font-semibold">
              <MoneyValue amount={totalValue} />
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
