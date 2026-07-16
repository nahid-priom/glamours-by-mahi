import { Copy, Pencil, Printer } from 'lucide-react'
import { AppImage } from '@/components/common/AppImage'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import type { ProductListItem } from '../repositories/catalog.repository'
import { ProductStatusBadge } from './ProductStatusBadge'

type Props = {
  product: ProductListItem
  onEdit: (product: ProductListItem) => void
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
}

export function ProductMobileCard({ product, onEdit, onDuplicate, onPrintBarcode }: Props) {
  const status = (product as ProductListItem & { status?: string }).status

  return (
    <article className="rounded-xl border border-border bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <AppImage
          src={product.coverUrl}
          alt={product.name}
          className="h-16 w-16 shrink-0 rounded-lg"
          aspectRatio="square"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-[#111111]">{product.name}</h3>
              <p className="text-xs text-[#6B7280]">{product.base_sku ?? '—'}</p>
            </div>
            <ProductStatusBadge status={status} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-[#6B7280]">
            <span>Category: {product.categories?.name ?? '—'}</span>
            <span>Brand: {product.brands?.name ?? '—'}</span>
            <span>Variants: {product.variantCount ?? 0}</span>
            <span>Stock: {product.totalStock ?? 0}</span>
            <span className="col-span-2 font-medium text-[#111111]">
              {formatBDT(Number(product.selling_price))}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => onEdit(product)}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Edit
        </Button>
        <Button size="sm" variant="outline" className="flex-1" onClick={() => onDuplicate(product)}>
          <Copy className="mr-1 h-3.5 w-3.5" />
          Duplicate
        </Button>
        <Button size="sm" variant="outline" onClick={() => onPrintBarcode(product)}>
          <Printer className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  )
}
