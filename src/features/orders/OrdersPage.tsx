import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, X } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { ordersService } from './orders.service'
import { OrderFilters } from './components/OrderFilters'
import { OrderStatusTabs } from './components/OrderStatusTabs'
import { OrderBulkActions } from './components/OrderBulkActions'
import { OrderTable } from './components/OrderTable'
import { OrderActionSheet } from './components/OrderActionSheet'
import { OrderDetailsDrawer } from './OrderDetailsDrawer'
import type { Order } from '@/types'
import type { OrderStatus } from '@/lib/constants'
import { MOCK_COURIERS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

function openPrint(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

const QUICK_ACTION_HINTS: Record<string, string> = {
  'book-courier': 'Select one or more orders below, then use Bulk Book Courier from the action bar.',
  invoice: 'Select orders below, then click Bulk A4 Invoice to print.',
  'shipping-label': 'Select orders below, then click Bulk Shipping Label to print.',
  'gift-label': 'Select orders below, then click Bulk Gift Label to print.',
}

export function OrdersPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const quickAction = searchParams.get('quick')
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [storeFilter, setStoreFilter] = useState('all')
  const [courierFilter, setCourierFilter] = useState('all')
  const [fraudFilter, setFraudFilter] = useState('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [drawerOrder, setDrawerOrder] = useState<Order | null>(null)
  const [actionSheetOrder, setActionSheetOrder] = useState<Order | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null)
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null)

  const dismissQuickHint = () => {
    searchParams.delete('quick')
    setSearchParams(searchParams, { replace: true })
  }

  const filters = useMemo(() => {
    if (statusFilter === 'high_fraud') {
      return { search, fraud_level: 'HIGH', store: storeFilter, courier: courierFilter, include_deleted: showDeleted }
    }
    return {
      search,
      status: statusFilter as OrderStatus | 'all',
      store: storeFilter,
      courier: courierFilter,
      fraud_level: fraudFilter,
      include_deleted: showDeleted,
    }
  }, [search, statusFilter, storeFilter, courierFilter, fraudFilter, showDeleted])

  const { data: stats } = useQuery({
    queryKey: ['orders', 'stats'],
    queryFn: () => ordersService.getOrderStats(),
  })

  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => ordersService.getOrders(filters),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['orders'] })

  const steadfast = MOCK_COURIERS.find((c) => c.id === 'c1')!

  const bookCourierMutation = useMutation({
    mutationFn: ({ orderId, courierId, courierName }: { orderId: string; courierId: string; courierName: string }) =>
      ordersService.bookCourier(orderId, courierId, courierName),
    onSuccess: () => { invalidate(); toast('Courier booked') },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const bulkBookCourierMutation = useMutation({
    mutationFn: (ids: string[]) => ordersService.bulkBookCourier(ids, steadfast.id, steadfast.name),
    onSuccess: (results) => {
      invalidate()
      toast(`Courier booked for ${results.length} order(s)`)
      setSelectedIds(new Set())
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const cancelOrderMutation = useMutation({
    mutationFn: (id: string) => ordersService.updateStatus(id, 'Cancelled'),
    onSuccess: () => { invalidate(); toast('Order cancelled'); setCancelOrderTarget(null) },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ordersService.softDelete(id),
    onSuccess: () => { invalidate(); toast('Order archived'); setDeleteTarget(null) },
  })

  const bulkStatusMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: OrderStatus }) =>
      ordersService.bulkUpdateStatus(ids, status),
    onSuccess: () => { invalidate(); toast('Bulk status updated'); setSelectedIds(new Set()) },
  })

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!orders) return
    setSelectedIds(selectedIds.size === orders.length ? new Set() : new Set(orders.map((o) => o.id)))
  }

  const miniKpis = [
    { label: 'Total', value: stats?.total ?? 0 },
    { label: 'New', value: stats?.new ?? 0, color: 'text-blue-600' },
    { label: 'In Transit', value: (stats?.courier_booked ?? 0) + (stats?.shipped ?? 0), color: 'text-warning' },
    { label: 'Delivered', value: stats?.delivered ?? 0, color: 'text-success' },
    { label: 'Fraud Risk', value: stats?.high_fraud ?? 0, color: 'text-danger' },
  ]

  const sheetOrder = actionSheetOrder

  return (
    <PageShell
      title="Orders"
      description="Manage multi-store orders and courier automation"
      actions={
        <Link to="/orders/new">
          <Button><Plus className="h-4 w-4" /> New Order</Button>
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {miniKpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="text-center">
              <p className="text-xs text-text-muted">{k.label}</p>
              <p className={cn('mt-1 text-lg font-bold', k.color)}>{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {quickAction && QUICK_ACTION_HINTS[quickAction] && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-900">{QUICK_ACTION_HINTS[quickAction]}</p>
          <button
            type="button"
            onClick={dismissQuickHint}
            className="shrink-0 rounded-lg p-1 text-blue-700 hover:bg-blue-100"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <OrderFilters
        search={search}
        onSearchChange={setSearch}
        store={storeFilter}
        courier={courierFilter}
        fraud={fraudFilter}
        showDeleted={showDeleted}
        onStoreChange={setStoreFilter}
        onCourierChange={setCourierFilter}
        onFraudChange={setFraudFilter}
        onShowDeletedChange={setShowDeleted}
      />

      <OrderBulkActions
        selectedIds={selectedIds}
        onBulkStatus={(status) => bulkStatusMutation.mutate({ ids: Array.from(selectedIds), status })}
        onBulkBookCourier={() => bulkBookCourierMutation.mutate(Array.from(selectedIds))}
        onClear={() => setSelectedIds(new Set())}
        statusLoading={bulkStatusMutation.isPending}
        courierLoading={bulkBookCourierMutation.isPending}
      />

      <OrderStatusTabs active={statusFilter} onChange={setStatusFilter} />

      <Card>
        <CardContent className="overflow-hidden p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : (
            <OrderTable
              orders={orders ?? []}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
              onView={setDrawerOrder}
              onOpenActionSheet={setActionSheetOrder}
            />
          )}
        </CardContent>
      </Card>

      <OrderActionSheet
        order={sheetOrder}
        open={!!sheetOrder}
        onOpenChange={(open) => { if (!open) setActionSheetOrder(null) }}
        onView={() => sheetOrder && setDrawerOrder(sheetOrder)}
        onEdit={() => sheetOrder && navigate(`/orders/${sheetOrder.id}/edit`)}
        onPrintInvoice={() => sheetOrder && openPrint(`/print/orders/${sheetOrder.id}/invoice`)}
        onPrintShippingLabel={() => sheetOrder && openPrint(`/print/orders/${sheetOrder.id}/shipping-label`)}
        onPrintGiftLabel={() => sheetOrder && openPrint(`/print/orders/${sheetOrder.id}/gift-label`)}
        onBookCourier={() =>
          sheetOrder &&
          bookCourierMutation.mutate({
            orderId: sheetOrder.id,
            courierId: steadfast.id,
            courierName: steadfast.name,
          })
        }
        onTrackCourier={() =>
          sheetOrder && openPrint(`/print/orders/${sheetOrder.id}/shipping-label`)
        }
        onChangeStatus={() => sheetOrder && setDrawerOrder(sheetOrder)}
        onCancelOrder={() => sheetOrder && setCancelOrderTarget(sheetOrder)}
        onDeleteOrder={() => sheetOrder && setDeleteTarget(sheetOrder)}
      />

      <OrderDetailsDrawer order={drawerOrder} onClose={() => setDrawerOrder(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete Order"
        description={`Archive order ${deleteTarget?.order_id}? It will be hidden from the list.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <ConfirmDialog
        open={!!cancelOrderTarget}
        onOpenChange={() => setCancelOrderTarget(null)}
        title="Cancel Order"
        description={`Cancel order ${cancelOrderTarget?.order_id}? This cannot be undone easily.`}
        confirmLabel="Cancel Order"
        variant="danger"
        onConfirm={() => cancelOrderTarget && cancelOrderMutation.mutate(cancelOrderTarget.id)}
      />
    </PageShell>
  )
}
