import { Link, useParams } from 'react-router-dom'
import { CheckCircle, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'

type SuccessSnapshot = {
  invoiceNo: string
  totalCod: number
  deliveryCharge: number
  publicShareToken?: string
  customerName: string
  phone: string
}

function readSnapshot(orderId: string): SuccessSnapshot | null {
  try {
    const raw = sessionStorage.getItem(`order-success:${orderId}`)
    if (!raw) return null
    return JSON.parse(raw) as SuccessSnapshot
  } catch {
    return null
  }
}

export function OrderSuccessPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const snapshot = orderId ? readSnapshot(orderId) : null

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-stone-500">
          Order confirmation expired in this browser. Use Track Order with your invoice number.
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <Link to="/track-order">
            <Button variant="outline" className="rounded-full">
              Track Order
            </Button>
          </Link>
          <Link to="/shop">
            <Button className="rounded-full">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-6 sm:py-16">
      <CheckCircle className="mx-auto h-16 w-16 text-success" />
      <h1 className="mt-4 font-serif text-3xl text-stone-900">Order Placed!</h1>
      <p className="mt-2 text-stone-500">
        Thank you, {snapshot.customerName}. Your COD order is saved in our retail system.
      </p>

      <div className="mt-8 rounded-xl border border-stone-200 bg-white p-5 text-left">
        <p className="text-xs uppercase tracking-wide text-stone-500">Invoice</p>
        <p className="font-mono text-xl font-semibold text-stone-900">{snapshot.invoiceNo}</p>
        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Phone</span>
            <span>{snapshot.phone}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Delivery</span>
            <span>{formatBDT(snapshot.deliveryCharge)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">COD Amount</span>
            <span className="font-semibold text-primary">{formatBDT(snapshot.totalCod)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">Status</span>
            <span>Confirmed</span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {snapshot.publicShareToken ? (
          <a
            href={`/public/invoice/${snapshot.publicShareToken}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" className="w-full rounded-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" /> View Invoice
            </Button>
          </a>
        ) : null}
        <Link to={`/track-order?order=${encodeURIComponent(snapshot.invoiceNo)}`}>
          <Button variant="outline" className="w-full rounded-full sm:w-auto">
            Track Order
          </Button>
        </Link>
        <Link to="/shop">
          <Button className="w-full rounded-full sm:w-auto">Continue Shopping</Button>
        </Link>
      </div>
    </div>
  )
}
