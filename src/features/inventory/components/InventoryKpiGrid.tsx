import type { InventoryValuationSummary } from '../repositories/inventory-valuation.repository'
import { InventoryKpiCard } from './InventoryValuationUi'

type Props = {
  summary: InventoryValuationSummary
  canViewCost: boolean
}

export function InventoryKpiGrid({ summary, canViewCost }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InventoryKpiCard
          accent="primary"
          label="Total Stock Quantity"
          value={summary.total_stock_quantity.toLocaleString('en-BD')}
        />
        <InventoryKpiCard
          accent="cost"
          label="Total Stock Cost"
          value={
            canViewCost && summary.total_stock_purchase_cost != null
              ? `৳${summary.total_stock_purchase_cost.toLocaleString('en-BD')}`
              : '—'
          }
        />
        <InventoryKpiCard
          accent="value"
          label="Potential Selling Value"
          value={`৳${summary.total_stock_value.toLocaleString('en-BD')}`}
        />
        <InventoryKpiCard
          accent="profit"
          label="Potential Gross Profit"
          value={
            canViewCost && summary.potential_gross_profit != null
              ? `৳${summary.potential_gross_profit.toLocaleString('en-BD')}`
              : '—'
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <InventoryKpiCard
          accent="primary"
          label="Unique Catalog Products"
          value={String(summary.total_products)}
        />
        <InventoryKpiCard
          accent="primary"
          label="Unique Catalog Variants"
          value={String(summary.total_variants)}
        />
        <InventoryKpiCard
          accent="warning"
          label="Low Stock"
          value={String(summary.low_stock_variants)}
        />
        <InventoryKpiCard
          accent="danger"
          label="Out of Stock"
          value={String(summary.out_of_stock_variants)}
        />
      </div>
      {canViewCost && summary.valuation_fallback_count > 0 ? (
        <p className="text-xs text-[#9CA3AF]">
          Estimated costs on {summary.valuation_fallback_count} variant
          {summary.valuation_fallback_count === 1 ? '' : 's'} (catalog fallback, not verified WAC).
        </p>
      ) : null}
    </div>
  )
}
