import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatNumber } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { supabase } from '@/lib/supabase/client'
import {
  getSupplierStockBreakdown,
  getSupplierStockKpis,
} from '@/features/inventory/repositories/inventory-supplier.repository'

async function getSupplierStockVelocity(supplierId: string, days = 30) {
  const { data, error } = await (supabase as unknown as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: Error | null }>
  }).rpc('get_supplier_stock_velocity', {
    p_supplier_id: supplierId,
    p_branch_id: null,
    p_days: days,
  })
  if (error) throw error
  return Array.isArray(data) ? (data as Array<Record<string, unknown>>) : []
}

type Props = {
  supplierId: string
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function SupplierStockTab({ supplierId }: Props) {
  const stockFilters = useMemo(() => ({ supplierId }), [supplierId])

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: queryKeys.inventorySupplierKpis(stockFilters),
    queryFn: () => getSupplierStockKpis(stockFilters),
    enabled: Boolean(supplierId),
  })

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: queryKeys.inventorySupplierBreakdown({ supplierId, level: 'products' }),
    queryFn: () =>
      getSupplierStockBreakdown({
        supplierId,
        level: 'products',
      }),
    enabled: Boolean(supplierId),
  })

  const { data: velocity = [] } = useQuery({
    queryKey: ['supplier-stock-velocity', supplierId, 30],
    queryFn: () => getSupplierStockVelocity(supplierId, 30),
    enabled: Boolean(supplierId),
  })

  const velocityByVariant = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const row of velocity) {
      map.set(String(row.variant_id ?? ''), row)
    }
    return map
  }, [velocity])

  const productRows = (breakdown?.items ?? []).map((row, index) => {
    const r = row as Record<string, unknown>
    const variantId = String(r.variant_id ?? '')
    const vel = velocityByVariant.get(variantId)
    return {
      key: String(r.product_id ?? r.variant_id ?? r.id ?? r.product_key ?? `row-${index}`),
      name: String(r.product_name ?? r.name ?? 'Product'),
      sku: (r.sku as string | null) ?? (r.product_sku as string | null) ?? null,
      received: num(r.received_qty ?? r.received_quantity),
      onHand: num(r.remaining_qty ?? r.remaining_quantity ?? r.on_hand),
      available: num(r.available_qty ?? r.available_quantity),
      sold30: vel ? num(vel.sold_qty) : null,
      status: vel ? String(vel.movement_status ?? '') : null,
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Stock attributed to supplier</h2>
          <p className="text-xs text-muted-foreground">
            Quantities from inventory attribution; unknown source shown separately.
          </p>
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to={`/inventory/stock?view=suppliers&supplierId=${supplierId}`}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            Full inventory view
          </Link>
        </Button>
      </div>

      {kpisLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading stock KPIs…
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Received" value={formatNumber(kpis?.total_received_quantity ?? 0)} />
          <Kpi label="On hand" value={formatNumber(kpis?.remaining_on_hand ?? 0)} />
          <Kpi label="Available" value={formatNumber(kpis?.available_quantity ?? 0)} />
          <Kpi label="Unknown source" value={formatNumber(kpis?.unknown_source_quantity ?? 0)} />
        </div>
      )}

      <div className="rounded-xl border border-border bg-white">
        {breakdownLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Received</TableHead>
                <TableHead className="text-right">On hand</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">30D sold</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">{row.sku ?? '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.received)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(row.onHand)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums')}>
                    {formatNumber(row.available)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sold30 == null ? '—' : formatNumber(row.sold30)}
                  </TableCell>
                  <TableCell>
                    {row.status ? (
                      <Badge
                        variant={
                          row.status === 'fast'
                            ? 'success'
                            : row.status === 'slow' || row.status === 'dead'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {row.status}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {!breakdownLoading && productRows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No attributed stock for this supplier.
          </p>
        ) : null}
      </div>
    </div>
  )
}