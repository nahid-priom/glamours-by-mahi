import { enterpriseReadable } from '@/components/enterprise-readable'
import { cn } from '@/lib/utils'
import { formatLineProductCount } from './format'
import { TransactionLineItemMobileCard } from './TransactionLineItemMobileCard'
import { TransactionLineItemsSummary } from './TransactionLineItemsSummary'
import { TransactionLineItemsTable } from './TransactionLineItemsTable'
import type { TransactionLineItemView, TransactionLineItemsLabels } from './types'

type Props = {
  items: TransactionLineItemView[]
  grandTotal?: number
  showImage?: boolean
  showDiscount?: boolean
  labels?: TransactionLineItemsLabels
  headingId?: string
  className?: string
}

export function TransactionLineItemsSection({
  items,
  grandTotal,
  showImage = true,
  showDiscount = false,
  labels,
  headingId = 'transaction-items-heading',
  className,
}: Props) {
  const count = items.length
  const unitPriceLabel = labels?.unitPrice ?? 'Price'
  const discountLabel = labels?.discount ?? 'Discount'
  const emptyMessage = labels?.empty ?? 'No items on this document.'

  return (
    <section
      className={cn(
        '@container min-w-0 w-full rounded-xl border border-border bg-white',
        className,
      )}
      aria-labelledby={headingId}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 id={headingId} className={enterpriseReadable.sectionTitle}>
          Items
        </h2>
        <p className={enterpriseReadable.sectionMeta}>
          {formatLineProductCount(
            count,
            labels?.countSingular ?? 'Product',
            labels?.countPlural ?? 'Products',
          )}
        </p>
      </div>

      {count === 0 ? (
        <TransactionLineItemsSummary itemCount={0} emptyMessage={emptyMessage} />
      ) : (
        <>
          <div className="@min-[720px]:hidden" data-testid="transaction-items-cards">
            {items.map((item) => (
              <TransactionLineItemMobileCard
                key={item.id}
                item={item}
                showImage={showImage}
                showDiscount={showDiscount}
                unitPriceLabel={unitPriceLabel}
              />
            ))}
          </div>

          <div
            className="hidden min-w-0 @min-[720px]:block"
            data-testid="transaction-items-table"
          >
            <TransactionLineItemsTable
              items={items}
              showImage={showImage}
              showDiscount={showDiscount}
              unitPriceLabel={unitPriceLabel}
              discountLabel={discountLabel}
            />
          </div>

          <TransactionLineItemsSummary
            itemCount={count}
            grandTotal={grandTotal}
            emptyMessage={emptyMessage}
          />
        </>
      )}
    </section>
  )
}
