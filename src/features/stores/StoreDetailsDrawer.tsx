import { useQuery } from '@tanstack/react-query'
import { Store as StoreIcon } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ordersService } from '@/features/storefront/legacy-oms/orders.service'
import { MOCK_COURIERS } from '@/lib/mock-data'
import { formatBDT, formatDateShort } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Store } from './stores.types'

interface StoreDetailsDrawerProps {
  store: Store | null
  onClose: () => void
}

const typeLabels: Record<Store['type'], string> = {
  facebook: 'Facebook',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  instagram: 'Instagram',
  manual: 'Manual',
}

const statusVariant = {
  active: 'success' as const,
  inactive: 'default' as const,
  archived: 'warning' as const,
}

const apiStatusColors = {
  connected: 'text-success',
  not_connected: 'text-text-muted',
  error: 'text-danger',
}

export function StoreDetailsDrawer({ store, onClose }: StoreDetailsDrawerProps) {
  const { data: orders } = useQuery({
    queryKey: ['orders', 'store', store?.id],
    queryFn: () => ordersService.getOrders({ store: store!.id }),
    enabled: !!store?.id,
  })

  const recentOrders = orders?.slice(0, 5) ?? []
  const courier = MOCK_COURIERS.find((c) => c.id === store?.default_courier_id)

  return (
    <Sheet open={!!store} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {store && (
          <>
            <SheetHeader>
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                  {store.logo_url ? (
                    <img
                      src={store.logo_url}
                      alt=""
                      className="h-8 w-8 rounded-lg object-cover"
                    />
                  ) : (
                    <StoreIcon className="h-5 w-5 text-indigo-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <SheetTitle>{store.name}</SheetTitle>
                  <SheetDescription>{typeLabels[store.type]}</SheetDescription>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant={statusVariant[store.status]} className="capitalize">
                  {store.status}
                </Badge>
                <Badge variant="default" className={cn('capitalize', apiStatusColors[store.api_status])}>
                  API: {store.api_status.replace('_', ' ')}
                </Badge>
              </div>
            </SheetHeader>

            <div className="mt-6 space-y-4">
              <section className="space-y-2 rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold">Contact & Settings</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Invoice Prefix</span>
                    <span className="font-mono font-medium">{store.invoice_prefix}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Phone</span>
                    <span>{store.phone || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Email</span>
                    <span className="truncate">{store.email || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Address</span>
                    <span className="text-right">{store.address || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-muted">Default Courier</span>
                    <span>{courier?.name ?? '—'}</span>
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Recent Orders</h3>
                {recentOrders.length === 0 ? (
                  <p className="text-sm text-text-muted">No orders for this store yet.</p>
                ) : (
                  <div className="space-y-2">
                    {recentOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-xl border border-border p-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium">{order.order_id}</p>
                            <p className="text-xs text-text-muted">{order.customer_name}</p>
                          </div>
                          <StatusBadge status={order.status} />
                        </div>
                        <div className="mt-2 flex justify-between text-xs">
                          <span className="text-text-muted">{formatDateShort(order.created_at)}</span>
                          <span className="font-medium">{formatBDT(order.cod_amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
