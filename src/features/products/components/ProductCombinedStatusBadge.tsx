import { Badge } from '@/components/ui/badge'
import { StockStatusBadge } from '@/features/inventory/components/StockStatusBadge'
import { ProductStatusBadge } from './ProductStatusBadge'

const ACTIVE_LIKE = new Set(['active', 'approved'])

type Props = {
  lifecycleStatus: string
  stockStatus: string
  className?: string
}

export function ProductCombinedStatusBadge({ lifecycleStatus, stockStatus, className }: Props) {
  const lifecycle = lifecycleStatus || 'draft'
  const showStockBadge =
    ACTIVE_LIKE.has(lifecycle) && stockStatus !== 'in_stock' && stockStatus !== 'overstock'

  if (!ACTIVE_LIKE.has(lifecycle)) {
    return <ProductStatusBadge status={lifecycle} className={className} />
  }

  if (showStockBadge) {
    return <StockStatusBadge status={stockStatus} className={className} />
  }

  return (
    <Badge variant="success" className={className}>
      Active
    </Badge>
  )
}
