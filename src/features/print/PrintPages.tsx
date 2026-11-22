import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { printService } from './print.service'
import { PrintInvoiceA4 } from './PrintInvoiceA4'
import { PrintShippingLabel } from './PrintShippingLabel'
import { PrintGiftLabel } from './PrintGiftLabel'
import { PrintSaleInvoiceA4 } from './PrintSaleInvoiceA4'
import { PrintPurchaseInvoiceA4 } from './PrintPurchaseInvoiceA4'
import { PrintSalePosReceipt } from './PrintSalePosReceipt'
import { PrintSaleGiftLabel } from './PrintSaleGiftLabel'
import type { ShippingLabelSize } from './print.utils'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'

function useBulkIds() {
  const params = new URLSearchParams(window.location.search)
  return params.get('ids')?.split(',').filter(Boolean) ?? []
}

export function PrintInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useQuery({
    queryKey: ['print', 'invoice', id],
    queryFn: () => printService.getOrderForPrint(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (order) document.title = `Invoice ${order.order_id}`
  }, [order])

  if (isLoading) return <LoadingSkeleton rows={8} height="h-16" />
  if (!order) return <EmptyState title="Order not found" description="Invalid or deleted order ID." />
  return <PrintInvoiceA4 order={order} />
}

export function PrintShippingLabelPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const size = (searchParams.get('size') as ShippingLabelSize) || 'standard'

  const { data: order, isLoading } = useQuery({
    queryKey: ['print', 'shipping', id],
    queryFn: () => printService.getOrderForPrint(id!),
    enabled: !!id,
  })

  useEffect(() => {
    if (order) document.title = `Shipping Label ${order.order_id}`
  }, [order])

  const setSize = (next: ShippingLabelSize) => {
    setSearchParams({ size: next }, { replace: true })
  }

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!order) return <EmptyState title="Order not found" description="Invalid or deleted order ID." />

  return (
    <>
      <div className="no-print mx-auto mb-3 flex max-w-md flex-wrap justify-center gap-2 px-4">
        {(['standard', 'compact', 'a4-preview'] as ShippingLabelSize[]).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={size === s ? 'default' : 'outline'}
            onClick={() => setSize(s)}
          >
            {s === 'standard' && '100×150mm'}
            {s === 'compact' && '80×100mm'}
            {s === 'a4-preview' && 'A4 Preview'}
          </Button>
        ))}
      </div>
      <PrintShippingLabel order={order} size={size} />
    </>
  )
}

export function PrintGiftLabelPage() {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading } = useQuery({
    queryKey: ['print', 'gift', id],
    queryFn: () => printService.getOrderForPrint(id!),
    enabled: !!id,
  })
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!order) return <EmptyState title="Order not found" />
  return <PrintGiftLabel order={order} />
}

export function PrintSaleA4Page() {
  const { id } = useParams<{ id: string }>()
  const { data: sale, isLoading } = useQuery({
    queryKey: ['print', 'sale-a4', id],
    queryFn: () => printService.getSaleForPrint(id!),
    enabled: !!id,
  })
  useEffect(() => {
    if (sale) document.title = `Invoice ${sale.saleNo}`
  }, [sale])
  if (isLoading) return <LoadingSkeleton rows={8} />
  if (!sale) return <EmptyState title="Sale not found" />
  return <PrintSaleInvoiceA4 sale={sale} />
}

export function PrintPurchaseA4Page() {
  const { id } = useParams<{ id: string }>()
  const { data: purchase, isLoading } = useQuery({
    queryKey: ['print', 'purchase-a4', id],
    queryFn: () => printService.getPurchaseForPrint(id!),
    enabled: !!id,
  })
  useEffect(() => {
    if (purchase) document.title = `Purchase ${purchase.purchaseNo}`
  }, [purchase])
  if (isLoading) return <LoadingSkeleton rows={8} />
  if (!purchase) return <EmptyState title="Purchase not found" />
  return <PrintPurchaseInvoiceA4 purchase={purchase} />
}

export function PrintSalePosPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const width = (searchParams.get('width') as '58mm' | '80mm') || '80mm'
  const { data: sale, isLoading } = useQuery({
    queryKey: ['print', 'sale-pos', id],
    queryFn: () => printService.getSaleForPrint(id!),
    enabled: !!id,
  })
  useEffect(() => {
    if (sale) document.title = `POS ${sale.saleNo}`
  }, [sale])
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!sale) return <EmptyState title="Sale not found" />
  return (
    <>
      <div className="no-print mx-auto mb-3 flex justify-center gap-2">
        {(['58mm', '80mm'] as const).map((w) => (
          <Button
            key={w}
            size="sm"
            variant={width === w ? 'default' : 'outline'}
            onClick={() => setSearchParams({ width: w }, { replace: true })}
          >
            {w}
          </Button>
        ))}
      </div>
      <PrintSalePosReceipt sale={sale} width={width} />
    </>
  )
}

export { PrintSalesReportPage } from './PrintSalesReportPage'

export function PrintSaleGiftLabelPage() {
  const { id } = useParams<{ id: string }>()
  const { data: sale, isLoading } = useQuery({
    queryKey: ['print', 'sale-gift', id],
    queryFn: () => printService.getSaleForPrint(id!),
    enabled: !!id,
  })
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!sale) return <EmptyState title="Sale not found" />
  return <PrintSaleGiftLabel sale={sale} />
}

export function PrintBulkInvoicesPage() {
  const ids = useBulkIds()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['print', 'bulk-invoices', ids],
    queryFn: () => printService.getOrdersForBulkPrint(ids),
    enabled: ids.length > 0,
  })
  if (!ids.length) return <EmptyState title="No orders selected" description="Select orders to print invoices." />
  if (isLoading) return <LoadingSkeleton rows={8} />
  if (!orders?.length) return <EmptyState title="Orders not found" />
  return (
    <>
      {orders.map((order, i) => (
        <div key={order.id} className={i < orders.length - 1 ? 'page-break' : ''}>
          <PrintInvoiceA4 order={order} />
        </div>
      ))}
    </>
  )
}

export function PrintBulkShippingLabelsPage() {
  const ids = useBulkIds()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['print', 'bulk-shipping', ids],
    queryFn: () => printService.getOrdersForBulkPrint(ids),
    enabled: ids.length > 0,
  })
  if (!ids.length) return <EmptyState title="No orders selected" />
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!orders?.length) return <EmptyState title="Orders not found" />
  return (
    <>
      {orders.map((order, i) => (
        <div key={order.id} className={i < orders.length - 1 ? 'page-break' : ''}>
          <PrintShippingLabel order={order} />
        </div>
      ))}
    </>
  )
}

export function PrintBulkGiftLabelsPage() {
  const ids = useBulkIds()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['print', 'bulk-gift', ids],
    queryFn: () => printService.getOrdersForBulkPrint(ids),
    enabled: ids.length > 0,
  })
  if (!ids.length) return <EmptyState title="No orders selected" />
  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!orders?.length) return <EmptyState title="Orders not found" />
  return (
    <>
      {orders.map((order, i) => (
        <div key={order.id} className={i < orders.length - 1 ? 'page-break' : ''}>
          <PrintGiftLabel order={order} />
        </div>
      ))}
    </>
  )
}

const REPORT_SLUG_LABELS: Record<string, string> = {
  order: 'Order Report',
  courier: 'Courier Report',
  store: 'Store Report',
  collection: 'Collection Report',
  fraud: 'Fraud Report',
  'product-stock': 'Product Stock Report',
  invoice: 'Invoice Report',
}

/**
 * Legacy OMS/mock print path — retired for ERP Reports V3.
 * Use on-screen Export/Print on `/reports/*` or `/print/sales/report`.
 */
export function PrintReportPage() {
  const { reportType = '' } = useParams<{ reportType: string }>()
  const erpRedirect =
    reportType === 'order' || reportType === 'invoice'
      ? '/print/sales/report'
      : reportType === 'product-stock'
        ? '/reports/inventory'
        : '/reports'

  return (
    <div className="mx-auto max-w-lg space-y-4 p-6">
      <EmptyState
        title="Legacy report print retired"
        description={`“${REPORT_SLUG_LABELS[reportType] ?? (reportType || 'Report')}” used a mock data path that did not match live ledger authorities. Open the live Reports center or sales print instead.`}
      />
      <div className="flex flex-wrap gap-2">
        <Link to="/reports">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5" />
            Reports center
          </Button>
        </Link>
        <Link to={erpRedirect}>
          <Button size="sm">Continue</Button>
        </Link>
      </div>
    </div>
  )
}
