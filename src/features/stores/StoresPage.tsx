import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/ui/toast'
import { KpiGrid, EntityToolbar, MobileEntityCard } from '@/components/common'
import { storesService } from './stores.service'
import { StoreFormDialog } from './StoreFormDialog'
import { StoreDetailsDrawer } from './StoreDetailsDrawer'
import type { Store, StoreFormInput, StoreStatus, StoreType } from './stores.types'
import { cn } from '@/lib/utils'
import { toastRpcError } from '@/lib/errors/rpc-error'

const selectTriggerClass = 'h-11 w-full sm:w-[160px]'

const typeLabels: Record<StoreType, string> = {
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

const apiStatusVariant = {
  connected: 'success' as const,
  not_connected: 'default' as const,
  error: 'danger' as const,
}

export function StoresPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [type, setType] = useState<StoreType | 'all'>('all')
  const [status, setStatus] = useState<StoreStatus | 'all'>('all')
  const [showDeleted, setShowDeleted] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Store | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Store | null>(null)
  const [drawerStore, setDrawerStore] = useState<Store | null>(null)

  const filters = useMemo(
    () => ({ search, type, status, include_deleted: showDeleted }),
    [search, type, status, showDeleted],
  )

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores', filters],
    queryFn: () => storesService.getStores(filters),
  })

  const { data: stats } = useQuery({
    queryKey: ['stores', 'stats'],
    queryFn: () => storesService.getStats(),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['stores'] })

  const createMutation = useMutation({
    mutationFn: (data: StoreFormInput) => storesService.create(data),
    onSuccess: () => {
      invalidate()
      toast('Store created successfully')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: StoreFormInput }) =>
      storesService.update(id, data),
    onSuccess: () => {
      invalidate()
      toast('Store updated')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => storesService.softDelete(id),
    onSuccess: () => {
      invalidate()
      toast('Store archived')
      setDeleteTarget(null)
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => storesService.restore(id),
    onSuccess: () => {
      invalidate()
      toast('Store restored')
    },
  })

  const handleFormSubmit = async (data: StoreFormInput) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
    setEditing(null)
  }

  const getActions = (store: Store) => {
    if (store.deleted_at) {
      return [
        {
          label: 'Restore',
          onClick: () => restoreMutation.mutate(store.id),
        },
      ]
    }
    return [
      { label: 'View Details', onClick: () => setDrawerStore(store) },
      {
        label: 'Edit',
        onClick: () => {
          setEditing(store)
          setFormOpen(true)
        },
      },
      { label: 'Archive', onClick: () => setDeleteTarget(store), variant: 'danger' as const },
    ]
  }

  const kpis = [
    { label: 'Total Stores', value: stats?.total ?? 0 },
    { label: 'Active', value: stats?.active ?? 0, color: 'text-success' },
    { label: 'Connected', value: stats?.connected ?? 0, color: 'text-indigo-600' },
    { label: 'Inactive', value: stats?.inactive ?? 0, color: 'text-warning' },
  ]

  return (
    <PageShell
      title="Stores"
      description="Multi-store order management"
      actions={
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          Add Store
        </Button>
      }
    >
      <KpiGrid items={kpis} />

      <EntityToolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name, prefix, email, or phone..."
          />
        }
        filters={
          <>
            <Select value={type} onValueChange={(v) => setType(v as StoreType | 'all')}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="woocommerce">WooCommerce</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={status} onValueChange={(v) => setStatus(v as StoreStatus | 'all')}>
              <SelectTrigger className={selectTriggerClass}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-1 text-sm text-slate-600">
              <Checkbox
                checked={showDeleted}
                onCheckedChange={(checked) => setShowDeleted(checked === true)}
              />
              Show archived
            </label>
          </>
        }
      />

      <Card>
        <CardContent className="overflow-hidden p-0">
          {isLoading ? (
            <LoadingSkeleton />
          ) : !stores?.length ? (
            <EmptyState
              title="No stores found"
              actionLabel="Add Store"
              onAction={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
                      <th className="px-4 py-3 font-medium sm:px-5">Store</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Type</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Prefix</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Contact</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                      <th className="px-4 py-3 font-medium sm:px-5">API</th>
                      <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stores.map((store) => (
                      <tr
                        key={store.id}
                        className={cn(
                          'cursor-pointer border-b border-border/50 hover:bg-slate-50/50',
                          store.deleted_at && 'opacity-60',
                        )}
                        onClick={() => setDrawerStore(store)}
                      >
                        <td className="px-4 py-3 font-medium sm:px-5">{store.name}</td>
                        <td className="px-4 py-3 capitalize sm:px-5">{typeLabels[store.type]}</td>
                        <td className="px-4 py-3 font-mono text-xs sm:px-5">
                          {store.invoice_prefix}
                        </td>
                        <td className="px-4 py-3 text-xs sm:px-5">
                          <p>{store.phone || '—'}</p>
                          <p className="text-text-muted">{store.email || ''}</p>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <Badge variant={statusVariant[store.status]} className="capitalize">
                            {store.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 sm:px-5">
                          <Badge variant={apiStatusVariant[store.api_status]} className="capitalize">
                            {store.api_status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 sm:px-5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1">
                            {!store.deleted_at ? (
                              <>
                                <Button
                                  variant="blue"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    setEditing(store)
                                    setFormOpen(true)
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => setDeleteTarget(store)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="success"
                                size="sm"
                                className="h-7 px-2"
                                onClick={() => restoreMutation.mutate(store.id)}
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 p-4 md:hidden">
                {stores.map((store) => (
                  <MobileEntityCard
                    key={store.id}
                    title={store.name}
                    subtitle={typeLabels[store.type]}
                    muted={!!store.deleted_at}
                    onClick={() => setDrawerStore(store)}
                    badges={
                      <>
                        <Badge variant={statusVariant[store.status]} className="capitalize">
                          {store.status}
                        </Badge>
                        <Badge variant={apiStatusVariant[store.api_status]} className="capitalize">
                          {store.api_status.replace('_', ' ')}
                        </Badge>
                      </>
                    }
                    rows={[
                      { label: 'Prefix', value: store.invoice_prefix },
                      { label: 'Phone', value: store.phone || '—' },
                      { label: 'Email', value: store.email || '—' },
                    ]}
                    actions={getActions(store)}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <StoreFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        store={editing}
        onSubmit={handleFormSubmit}
        loading={createMutation.isPending || updateMutation.isPending}
      />

      <StoreDetailsDrawer store={drawerStore} onClose={() => setDrawerStore(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Archive Store"
        description={`Archive "${deleteTarget?.name}"? It will be hidden from active lists.`}
        confirmLabel="Archive"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </PageShell>
  )
}
