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
import { courierRepository } from '@/features/couriers'
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

const apiStatusColors = {
  connected: 'text-success',
  not_connected: 'text-text-muted',
  error: 'text-danger',
}

export function StoreDetailsDrawer({ store, onClose }: StoreDetailsDrawerProps) {
  const { data: companies = [] } = useQuery({
    queryKey: ['courier-companies', 'store-drawer'],
    queryFn: () => courierRepository.listCompanies(),
    enabled: !!store,
  })

  const courier = companies.find((c) => c.id === store?.default_courier_id)

  if (!store) return null

  return (
    <Sheet open={!!store} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <StoreIcon className="h-6 w-6 text-text-muted" />
            </div>
            <div>
              <SheetTitle>{store.name}</SheetTitle>
              <SheetDescription>{typeLabels[store.type]}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Status</span>
            <Badge
              variant={
                store.status === 'active'
                  ? 'success'
                  : store.status === 'archived'
                    ? 'warning'
                    : 'default'
              }
            >
              {store.status}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">API</span>
            <span className={cn('font-medium', apiStatusColors[store.api_status])}>
              {store.api_status.replace('_', ' ')}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Invoice prefix</span>
            <Badge>{store.invoice_prefix}</Badge>
          </div>
          {courier ? (
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Default courier</span>
              <span>{courier.name}</span>
            </div>
          ) : null}
          {store.phone ? (
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Phone</span>
              <span>{store.phone}</span>
            </div>
          ) : null}
          {store.email ? (
            <div className="flex items-center justify-between">
              <span className="text-text-muted">Email</span>
              <span className="truncate">{store.email}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Created</span>
            <span>{formatDateShort(store.created_at)}</span>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <p className="text-xs text-text-muted">
              Online channel sales post into Supabase inventory and accounts. Order history for this
              store appears under Sales with channel filters.
            </p>
            <p className="mt-2 text-xs font-medium text-text-muted">
              Lifetime GMV placeholder: {formatBDT(0)}
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
