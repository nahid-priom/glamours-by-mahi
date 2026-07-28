import { Link, useNavigate } from 'react-router-dom'
import { Copy, MoreHorizontal, Pencil, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import type { ProductListItem } from '../repositories/catalog.repository'

type Props = {
  product: ProductListItem
  onDuplicate: (product: ProductListItem) => void
  onPrintBarcode: (product: ProductListItem) => void
  onDelete: (product: ProductListItem) => void
  compact?: boolean
}

export function ProductActionsMenu({
  product,
  onDuplicate,
  onPrintBarcode,
  onDelete,
  compact = false,
}: Props) {
  const navigate = useNavigate()

  return (
    <div className="flex items-center justify-end gap-1">
      <PermissionGate permission="products.update">
        <Button
          size="sm"
          variant="outline"
          className={compact ? 'h-9 min-w-[44px] px-3' : undefined}
          asChild
        >
          <Link to={`/products/${product.id}/edit`}>
            <Pencil className={compact ? 'mr-1.5 h-3.5 w-3.5' : 'mr-1 h-3.5 w-3.5'} />
            Edit
          </Link>
        </Button>
      </PermissionGate>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 w-9 min-w-[44px] px-0"
            aria-label="More product actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <PermissionGate permission="products.create">
            <DropdownMenuItem onClick={() => onDuplicate(product)}>
              <Copy className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
          </PermissionGate>
          <DropdownMenuItem onClick={() => onPrintBarcode(product)}>
            <Printer className="mr-2 h-4 w-4" />
            Print barcode
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate(`/products/${product.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Open editor
          </DropdownMenuItem>
          <PermissionGate permission="products.update">
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[#E11D48] focus:text-[#E11D48]"
              onClick={() => onDelete(product)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </PermissionGate>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
