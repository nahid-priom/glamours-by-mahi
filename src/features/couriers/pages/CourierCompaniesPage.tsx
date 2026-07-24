import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { courierRepository, type CourierCompanyListItem } from '../repositories/courier.repository'
import {
  CourierCompanyFormDialog,
  type CourierCompanyFormValues,
} from '../components/CourierCompanyFormDialog'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { queryKeys } from '@/lib/query/keys'
import { cn } from '@/lib/utils'

const statusVariant: Record<string, 'success' | 'default' | 'danger'> = {
  active: 'success',
  inactive: 'default',
  archived: 'danger',
}

const connectionVariant: Record<string, 'success' | 'default' | 'warning' | 'danger'> = {
  connected: 'success',
  disconnected: 'default',
  testing: 'warning',
  failed: 'danger',
}

export function CourierCompaniesPage() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CourierCompanyListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CourierCompanyListItem | null>(null)

  const filters = {
    search,
    status: statusFilter === 'all' ? null : statusFilter,
  }

  const { data = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.couriers, filters],
    queryFn: () => courierRepository.listCompanies(filters),
  })

  const saveMutation = useMutation({
    mutationFn: async (values: CourierCompanyFormValues) => {
      if (!profile?.organization_id) throw new Error('No organization')
      return courierRepository.upsertCompany({
        id: editing?.id,
        organization_id: profile.organization_id,
        name: values.name,
        code: values.code,
        contact_phone: values.contact_phone || null,
        api_base_url: values.api_base_url || null,
        status: values.status,
      })
    },
    onSuccess: () => {
      toast(editing ? 'Courier updated' : 'Courier added')
      setEditing(null)
      void qc.invalidateQueries({ queryKey: queryKeys.couriers })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => courierRepository.deleteCompany(id),
    onSuccess: () => {
      toast('Courier removed')
      setDeleteTarget(null)
      void qc.invalidateQueries({ queryKey: queryKeys.couriers })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(company: CourierCompanyListItem) {
    setEditing(company)
    setFormOpen(true)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Courier Companies</h1>
          <p className="text-sm text-[#6B7280]">
            Manage courier partners — add, edit, or remove any courier.
          </p>
        </div>
        <PermissionGate permission="courier.manage">
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add courier
          </Button>
        </PermissionGate>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, code, phone…"
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading couriers…
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Could not load companies.'}
        </p>
      ) : null}

      {!isLoading && data.length === 0 ? (
        <EmptyState
          title="No couriers yet"
          description="Add your first courier partner to start booking parcels."
          actionLabel="Add courier"
          onAction={openCreate}
        />
      ) : null}

      {data.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Connection</TableHead>
                <TableHead>Success</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{c.name}</p>
                      {c.api_base_url ? (
                        <p className="max-w-[200px] truncate text-xs text-[#6B7280]">{c.api_base_url}</p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs uppercase">{c.code || '—'}</TableCell>
                  <TableCell>{c.contact_phone || '—'}</TableCell>
                  <TableCell>
                    <Badge
                      variant={connectionVariant[c.connection_status] ?? 'default'}
                      className="capitalize"
                    >
                      {c.connection_status}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.success_rate != null ? `${c.success_rate}%` : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? 'default'} className="capitalize">
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <PermissionGate permission="courier.manage">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-4 w-4 text-[#E11D48]" />
                        </Button>
                      </PermissionGate>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <div className="space-y-2 md:hidden">
        {data.map((c) => (
          <div
            key={c.id}
            className={cn(
              'rounded-xl border border-border bg-white p-4',
              c.status === 'inactive' && 'opacity-70',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-[#6B7280]">
                  {c.code || '—'} · {c.contact_phone || 'no phone'}
                </p>
              </div>
              <Badge variant={statusVariant[c.status] ?? 'default'} className="capitalize">
                {c.status}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-[#6B7280] capitalize">
              Connection: {c.connection_status}
            </p>
            <PermissionGate permission="courier.manage">
              <div className="mt-3 flex gap-2">
                <Button className="flex-1" variant="outline" onClick={() => openEdit(c)}>
                  Edit
                </Button>
                <Button className="flex-1" variant="ghost" onClick={() => setDeleteTarget(c)}>
                  Delete
                </Button>
              </div>
            </PermissionGate>
          </div>
        ))}
      </div>

      <CourierCompanyFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        company={editing}
        onSubmit={async (values) => {
          await saveMutation.mutateAsync(values)
        }}
        loading={saveMutation.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Remove courier"
        description={`Remove "${deleteTarget?.name}"? Existing parcels linked to this courier are kept.`}
        confirmLabel="Remove"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  )
}
