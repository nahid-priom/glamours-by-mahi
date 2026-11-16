import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2, Pencil, Plus, Trash2, Upload } from 'lucide-react'
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
import { CustomerRatingStars } from '@/features/customer-rating'
import {
  createCustomer,
  listCustomers,
  softDeleteCustomer,
  updateCustomer,
  type Customer,
} from '../repositories/customers.repository'
import { supabase } from '@/lib/supabase/client'
import { toastRpcError } from '@/lib/errors/rpc-error'

type FormState = {
  name: string
  phone: string
  email: string
  address: string
  district: string
  notes: string
  status: 'active' | 'blocked' | 'archived'
}

const empty: FormState = {
  name: '',
  phone: '',
  email: '',
  address: '',
  district: '',
  notes: '',
  status: 'active',
}

export function CustomersAdminPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const dueOnly = searchParams.get('due') === '1'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [form, setForm] = useState<FormState>(empty)

  const filters = useMemo(
    () => ({ search, page, pageSize: 30, dueOnly }),
    [search, page, dueOnly],
  )
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.customersAdmin(filters),
    queryFn: () => listCustomers(filters),
  })

  const customerIds = (data?.items ?? []).map((r) => r.id)
  const { data: ratingMap = {} } = useQuery({
    queryKey: ['customer-ratings-batch', customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) {
        return {} as Record<string, { score: number | null; status: 'unrated' | 'provisional' | 'rated' }>
      }
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => {
            in: (col: string, vals: string[]) => {
              is: (
                col: string,
                val: null,
              ) => PromiseLike<{
                data: Array<{
                  customer_id: string
                  score: number | null
                  rating_status: string | null
                }> | null
                error: { message: string } | null
              }>
            }
          }
        }
      }
      const { data: rows, error: ratingError } = await client
        .from('customer_rating_summaries')
        .select('customer_id, score, rating_status')
        .in('customer_id', customerIds)
        .is('deleted_at', null)
      if (ratingError) {
        return {} as Record<string, { score: number | null; status: 'unrated' | 'provisional' | 'rated' }>
      }
      const map: Record<string, { score: number | null; status: 'unrated' | 'provisional' | 'rated' }> =
        {}
      for (const row of rows ?? []) {
        const status =
          row.rating_status === 'provisional' || row.rating_status === 'rated'
            ? row.rating_status
            : 'unrated'
        map[row.customer_id] = {
          score: row.score == null ? null : Number(row.score),
          status,
        }
      }
      return map
    },
    enabled: customerIds.length > 0,
    staleTime: 60_000,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      if (!payload.name) throw new Error('Name is required')
      if (!payload.phone) throw new Error('Phone is required')
      if (editing) return updateCustomer(editing.id, payload)
      return createCustomer(profile.organization_id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers-admin'] })
      toast(editing ? 'Customer updated' : 'Customer created')
      setOpen(false)
      setEditing(null)
      setForm(empty)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteMutation = useMutation({
    mutationFn: softDeleteCustomer,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customers-admin'] })
      toast('Customer deleted')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  function openCreate() {
    setEditing(null)
    setForm(empty)
    setOpen(true)
  }

  function openEdit(row: Customer) {
    setEditing(row)
    setForm({
      name: row.name,
      phone: row.phone,
      email: row.email ?? '',
      address: row.address ?? '',
      district: row.district ?? '',
      notes: row.notes ?? '',
      status: (['active', 'blocked', 'archived'].includes(row.status)
        ? row.status
        : 'active') as FormState['status'],
    })
    setOpen(true)
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30))

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Customers</h1>
          <p className="text-sm text-[#6B7280]">Supabase-backed customer directory and dues.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="customers.import">
            <Button size="sm" variant="outline" asChild>
              <Link to="/customers/import">
                <Upload className="mr-1.5 h-4 w-4" />
                Import
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="customers.manage">
            <Button size="sm" onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add customer
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-sm"
        />
        <Button
          type="button"
          size="sm"
          variant={dueOnly ? 'default' : 'outline'}
          onClick={() => {
            const next = new URLSearchParams(searchParams)
            if (dueOnly) next.delete('due')
            else next.set('due', '1')
            setSearchParams(next, { replace: true })
            setPage(1)
          }}
        >
          Due only
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading customers…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Failed to load customers.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>District</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.items ?? []).map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    to={`/customers/${row.id}`}
                    className="font-medium text-[#E11D48] hover:underline"
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="text-[#6B7280]">{row.phone}</TableCell>
                <TableCell className="text-[#6B7280]">{row.district || '—'}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === 'active'
                        ? 'success'
                        : row.status === 'blocked'
                          ? 'danger'
                          : 'default'
                    }
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ratingMap[row.id] ? (
                    <CustomerRatingStars
                      score={ratingMap[row.id].score}
                      status={ratingMap[row.id].status}
                    />
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">Unrated</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-[#E11D48]">
                  {Number(row.current_due) > 0 ? formatBDT(Number(row.current_due)) : '—'}
                </TableCell>
                <TableCell className="text-right">{formatBDT(Number(row.total_spent))}</TableCell>
                <TableCell>
                  <PermissionGate permission="customers.manage">
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
          <p className="p-6 text-center text-sm text-[#6B7280]">No customers found.</p>
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
            <DialogTitle>{editing ? 'Edit customer' : 'New customer'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cust-name">Name</Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cust-phone">Phone</Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cust-email">Email</Label>
              <Input
                id="cust-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cust-district">District</Label>
              <Input
                id="cust-district"
                value={form.district}
                onChange={(e) => setForm((f) => ({ ...f, district: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cust-address">Address</Label>
              <Input
                id="cust-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="cust-status">Status</Label>
              <select
                id="cust-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as 'active' | 'blocked' | 'archived',
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <Label htmlFor="cust-notes">Notes</Label>
              <Input
                id="cust-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button
              className="w-full"
              disabled={saveMutation.isPending || !form.name.trim() || !form.phone.trim()}
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
