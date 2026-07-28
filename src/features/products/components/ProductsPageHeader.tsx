import { Link } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatNumber } from '@/lib/format'

type Props = {
  totalCount: number
  pageCount: number
  isFetching?: boolean
}

export function ProductsPageHeader({ totalCount, pageCount, isFetching }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#111111]">Products</h1>
        <p className="text-sm text-[#6B7280]">
          {formatNumber(totalCount)} products
          {pageCount > 0 ? ` on this page` : ''}
          {isFetching ? ' · Updating…' : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <PermissionGate permission="products.import">
          <Button size="sm" variant="outline" asChild>
            <Link to="/products/import">
              <Upload className="mr-1.5 h-4 w-4" />
              Import
            </Link>
          </Button>
        </PermissionGate>
        <PermissionGate permission="products.create">
          <Button size="sm" asChild>
            <Link to="/products/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add product
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </div>
  )
}
