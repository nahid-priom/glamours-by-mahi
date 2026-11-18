import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { formatActivityDate } from '../utils/customer-display'
import {
  updateCustomer,
  type Customer,
  type CustomerInput,
} from '../repositories/customers.repository'

type Props = {
  customer: Customer
  editOpen: boolean
  onEditOpenChange: (open: boolean) => void
}

type EditForm = {
  name: string
  phone: string
  email: string
  address: string
  district: string
  barcode: string
  preferred_channel: string
  notes: string
  status: 'active' | 'blocked' | 'archived'
}

function toForm(c: Customer): EditForm {
  return {
    name: c.name,
    phone: c.phone,
    email: c.email ?? '',
    address: c.address ?? '',
    district: c.district ?? '',
    barcode: c.barcode ?? '',
    preferred_channel: c.preferred_channel ?? '',
    notes: c.notes ?? '',
    status: c.status as EditForm['status'],
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  )
}

export function CustomerDetailsTab({ customer, editOpen, onEditOpenChange }: Props) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [form, setForm] = useState<EditForm>(() => toForm(customer))

  useEffect(() => {
    if (editOpen) setForm(toForm(customer))
  }, [editOpen, customer])

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Partial<CustomerInput> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        barcode: form.barcode.trim() || null,
        preferred_channel: form.preferred_channel.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
      }
      if (!payload.name) throw new Error('Name is required')
      if (!payload.phone) throw new Error('Phone is required')
      return updateCustomer(customer.id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer', customer.id] })
      void qc.invalidateQueries({ queryKey: ['customers-admin'] })
      toast('Customer updated')
      onEditOpenChange(false)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const advance = Number(
    (customer as Customer & { current_advance?: number }).current_advance ?? 0,
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Customer profile</h2>
        <PermissionGate permission="customers.manage">
          <Button size="sm" variant="outline" onClick={() => onEditOpenChange(true)}>
            Edit details
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Business information
          </h3>
          <Field label="Name" value={customer.name} />
          <Field label="Status" value={customer.status} />
          <Field label="Barcode" value={customer.barcode ?? ''} />
          <Field label="Preferred channel" value={customer.preferred_channel ?? ''} />
          <Field label="Created" value={formatActivityDate(customer.created_at)} />
          <Field label="Updated" value={formatActivityDate(customer.updated_at)} />
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Contact &amp; address
          </h3>
          <Field label="Phone" value={customer.phone} />
          <Field label="Email" value={customer.email ?? ''} />
          <Field label="District" value={customer.district ?? ''} />
          <Field label="Address" value={customer.address ?? ''} />
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Balances
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current due</span>
            <span className="text-sm font-semibold text-[#E11D48]">
              {formatBDT(Number(customer.current_due))}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Advance</span>
            <span className="text-sm font-semibold">{formatBDT(advance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total spent</span>
            <span className="text-sm font-semibold">{formatBDT(Number(customer.total_spent))}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total paid</span>
            <span className="text-sm font-semibold">{formatBDT(Number(customer.total_paid))}</span>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Notes
          </h3>
          <p className="text-sm text-foreground whitespace-pre-wrap">{customer.notes || '—'}</p>
          <Badge variant={customer.status === 'active' ? 'success' : 'default'}>
            {customer.status}
          </Badge>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['name', 'Name'],
                ['phone', 'Phone'],
                ['email', 'Email'],
                ['district', 'District'],
                ['address', 'Address'],
                ['barcode', 'Barcode'],
                ['preferred_channel', 'Preferred channel'],
                ['notes', 'Notes'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === 'address' || key === 'notes' ? 'sm:col-span-2' : ''}>
                <Label htmlFor={`cust-${key}`}>{label}</Label>
                <Input
                  id={`cust-${key}`}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div>
              <Label htmlFor="cust-status">Status</Label>
              <select
                id="cust-status"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    status: e.target.value as EditForm['status'],
                  }))
                }
              >
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => onEditOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
