import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { invoicesService } from '@/features/invoices/invoices.service'
import { Skeleton } from '@/components/ui/skeleton'

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>()

  const { data: order, isLoading } = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersService.getOrderById(orderId!),
    enabled: !!orderId,
  })

  const { data: invoice } = useQuery({
    queryKey: ['invoices', 'by-order', orderId],
    queryFn: () => invoicesService.getInvoiceByOrderId(orderId!),
    enabled: !!orderId,
  })

  if (isLoading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
        <Skeleton className="mx-auto h-16 w-16 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-8 w-48" />
      </div>
    )
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-stone-500">Order not found</p>
        <Link to="/"><Button className="mt-4 rounded-full">Go Home</Button></Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-6 sm:py-16">
      <CheckCircle className="mx-auto h-16 w-16 text-success" />
      <h1 className="mt-4 font-serif text-3xl text-stone-900">Order Placed!</h1>
      <p className="mt-2 text-stone-500">Thank you for shopping with us. Your order is synced with our system.</p>

      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-5 text-left">
        <p className="text-xs uppercase tracking-wide text-stone-500">Order ID</p>
        <p className="font-mono text-xl font-semibold text-stone-900">{order.order_id}</p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between"><span className="text-stone-500">Product</span><span>{order.product_name}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">COD Amount</span><span className="font-semibold text-primary">{formatBDT(order.cod_amount)}</span></div>
          <div className="flex justify-between"><span className="text-stone-500">Status</span><span>{order.status}</span></div>
          {invoice && (
            <div className="flex justify-between"><span className="text-stone-500">Invoice</span><span className="font-mono">{invoice.invoice_no}</span></div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {invoice && (
          <a href={`/print/orders/${order.id}/invoice`} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" className="w-full rounded-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" /> Print Invoice
            </Button>
          </a>
        )}
        <Link to={`/track-order?order=${order.order_id}`}>
          <Button variant="outline" className="w-full rounded-full sm:w-auto">
            <Download className="mr-2 h-4 w-4" /> Track Order
          </Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full rounded-full sm:w-auto">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  )
}
