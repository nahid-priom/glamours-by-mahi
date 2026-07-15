import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Loader2, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  getSale,
  getSaleTimeline,
  requestCorrection,
  voidSale,
} from '../repositories/sales.repository'

export function SaleDetailPage() {
  const { id = '' } = useParams()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [voidOpen, setVoidOpen] = useState(false)
  const [correctOpen, setCorrectOpen] = useState(false)
  const [reason, setReason] = useState('')

  const { data: sale, isLoading, error } = useQuery({
    queryKey: queryKeys.sale(id),
    queryFn: () => getSale(id),
    enabled: Boolean(id),
  })

  const { data: timeline = [] } = useQuery({
    queryKey: [...queryKeys.sale(id), 'timeline'],
    queryFn: () => getSaleTimeline(id),
    enabled: Boolean(id),
  })

  const voidMutation = useMutation({
    mutationFn: () => voidSale(id, reason.trim()),
    onSuccess: () => {
      toast('Sale voided')
      void qc.invalidateQueries({ queryKey: queryKeys.sale(id) })
      setVoidOpen(false)
      setReason('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const correctMutation = useMutation({
    mutationFn: () =>
      requestCorrection({ sale_id: id, reason: reason.trim() }),
    onSuccess: () => {
      toast('Correction requested')
      void qc.invalidateQueries({ queryKey: queryKeys.sale(id) })
      setCorrectOpen(false)
      setReason('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading sale…
      </div>
    )
  }

  if (error || !sale) {
    return <p className="text-sm text-[#E11D48]">Sale not found or failed to load.</p>
  }

  const items = (sale.sale_items ?? []).filter((i) => !i.deleted_at)
  const payments = (sale.sale_payments ?? []).filter((p) => !p.deleted_at)

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-[#9CA3AF]">
            <Link to="/sales" className="hover:text-[#E11D48]">
              Sales
            </Link>
            {' / '}
            {sale.invoice_no}
          </p>
          <h1 className="text-xl font-bold text-[#111827]">{sale.invoice_no}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="info">{sale.status}</Badge>
            <Badge>{sale.payment_status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link to={`/print/sales/${sale.id}/a4`} target="_blank">
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Link>
          </Button>
          <PermissionGate permission="sales.return.review">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/sales/${sale.id}/return`}>Return</Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="sales.correct">
            <Button size="sm" variant="outline" onClick={() => setCorrectOpen(true)}>
              Correct
            </Button>
          </PermissionGate>
          <PermissionGate permission="sales.void">
            <Button
              size="sm"
              variant="ghost"
              className="text-[#E11D48]"
              disabled={sale.status === 'voided'}
              onClick={() => setVoidOpen(true)}
            >
              Void
            </Button>
          </PermissionGate>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-[#9CA3AF]">Customer</p>
          <p className="font-medium">{sale.customers?.name ?? 'Walk-in'}</p>
          <p className="text-[#6B7280]">{sale.customers?.phone}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-[#9CA3AF]">Branch</p>
          <p className="font-medium">{sale.branches?.name ?? '—'}</p>
          <p className="text-[#6B7280]">{new Date(sale.created_at).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-[#9CA3AF]">Totals</p>
          <p className="font-medium">{formatBDT(Number(sale.grand_total))}</p>
          <p className="text-[#E11D48]">Due {formatBDT(Number(sale.due_total))}</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Items</div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <p className="font-medium">
                    {item.product_variants?.products?.name ?? 'Item'}
                  </p>
                  <p className="text-xs text-[#9CA3AF]">
                    {item.product_variants?.sku}
                    {item.product_variants?.name ? ` · ${item.product_variants.name}` : ''}
                  </p>
                </TableCell>
                <TableCell className="text-right">{item.qty}</TableCell>
                <TableCell className="text-right">{formatBDT(Number(item.unit_price))}</TableCell>
                <TableCell className="text-right">{formatBDT(Number(item.line_total))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Payments</div>
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-[#6B7280]">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  {p.method}
                  {p.reference ? ` · ${p.reference}` : ''}
                </span>
                <span className="font-medium">{formatBDT(Number(p.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Timeline</div>
        {timeline.length === 0 ? (
          <p className="p-4 text-sm text-[#6B7280]">No activity or audit entries yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {timeline.map((e) => (
              <li key={`${e.source}-${e.id}`} className="px-4 py-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-medium">{e.message}</span>
                  <span className="text-xs text-[#9CA3AF]">
                    {e.source} · {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Void sale</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <Button
              className="w-full"
              disabled={!reason.trim() || voidMutation.isPending}
              onClick={() => voidMutation.mutate()}
            >
              Confirm void
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={correctOpen} onOpenChange={setCorrectOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Request correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            <Button
              className="w-full"
              disabled={!reason.trim() || correctMutation.isPending}
              onClick={() => correctMutation.mutate()}
            >
              Submit request
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
