import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, RotateCcw, Search, Truck } from 'lucide-react'
import type { Order } from '@/types'
import { ORDER_STATUSES } from '@/lib/constants'
import { formatBDT, formatDateShort } from '@/lib/format'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { useCart } from '../cart.context'
import { storefrontService } from '../storefront.service'
import { useAccount } from './account.context'
import { getOrdersForPhone } from './account.service'
import { AccountOrderDetailsDialog } from './AccountOrderDetailsDialog'
import { ProductImage } from '@/components/common/ProductImage'
import { Skeleton } from '@/components/ui/skeleton'
import type { AccountOrderFilters } from './account.types'

function OrderRowImage({ order }: { order: Order }) {
  const { data: product } = useQuery({
    queryKey: ['account', 'order-thumb', order.product_id],
    queryFn: () => storefrontService.getProductById(order.product_id!),
    enabled: !!order.product_id,
  })

  if (!product) {
    return <div className="h-16 w-14 shrink-0 rounded-xl bg-[#FFF9FB]" />
  }

  return (
    <div className="h-16 w-14 shrink-0 overflow-hidden rounded-xl bg-[#FFF9FB]">
      <ProductImage product={product} alt={product.alt} className="h-16 w-14" aspectRatio="portrait" />
    </div>
  )
}

export function AccountOrdersPage() {
  const { session } = useAccount()
  const { addItem } = useCart()
  const { toast } = useToast()
  const phone = session?.phone ?? ''

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<AccountOrderFilters['status']>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const filters = useMemo(() => ({ search, status }), [search, status])

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['account', 'orders', phone, filters],
    queryFn: () => getOrdersForPhone(phone, filters),
    enabled: phone.length >= 11,
  })

  const handleReorder = async (order: Order) => {
    if (!order.product_id) {
      toast('Product unavailable for reorder', 'error')
      return
    }
    const product = await storefrontService.getProductById(order.product_id)
    if (!product) {
      toast('Product no longer available', 'error')
      return
    }
    addItem(product, order.quantity || 1)
    toast('Added to cart')
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#22171C]/8 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-serif text-2xl text-[#22171C]">Order History</h2>
        <p className="mt-1 text-sm text-[#6B7280]">Search, filter, and manage your purchases</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID, product, tracking…"
              className="rounded-full pl-10"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AccountOrderFilters['status'])}
            className="rounded-full border border-[#22171C]/10 bg-[#FFF9FB] px-4 py-2 text-sm outline-none"
          >
            <option value="all">All Status</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-3xl" />
          ))}
        </div>
      )}

      {!isLoading && orders.length === 0 && (
        <div className="rounded-3xl border border-dashed border-[#22171C]/15 bg-white py-16 text-center">
          <p className="font-serif text-xl text-[#22171C]">No orders found</p>
          <p className="mt-2 text-sm text-[#6B7280]">Try a different search or place your first order.</p>
          <Link to="/shop">
            <Button className="mt-4 rounded-full">Shop Now</Button>
          </Link>
        </div>
      )}

      <ul className="space-y-4">
        {orders.map((order) => (
          <li
            key={order.id}
            className="overflow-hidden rounded-3xl border border-[#22171C]/8 bg-white shadow-sm"
          >
            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
              <OrderRowImage order={order} />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-semibold text-[#22171C]">{order.order_id}</p>
                    <p className="mt-1 text-sm font-medium text-[#22171C]">{order.product_name}</p>
                    <p className="mt-1 text-xs text-[#6B7280]">{formatDateShort(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={order.status} />
                    <p className="mt-1 text-sm font-semibold text-[#FF3F7F]">{formatBDT(order.cod_amount)}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280]">
                  {order.courier_name && <span>Courier: {order.courier_name}</span>}
                  {order.tracking_id && <span className="font-mono">Tracking: {order.tracking_id}</span>}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to={`/track-order?order=${order.order_id}`}>
                    <Button size="sm" variant="outline" className="rounded-full">
                      <Truck className="mr-1.5 h-3.5 w-3.5" />
                      Track
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setSelectedOrder(order)}
                  >
                    View Details
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => window.open(`/print/orders/${order.id}/invoice`, '_blank')}
                  >
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    Invoice
                  </Button>
                  <Button size="sm" className="rounded-full" onClick={() => handleReorder(order)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Reorder
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <AccountOrderDetailsDialog
        order={selectedOrder}
        open={!!selectedOrder}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
      />
    </div>
  )
}
