import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PageShell } from '@/components/layout/PageShell'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { SupplierCard } from '../components/SupplierCard'
import {
  SupplierDirectoryFilters,
  type SupplierSortKey,
} from '../components/SupplierDirectoryFilters'
import { SupplierDirectoryKPIs } from '../components/SupplierDirectoryKPIs'
import type { SupplierDirectoryViewMode } from '../types/supplier-360.types'
import { formatActivityDate, stockQuantityLabel } from '../utils/supplier-display'
import {
  createSupplier,
  getSupplierDirectorySummary,
  listSupplierDirectoryCards,
  softDeleteSupplier,
  updateSupplier,
  type Supplier,
  type SupplierDirectoryCard,
} from '../repositories/suppliers.repository'

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  status: 'active' | 'inactive'
}

const empty: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  status: 'active',
}

const pageSize = 30

function sortKeyToRpc(sort: SupplierSortKey): string {
  switch (sort) {
    case 'due':
      return 'due'
    case 'activity':
      return 'activity'
    case 'purchased':
      return 'purchases'
    case 'paid':
      return 'paid'
    default:
      return 'name'
  }
}

export function SuppliersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const dueOnly = searchParams.get('due') === '1'

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sortBy, setSortBy] = useState<SupplierSortKey>('name')
  const [viewMode, setViewMode] = useState<SupplierDirectoryViewMode>('cards')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | SupplierDirectoryCard | null>(null)
  const [form, setForm] = useState<FormState>(empty)

  useEffect(() => {
    if (location.pathname === '/suppliers/new') {
      setEditing(null)
      setForm(empty)
      setOpen(true)
    }
  }, [location.pathname])

  const cardFilters = useMemo(
    () => ({
      search,
      status: status || null,
      dueOnly,
      page,
      pageSize,
      sortBy: sortKeyToRpc(sortBy),
      sortDir: sortBy === 'name' ? ('asc' as const) : ('desc' as const),
    }),
    [search, status, dueOnly, page, sortBy],
  )

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: queryKeys.supplierDirectorySummary({}),
    queryFn: () => getSupplierDirectorySummary(),
  })

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.supplierDirectoryCards(cardFilters),
    queryFn: () => listSupplierDirectoryCards(cardFilters),
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      if (!payload.name) throw new Error('Name is required')
      if (editing) return updateSupplier(editing.id, payload)
      return createSupplier(profile.organization_id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      void qc.invalidateQueries({ queryKey: ['supplier-directory-summary'] })
      void qc.invalidateQueries({ queryKey: ['supplier-directory-cards'] })
      toast(editing ? 'Supplier updated' : 'Supplier created')
      setOpen(false)
      setEditing(null)
      setForm(empty)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteSupplier,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      void qc.invalidateQueries({ queryKey: ['supplier-directory-summary'] })
      void qc.invalidateQueries({ queryKey: ['supplier-directory-cards'] })
      toast('Supplier deleted')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(row: Supplier | SupplierDirectoryCard) {
    setEditing(row)
    setForm({
      name: row.name,
      phone: row.phone ?? '',
      email: row.email ?? '',
      address: row.address ?? '',
      notes: row.notes ?? '',
      status: (row.status === 'inactive' ? 'inactive' : 'active') as FormState['status'],
    })
    setOpen(true)
  }

  function setDueOnly(next: boolean) {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('due', '1')
    else params.delete('due')
    setSearchParams(params, { replace: true })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize))
  const items = data?.items ?? []

  return (
    <PageShell
      title="Supplier directory"
      description="Manage suppliers, track dues, stock and performance in one place."
      className="mx-auto max-w-6xl"
      actions={
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="suppliers.import">
            <Button size="sm" variant="outline" asChild>
              <Link to="/suppliers/import">
                <Upload className="mr-1.5 h-4 w-4" />
                Import
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="suppliers.manage">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add supplier
            </Button>
          </PermissionGate>
        </div>
      }
    >
      <SupplierDirectoryKPIs summary={summary} isLoading={summaryLoading} />

      <SupplierDirectoryFilters
        search={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        status={status}
        onStatusChange={(v) => {
          setStatus(v)
          setPage(1)
        }}
        dueOnly={dueOnly}
        onDueOnlyChange={setDueOnly}
        sortBy={sortBy}
        onSortByChange={(v) => {
          setSortBy(v)
          setPage(1)
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load suppliers.</p> : null}

      {viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((row) => (
            <SupplierCard key={row.id} supplier={row} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">In stock</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link
                      to={`/suppliers/${row.id}?tab=ledger`}
                      className="font-medium text-[#2563EB] hover:underline"
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{row.phone || '—'}</div>
                    <div className="text-xs">{row.email || ''}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === 'active' ? 'success' : 'default'}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium text-[#E11D48]">
                    {Number(row.current_due) > 0 ? formatBDT(Number(row.current_due)) : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatBDT(row.total_paid)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {stockQuantityLabel(row.stock_on_hand)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatActivityDate(row.last_activity_at)}
                  </TableCell>
                  <TableCell>
                    <PermissionGate permission="suppliers.manage">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(row)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete ${row.name}?`)) deleteMutation.mutate(row.id)
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-[#E11D48]" />
                        </Button>
                      </div>
                    </PermissionGate>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && items.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No suppliers found.</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v)
          if (!v) {
            setEditing(null)
            setForm(empty)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit supplier' : 'New supplier'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="sup-name">Name</Label>
              <Input
                id="sup-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sup-phone">Phone</Label>
              <Input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sup-email">Email</Label>
              <Input
                id="sup-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sup-address">Address</Label>
              <Input
                id="sup-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="sup-status">Status</Label>
              <select
                id="sup-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as FormState['status'] }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label htmlFor="sup-notes">Notes</Label>
              <Input
                id="sup-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Create'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  )
}