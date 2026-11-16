import { Link } from 'react-router-dom'
import { Plus, Upload, Printer, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { PM } from '../lib/product-module-theme'

type Props = {
  onPrintBarcodes?: () => void
  onExport?: () => void
}

export function ProductsPageHeader({ onPrintBarcodes, onExport }: Props) {
  return (
    <div className="product-module flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#111111]">Products</h1>
      </div>
      <div className="flex flex-wrap gap-2">
        <PermissionGate permission="products.import">
          <Button size="sm" variant="outline" asChild>
            <Link to="/products/import">
              <Upload className="mr-1.5 h-4 w-4" />
              Import Products
            </Link>
          </Button>
        </PermissionGate>
        {onPrintBarcodes ? (
          <Button size="sm" variant="outline" type="button" onClick={onPrintBarcodes}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print Barcodes
          </Button>
        ) : null}
        {onExport ? (
          <Button size="sm" variant="outline" type="button" onClick={onExport}>
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        ) : null}
        <PermissionGate permission="products.create">
          <Button size="sm" className={PM.btn} asChild>
            <Link to="/products/new">
              <Plus className="mr-1.5 h-4 w-4" />
              Add Product
            </Link>
          </Button>
        </PermissionGate>
      </div>
    </div>
  )
}
