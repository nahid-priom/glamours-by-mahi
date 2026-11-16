import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Loader2 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KpiGrid } from '@/components/common/KpiGrid'
import { EntityToolbar } from '@/components/common/EntityToolbar'
import { MobileEntityCard } from '@/components/common/MobileEntityCard'
import { ActionDropdown } from '@/components/common/ActionDropdown'
import { SearchInput } from '@/components/shared/SearchInput'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { couriersService } from './couriers.service'
import { courierApiDemoService } from './courier-api-demo.service'
import { CourierFormDialog } from './CourierFormDialog'
import { CourierDetailsDrawer } from './CourierDetailsDrawer'
import { CourierApiConfigDialog } from './CourierApiConfigDialog'
import type { Courier, CourierFormInput } from './couriers.types'
import { toastRpcError } from '@/lib/errors/rpc-error'

const connectionVariant = {
  connected: 'success' as const,
  disconnected: 'default' as const,
  testing: 'warning' as const,
  failed: 'danger' as const,
}

export function CouriersPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Courier['status']>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Courier | null>(null)
  const [detailsCourier, setDetailsCourier] = useState<Courier | null>(null)
  const [apiCourier, setApiCourier] = useState<Courier | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<Courier | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const filters = useMemo(
    () => ({ search, status: statusFilter }),
    [search, statusFilter],
  )

  const { data: couriers, isLoading } = useQuery({
    queryKey: ['couriers', filters],
    queryFn: () => couriersService.getCouriers(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['couriers', 'stats'],
    queryFn: () => couriersService.getStats(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['couriers'] })

  const createMutation = useMutation({
    mutationFn: (data: CourierFormInput) => couriersService.createCourier(data),
    onSuccess: () => { invalidate(); toast('Courier added') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CourierFormInput }) =>
      couriersService.updateCourier(id, data),
    onSuccess: () => { invalidate(); toast('Courier updated') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const apiConfigMutation = useMutation({
    mutationFn: ({ id, config }: { id: string; config: Parameters<typeof couriersService.updateApiConfig>[1] }) =>
      couriersService.updateApiConfig(id, config),
    onSuccess: () => { invalidate(); toast('API settings saved') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => couriersService.softDelete(id),
    onSuccess: () => { invalidate(); toast('Courier archived'); setArchiveTarget(null) },
  })

  const handleFormSubmit = async (data: CourierFormInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditing(null)
  }

  const handleTestConnection = async (courier: Courier) => {
    setTestingId(courier.id)
    try {
      const result = await courierApiDemoService.testCourierConnection(courier.id)
      if (result.success) {
        await couriersService.updateCourier(courier.id, { connection_status: 'connected' })
        invalidate()
      }
      toast(result.message, result.success ? 'success' : 'error')
    } finally {
      setTestingId(null)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const result = await courierApiDemoService.syncCourierStatusesDemo()
      invalidate()
      toast(result.message)
    } finally {
      setSyncing(false)
    }
  }

  const kpis = [
    { label: 'Active Couriers', value: stats?.active ?? 0 },
    { label: 'Connected APIs', value: stats?.connected ?? 0, color: 'text-success' },
    { label: 'Pending Parcels', value: stats?.pending_parcels ?? 0, color: 'text-warning' },
    { label: 'Delivery Success', value: `${stats?.avg_success_rate ?? 0}%`, color: 'text-success' },
  ]

  const getActions = (courier: Courier) => [
    { label: 'View Details', onClick: () => setDetailsCourier(courier) },
    { label: 'Edit Courier', onClick: () => { setEditing(courier); setFormOpen(true) } },
    { label: 'API Settings', onClick: () => setApiCourier(courier) },
    { separator: true, label: '', onClick: () => {} },
    {
      label: 'Test Connection',
      onClick: () => handleTestConnection(courier),
      disabled: testingId === courier.id,
    },
    { label: 'Sync Status', onClick: handleSync, disabled: syncing },
    { separator: true, label: '', onClick: () => {} },
    courier.status === 'active'
      ? { label: 'Disable', onClick: () => couriersService.disableCourier(courier.id).then(invalidate) }
      : { label: 'Enable', onClick: () => couriersService.enableCourier(courier.id).then(invalidate) },
    { label: 'Archive', onClick: () => setArchiveTarget(courier), variant: 'danger' as const },
  ]

  return (
    <PageShell
      title="Couriers"
      description="Multi-courier integration and performance"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync Status
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add Courier
          </Button>
        </div>
      }
    >
      <KpiGrid items={kpis} />

      <EntityToolbar
        search={<SearchInput value={search} onChange={setSearch} placeholder="Search couriers..." />}
        filters={
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : !couriers?.length ? (
        <EmptyState
          title="No couriers found"
          actionLabel="Add Courier"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {couriers.map((courier) => (
              <Card key={courier.id} className={courier.status === 'inactive' ? 'opacity-70' : undefined}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => setDetailsCourier(courier)}
                    >
                      <p className="font-semibold">{courier.name}</p>
                      <p className="text-xs text-text-muted">{courier.code}</p>
                    </button>
                    <div className="flex items-center gap-1">
                      <Badge variant={connectionVariant[courier.connection_status]} className="capitalize text-xs">
                        {courier.connection_status}
                      </Badge>
                      <ActionDropdown items={getActions(courier)} />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Metric label="Success" value={`${courier.success_rate}%`} color="text-success" />
                    <Metric label="Pending" value={courier.pending_parcels} />
                    <Metric label="Delivered" value={courier.delivered_parcels} color="text-success" />
                    <Metric label="Returned" value={courier.returned_parcels} color="text-danger" />
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold">
                    Collection: {formatBDT(courier.collection_amount)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-3 sm:hidden">
            {couriers.map((courier) => (
              <MobileEntityCard
                key={courier.id}
                title={courier.name}
                subtitle={`${courier.code} · ${courier.connection_status}`}
                badges={
                  <Badge variant={connectionVariant[courier.connection_status]} className="capitalize">
                    {courier.connection_status}
                  </Badge>
                }
                rows={[
                  { label: 'Success Rate', value: `${courier.success_rate}%` },
                  { label: 'Pending', value: courier.pending_parcels },
                  { label: 'Collection', value: formatBDT(courier.collection_amount) },
                ]}
                actions={getActions(courier)}
                onClick={() => setDetailsCourier(courier)}
                muted={courier.status === 'inactive'}
              />
            ))}
          </div>
        </>
      )}

      <CourierFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        courier={editing}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <CourierDetailsDrawer
        courier={detailsCourier}
        open={!!detailsCourier}
        onOpenChange={() => setDetailsCourier(null)}
        onEdit={(c) => { setEditing(c); setFormOpen(true) }}
        onApiSettings={setApiCourier}
      />

      <CourierApiConfigDialog
        open={!!apiCourier}
        onOpenChange={() => setApiCourier(null)}
        courier={apiCourier}
        onSave={async (id, config) => { await apiConfigMutation.mutateAsync({ id, config }) }}
        onTestComplete={(msg, ok) => toast(msg, ok ? 'success' : 'error')}
        loading={apiConfigMutation.isPending}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={() => setArchiveTarget(null)}
        title="Archive Courier"
        description={`Archive "${archiveTarget?.name}"? It will be hidden from active lists.`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiveMutation.isPending}
        onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)}
      />
    </PageShell>
  )
}

function Metric({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-center">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={cn('text-sm font-bold', color)}>{value}</p>
    </div>
  )
}
