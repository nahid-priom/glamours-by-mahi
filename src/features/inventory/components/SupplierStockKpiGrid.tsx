import type { SupplierStockKpis } from '../repositories/inventory-supplier.repository'
import { InventoryKpiCard } from './InventoryValuationUi'

type Props = {
  kpis: SupplierStockKpis
}

export function SupplierStockKpiGrid({ kpis }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InventoryKpiCard
          accent="primary"
          label="Suppliers With Stock"
          value={String(kpis.suppliers_with_stock)}
        />
        <InventoryKpiCard
          accent="primary"
          label="Received Qty"
          value={kpis.total_received_quantity.toLocaleString('en-BD')}
        />
        <InventoryKpiCard
          accent="value"
          label="Remaining On Hand"
          value={kpis.remaining_on_hand.toLocaleString('en-BD')}
        />
        <InventoryKpiCard
          accent="value"
          label="Available"
          value={kpis.available_quantity.toLocaleString('en-BD')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InventoryKpiCard
          accent="cost"
          label="Remaining Stock Cost"
          value={
            kpis.can_view_cost && kpis.remaining_stock_cost != null
              ? `৳${kpis.remaining_stock_cost.toLocaleString('en-BD')}`
              : '—'
          }
        />
        <InventoryKpiCard
          accent="value"
          label="Potential Selling Value"
          value={`৳${kpis.potential_selling_value.toLocaleString('en-BD')}`}
        />
        <InventoryKpiCard
          accent="profit"
          label="Potential Gross Profit"
          value={
            kpis.can_view_cost && kpis.potential_gross_profit != null
              ? `৳${kpis.potential_gross_profit.toLocaleString('en-BD')}`
              : '—'
          }
        />
        <InventoryKpiCard
          accent="warning"
          label="Low / Out / Unknown"
          value={`${kpis.low_stock_count} / ${kpis.out_of_stock_count} / ${kpis.unknown_source_quantity.toLocaleString('en-BD')}`}
        />
      </div>
    </div>
  )
}
