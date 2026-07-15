import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  createSupplier,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
  type Supplier,
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

export function SuppliersPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState<FormState>(empty)

  const filters = { search, page, pageSize: 30 }
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.suppliers(filters),
    queryFn: () => listSuppliers(filters),
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
      toast(editing ? 'Supplier updated' : 'Supplier created')
      setOpen(false)
      setEditing(null)
      setForm(empty)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteSupplier,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast('Supplier deleted')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(row: Supplier) {
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

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Suppliers</h1>
          <p className="text-sm text-[#6B7280]">Manage purchase partners and payables.</p>
        </div>
        <PermissionGate permission="suppliers.manage">
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add supplier
          </Button>
        </PermissionGate>
      </div>

      <Input
        placeholder="Search name, phone, email…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value)
          setPage(1)
        }}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load suppliers.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    to={`/suppliers/${row.id}`}
                    className="font-medium text-[#E11D48] hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-[#6B7280]">
                  <div>{row.phone || '—'}</div>
                  <div className="text-xs text-[#9CA3AF]">{row.email || ''}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={row.status === 'active' ? 'success' : 'default'}>
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium text-[#E11D48]">
                  {Number(row.current_due) > 0 ? formatBDT(Number(row.current_due)) : '—'}
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
        {!isLoading && (data?.items.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No suppliers found.</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
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
                  setForm((f) => ({ ...f, status: e.target.value as 'active' | 'inactive' }))
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
    </div>
  )
}
