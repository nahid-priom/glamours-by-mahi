import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'
import {
  getSupplierStockBreakdown,
  getSupplierStockMovements,
  type SupplierStockSummaryRow,
} from '../repositories/inventory-supplier.repository'
import { MoneyValue, QuantityValue } from './InventoryValuationUi'

type Props = {
  row: SupplierStockSummaryRow | null
  open: boolean
  branchId?: string | null
  includeNonSaleable?: boolean
  onOpenChange: (open: boolean) => void
}

type TabId = 'products' | 'branches' | 'purchases' | 'movements'

export function SupplierStockDetailsDrawer({
  row,
  open,
  branchId,
  includeNonSaleable,
  onOpenChange,
}: Props) {
  const [tab, setTab] = useState<TabId>('products')
  if (!row) return null

  const unknown = !row.supplier_id

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="flex h-full min-h-0 flex-col">
          <SheetHeader className="shrink-0 space-y-2 border-b border-[#FECDD3] bg-[#FFF1F2] p-5 pr-12">
            <SheetTitle className="text-xl font-bold text-[#111827]">{row.supplier_name}</SheetTitle>
            <p className="text-sm text-[#6B7280]">
              {row.product_count} products · {row.variant_count} variants
              {row.last_purchase_at
                ? ` · Last purchase ${new Date(row.last_purchase_at).toLocaleDateString('en-BD')}`
                : ''}
            </p>
            <div className="grid grid-cols-2 gap-2 pt-1 text-sm">
              <Metric label="Received" value={<QuantityValue qty={row.received_qty} />} />
              <Metric label="Remaining" value={<QuantityValue qty={row.remaining_qty} />} />
              <Metric label="Stock Cost" value={<MoneyValue amount={row.stock_cost} />} />
              <Metric label="Selling Value" value={<MoneyValue amount={row.selling_value} />} />
            </div>
          </SheetHeader>

          <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2">
            {(
              [
                ['products', 'Products'],
                ['branches', 'Branches'],
                ['purchases', 'Receipts'],
                ['movements', 'Movements'],
              ] as Array<[TabId, string]>
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold',
                  tab === id ? 'bg-[#E11D48] text-white' : 'text-[#6B7280] hover:bg-[#FFF1F2]',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 text-sm">
            <DrawerBody
              tab={tab}
              row={row}
              unknown={unknown}
              branchId={branchId}
              includeNonSaleable={includeNonSaleable}
            />
          </div>

          <div className="shrink-0 border-t border-[#FECDD3] p-4">
            {row.supplier_id ? (
              <Button asChild size="sm" className="h-10 w-full bg-[#E11D48] text-white hover:bg-[#BE123C]">
                <Link to={`/suppliers/${row.supplier_id}`}>Open Supplier</Link>
              </Button>
            ) : (
              <p className="text-center text-xs text-[#6B7280]">
                Unknown legacy stock has no supplier master record.
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#FECDD3] bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <div className="mt-0.5 font-semibold tabular-nums text-[#111827]">{value}</div>
    </div>
  )
}

function DrawerBody({
  tab,
  row,
  unknown,
  branchId,
  includeNonSaleable,
}: {
  tab: TabId
  row: SupplierStockSummaryRow
  unknown: boolean
  branchId?: string | null
  includeNonSaleable?: boolean
}) {
  const breakdown = useQuery({
    queryKey: queryKeys.inventorySupplierBreakdown({
      supplierId: row.supplier_id,
      unknown,
      branchId,
      includeNonSaleable,
      tab,
    }),
    queryFn: () =>
      getSupplierStockBreakdown({
        supplierId: row.supplier_id,
        supplierUnknown: unknown,
        branchId,
        includeNonSaleable,
      }),
    enabled: tab !== 'movements',
  })

  const movements = useQuery({
    queryKey: queryKeys.inventorySupplierMovements({
      supplierId: row.supplier_id,
      unknown,
      branchId,
    }),
    queryFn: () =>
      getSupplierStockMovements({
        supplierId: row.supplier_id,
        supplierUnknown: unknown,
        branchId,
      }),
    enabled: tab === 'movements',
  })

  if (tab !== 'movements' && breakdown.isLoading) {
    return <p className="text-[#6B7280]">Loading…</p>
  }
  if (tab === 'movements' && movements.isLoading) {
    return <p className="text-[#6B7280]">Loading…</p>
  }

  if (tab === 'products') {
    const items = breakdown.data?.variants ?? []
    return (
      <ul className="space-y-2">
        {items.map((v) => (
          <li key={String(v.variant_id)} className="rounded-xl border border-border px-3 py-2">
            <p className="font-medium text-[#111827]">{String(v.product_name)}</p>
            <p className="text-xs text-[#6B7280]">
              {String(v.variant_name ?? 'Default')} · {String(v.sku ?? '—')}
            </p>
            <p className="mt-1 tabular-nums text-[#111827]">
              Remaining {Number(v.remaining_qty ?? 0)} · Available {Number(v.available_qty ?? 0)}
            </p>
          </li>
        ))}
        {items.length === 0 ? <p className="text-[#6B7280]">No variants.</p> : null}
      </ul>
    )
  }

  if (tab === 'branches') {
    const items = breakdown.data?.branches ?? []
    return (
      <ul className="space-y-2">
        {items.map((b) => (
          <li
            key={`${String(b.branch_id)}-${String(b.location_id)}`}
            className="rounded-xl border border-border px-3 py-2"
          >
            <p className="font-medium text-[#111827]">{String(b.branch_name)}</p>
            <p className="text-xs text-[#6B7280]">{String(b.location_name)}</p>
            <p className="mt-1 tabular-nums">Remaining {Number(b.remaining_qty ?? 0)}</p>
          </li>
        ))}
        {items.length === 0 ? <p className="text-[#6B7280]">No branch stock.</p> : null}
      </ul>
    )
  }

  if (tab === 'purchases') {
    const items = breakdown.data?.sources ?? []
    return (
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={String(s.source_id)} className="rounded-xl border border-border px-3 py-2">
            <p className="font-medium text-[#111827]">{String(s.sku ?? 'Variant')}</p>
            <p className="text-xs text-[#6B7280]">
              {s.received_at ? new Date(String(s.received_at)).toLocaleString('en-BD') : '—'} ·{' '}
              {String(s.traceability_status)}
            </p>
            <p className="mt-1 tabular-nums">
              Received {Number(s.received_quantity ?? 0)} · Remaining {Number(s.remaining_qty ?? 0)}
            </p>
            {s.purchase_id ? (
              <Link
                className="mt-1 inline-block text-xs font-medium text-[#E11D48] hover:underline"
                to={`/purchases/${String(s.purchase_id)}`}
              >
                View purchase
              </Link>
            ) : null}
          </li>
        ))}
        {items.length === 0 ? <p className="text-[#6B7280]">No receipt sources.</p> : null}
      </ul>
    )
  }

  const moves = movements.data?.items ?? []
  return (
    <ul className="space-y-2">
      {moves.map((m) => (
        <li key={String(m.id)} className="rounded-xl border border-border px-3 py-2">
          <p className="font-medium capitalize text-[#111827]">{String(m.event_type).replace(/_/g, ' ')}</p>
          <p className="text-xs text-[#6B7280]">
            {String(m.product_name)} · {String(m.sku)} · {String(m.branch_name)}
          </p>
          <p className="mt-1 tabular-nums">
            {Number(m.quantity_delta ?? 0)} ·{' '}
            {m.occurred_at ? new Date(String(m.occurred_at)).toLocaleString('en-BD') : '—'}
          </p>
        </li>
      ))}
      {moves.length === 0 ? <p className="text-[#6B7280]">No movements yet.</p> : null}
    </ul>
  )
}
