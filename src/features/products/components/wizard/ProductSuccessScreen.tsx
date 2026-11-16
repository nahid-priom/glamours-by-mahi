import { Link } from 'react-router-dom'
import { CheckCircle2, Printer, Plus, Eye, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { PM } from '../../lib/product-module-theme'

export type ProductSuccessPayload = {
  productId: string
  name: string
  status: string
  variantCount: number
  barcodeReady: boolean
  totalOpeningQty: number
  priceLabel: string
}

type Props = {
  result: ProductSuccessPayload
  title?: string
  onAddAnother?: () => void
  onPrintBarcode?: () => void
}

function statusLabel(status: string) {
  if (status === 'active') return 'Activated'
  if (status === 'pending_approval') return 'Submitted for approval'
  if (status === 'draft') return 'Saved as draft'
  return status
}

export function ProductSuccessScreen({
  result,
  title = 'Product Added Successfully!',
  onAddAnother,
  onPrintBarcode,
}: Props) {
  return (
    <div className="product-module mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-[#FECDD3] bg-white px-6 py-10 text-center shadow-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <h2 className="mt-4 font-serif text-2xl text-[#111111]">{title}</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        {result.name} · {statusLabel(result.status)}
      </p>

      <dl className="mt-6 grid w-full grid-cols-2 gap-3 text-left text-sm">
        <div className="rounded-xl bg-[#FFF1F2] p-3">
          <dt className="text-xs text-[#E11D48]">Variants</dt>
          <dd className="font-semibold text-[#111111]">{result.variantCount}</dd>
        </div>
        <div className="rounded-xl bg-[#FFF1F2] p-3">
          <dt className="text-xs text-[#E11D48]">Barcodes</dt>
          <dd className="font-semibold text-[#111111]">
            {result.barcodeReady ? 'Ready' : 'Incomplete'}
          </dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-[#6B7280]">Opening stock</dt>
          <dd className="font-semibold text-[#111111]">{result.totalOpeningQty} pcs</dd>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <dt className="text-xs text-[#6B7280]">Price</dt>
          <dd className="font-semibold text-[#111111]">{result.priceLabel || formatBDT(0)}</dd>
        </div>
      </dl>

      <div className="mt-8 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
        {onAddAnother ? (
          <Button type="button" className={PM.btn} onClick={onAddAnother}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Another Product
          </Button>
        ) : null}
        <Button type="button" variant="outline" asChild>
          <Link to={`/products/${result.productId}`}>
            <Eye className="mr-1.5 h-4 w-4" />
            View Product
          </Link>
        </Button>
        {onPrintBarcode ? (
          <Button type="button" variant="outline" onClick={onPrintBarcode}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print Barcode
          </Button>
        ) : null}
        <Button type="button" variant="ghost" asChild>
          <Link to="/products">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>
    </div>
  )
}
