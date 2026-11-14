import { cn } from '@/lib/utils'
import { enterpriseReadable } from './enterprise-readable'
import { SaleItemMobileCard } from './SaleItemMobileCard'
import {
  formatProductCount,
  toSaleItemViewModel,
} from './sale-item-presentation'
import type { SaleDetailLineItem } from './sale-item.types'
import { SaleItemsSummary } from './SaleItemsSummary'
import { SaleItemsTable } from './SaleItemsTable'

type SaleItemsSectionProps = {
  items: SaleDetailLineItem[]
  grandTotal?: number
  className?: string
}

export function SaleItemsSection({
  items,
  grandTotal,
  className,
}: SaleItemsSectionProps) {
  const viewItems = items.map(toSaleItemViewModel)
  const count = viewItems.length

  return (
    <section
      className={cn(
        '@container min-w-0 w-full rounded-xl border border-border bg-white',
        className,
      )}
      aria-labelledby="sale-items-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2
          id="sale-items-heading"
          className={enterpriseReadable.sectionTitle}
        >
          Items
        </h2>
        <p className={enterpriseReadable.sectionMeta}>
          {formatProductCount(count)}
        </p>
      </div>

      {count === 0 ? (
        <SaleItemsSummary itemCount={0} />
      ) : (
        <>
          {/* Cards: container narrower than 720px */}
          <div className="@min-[720px]:hidden" data-testid="sale-items-cards">
            {viewItems.map((item) => (
              <SaleItemMobileCard key={item.id} item={item} />
            ))}
          </div>

          {/* Table: container 720px and above */}
          <div className="hidden min-w-0 @min-[720px]:block" data-testid="sale-items-table">
            <SaleItemsTable items={viewItems} />
          </div>

          <SaleItemsSummary itemCount={count} grandTotal={grandTotal} />
        </>
      )}
    </section>
  )
}
