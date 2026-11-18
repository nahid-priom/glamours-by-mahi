import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileUp, Loader2, Trash2 } from 'lucide-react'
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
import { partyLedgerEntryLabel } from '@/lib/party-ledger'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import type { SupplierExtendedFields } from '../types/supplier-360.types'
import { formatActivityDate } from '../utils/supplier-display'
import {
  deleteSupplierDocument,
  getSupplierLedgerStatement,
  listSupplierDocuments,
  listSupplierLedger,
  listSupplierPurchases,
  updateSupplier,
  uploadSupplierDocument,
  type Supplier,
} from '../repositories/suppliers.repository'

type Props = {
  supplier: Supplier
  editOpen: boolean
  onEditOpenChange: (open: boolean) => void
}

type EditForm = {
  name: string
  phone: string
  email: string
  address: string
  notes: string
  status: 'active' | 'inactive'
  code: string
  business_type: string
  contact_person: string
  vat_reg_no: string
  payment_terms_days: string
  credit_limit: string
  established_year: string
}

function readExtended(supplier: Supplier): SupplierExtendedFields {
  const row = supplier as Supplier & SupplierExtendedFields
  return {
    code: row.code ?? null,
    business_type: row.business_type ?? null,
    contact_person: row.contact_person ?? null,
    vat_reg_no: row.vat_reg_no ?? null,
    payment_terms_days: row.payment_terms_days ?? null,
    credit_limit: row.credit_limit ?? null,
    established_year: row.established_year ?? null,
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm text-foreground">{value}</p>
    </div>
  )
}

function toEditForm(supplier: Supplier): EditForm {
  const ext = readExtended(supplier)
  return {
    name: supplier.name,
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    notes: supplier.notes ?? '',
    status: supplier.status === 'inactive' ? 'inactive' : 'active',
    code: ext.code ?? '',
    business_type: ext.business_type ?? '',
    contact_person: ext.contact_person ?? '',
    vat_reg_no: ext.vat_reg_no ?? '',
    payment_terms_days: ext.payment_terms_days != null ? String(ext.payment_terms_days) : '',
    credit_limit: ext.credit_limit != null ? String(ext.credit_limit) : '',
    established_year: ext.established_year != null ? String(ext.established_year) : '',
  }
}

export function SupplierDetailsTab({ supplier, editOpen, onEditOpenChange }: Props) {
  const ext = readExtended(supplier)
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<EditForm>(() => toEditForm(supplier))

  useEffect(() => {
    if (editOpen) setForm(toEditForm(supplier))
  }, [editOpen, supplier])

  const { data: documents = [], isLoading: docsLoading } = useQuery({
    queryKey: queryKeys.supplierDocuments(supplier.id),
    queryFn: () => listSupplierDocuments(supplier.id),
  })

  const { data: purchases = [] } = useQuery({
    queryKey: queryKeys.supplierPurchases(supplier.id),
    queryFn: () => listSupplierPurchases(supplier.id),
  })

  const { data: recentLedger = [] } = useQuery({
    queryKey: queryKeys.suppliersLedger(supplier.id),
    queryFn: () => listSupplierLedger(supplier.id, 8),
  })

  const { data: statementPreview } = useQuery({
    queryKey: queryKeys.supplierLedgerStatement({ supplierId: supplier.id, page: 1, pageSize: 1 }),
    queryFn: () =>
      getSupplierLedgerStatement({ supplierId: supplier.id, page: 1, pageSize: 1 }),
  })

  const activityItems = useMemo(() => {
    const items: { id: string; at: string; label: string; href?: string }[] = []
    for (const row of recentLedger) {
      items.push({
        id: `ledger-${row.id}`,
        at: row.occurred_at,
        label: `${partyLedgerEntryLabel(row.entry_type)} · ledger`,
      })
    }
    for (const p of purchases) {
      items.push({
        id: `purchase-${p.id}`,
        at: p.completed_at ?? p.created_at,
        label: `Purchase ${p.invoice_no} · ${formatBDT(p.grand_total)}`,
        href: `/purchases/${p.id}`,
      })
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 12)
  }, [recentLedger, purchases])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        notes: form.notes.trim() || null,
        status: form.status,
        code: form.code.trim() || null,
        business_type: form.business_type.trim() || null,
        contact_person: form.contact_person.trim() || null,
        vat_reg_no: form.vat_reg_no.trim() || null,
        payment_terms_days: form.payment_terms_days ? Number(form.payment_terms_days) : null,
        credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
        established_year: form.established_year ? Number(form.established_year) : null,
      }
      if (!payload.name) throw new Error('Name is required')
      return updateSupplier(supplier.id, payload)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.supplier(supplier.id) })
      void qc.invalidateQueries({ queryKey: ['suppliers'] })
      toast('Supplier profile updated')
      onEditOpenChange(false)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.organization_id) throw new Error('No organization')
      return uploadSupplierDocument(supplier.id, profile.organization_id, file)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.supplierDocuments(supplier.id) })
      toast('Document uploaded')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const deleteDocMutation = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => deleteSupplierDocument(id, path),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.supplierDocuments(supplier.id) })
      toast('Document removed')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Business information</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Legal / trade name" value={supplier.name} />
          <Field label="Supplier code" value={ext.code ?? '—'} />
          <Field label="Business type" value={ext.business_type ?? '—'} />
          <Field label="Status" value={supplier.status} />
          <Field label="VAT / BIN" value={ext.vat_reg_no ?? '—'} />
          <Field label="Established" value={ext.established_year != null ? String(ext.established_year) : '—'} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Contact</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person" value={ext.contact_person ?? '—'} />
          <Field label="Phone" value={supplier.phone ?? '—'} />
          <Field label="Email" value={supplier.email ?? '—'} />
          <Field label="Address" value={supplier.address ?? '—'} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Payment terms</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="Payment terms (days)"
            value={ext.payment_terms_days != null ? String(ext.payment_terms_days) : '—'}
          />
          <Field
            label="Credit limit"
            value={ext.credit_limit != null ? formatBDT(Number(ext.credit_limit)) : '—'}
          />
          <Field label="Current due" value={formatBDT(Number(supplier.current_due))} />
        </div>
        {statementPreview ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Ledger lifetime purchases {formatBDT(statementPreview.total_purchases)} · payments{' '}
            {formatBDT(statementPreview.total_payments)} (from statement RPC).
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Documents</h2>
          <PermissionGate permission="suppliers.manage">
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              <FileUp className="mr-1.5 h-4 w-4" />
              Upload
            </Button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadMutation.mutate(file)
                e.target.value = ''
              }}
            />
          </PermissionGate>
        </div>
        {docsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading documents…
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>{doc.file_name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatActivityDate(doc.created_at)}
                  </span>
                  <PermissionGate permission="suppliers.manage">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm('Remove this document?')) {
                          deleteDocMutation.mutate({ id: doc.id, path: doc.file_path })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-[#E11D48]" />
                    </Button>
                  </PermissionGate>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Recent purchases</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="whitespace-nowrap text-sm">
                  {p.completed_at
                    ? new Date(p.completed_at).toLocaleDateString()
                    : new Date(p.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Link to={`/purchases/${p.id}`} className="text-[#2563EB] hover:underline">
                    {p.invoice_no}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="default">{p.status ?? '—'}</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatBDT(p.grand_total)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatBDT(p.due_total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {purchases.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No purchases recorded.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-border bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold text-foreground">Activity</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Derived from recent ledger entries and purchases (not a full audit log).
        </p>
        <ul className="space-y-2">
          {activityItems.map((item) => (
            <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              {item.href ? (
                <Link to={item.href} className="font-medium text-[#2563EB] hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
              <span className="text-xs text-muted-foreground">{formatActivityDate(item.at)}</span>
            </li>
          ))}
        </ul>
        {activityItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity.</p>
        ) : null}
      </section>

      <Dialog open={editOpen} onOpenChange={onEditOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit supplier profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ed-name">Name</Label>
              <Input id="ed-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-code">Code</Label>
                <Input id="ed-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ed-btype">Business type</Label>
                <Input
                  id="ed-btype"
                  value={form.business_type}
                  onChange={(e) => setForm((f) => ({ ...f, business_type: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-contact">Contact person</Label>
              <Input
                id="ed-contact"
                value={form.contact_person}
                onChange={(e) => setForm((f) => ({ ...f, contact_person: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-phone">Phone</Label>
                <Input id="ed-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ed-email">Email</Label>
                <Input id="ed-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-address">Address</Label>
              <Input id="ed-address" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-vat">VAT / BIN</Label>
                <Input id="ed-vat" value={form.vat_reg_no} onChange={(e) => setForm((f) => ({ ...f, vat_reg_no: e.target.value }))} />
              </div>
              <div>
                <Label htmlFor="ed-year">Established year</Label>
                <Input
                  id="ed-year"
                  inputMode="numeric"
                  value={form.established_year}
                  onChange={(e) => setForm((f) => ({ ...f, established_year: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-terms">Payment terms (days)</Label>
                <Input
                  id="ed-terms"
                  inputMode="numeric"
                  value={form.payment_terms_days}
                  onChange={(e) => setForm((f) => ({ ...f, payment_terms_days: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="ed-credit">Credit limit</Label>
                <Input
                  id="ed-credit"
                  inputMode="decimal"
                  value={form.credit_limit}
                  onChange={(e) => setForm((f) => ({ ...f, credit_limit: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="ed-status">Status</Label>
              <select
                id="ed-status"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as EditForm['status'] }))
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label htmlFor="ed-notes">Notes</Label>
              <Input id="ed-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={saveMutation.isPending || !form.name.trim()}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}