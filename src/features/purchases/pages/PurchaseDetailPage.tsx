import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { Download, Loader2, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { enterpriseReadable } from '@/components/enterprise-readable'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { TransactionLineItemsSection } from '@/components/transaction-line-items'
import { openPurchasePrint } from '@/features/print/print.service'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { purchasesRepository } from '../repositories/purchases.repository'

type PurchaseItemRow = {
  id: string
  qty: number
  unit_cost: number
  line_discount: number
  line_total: number
  deleted_at: string | null
  product_variants: {
    sku: string
    name: string | null
    products: { name: string } | null
  } | null
}

type PurchasePaymentRow = {
  id: string
  method: string
  amount: number
  reference: string | null
  deleted_at: string | null
}

export function PurchaseDetailPage() {
  const { id = '' } = useParams()

  const { data: purchase, isLoading, error } = useQuery({
    queryKey: queryKeys.purchase(id),
    queryFn: () => purchasesRepository.getPurchase(id),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading purchase…
      </div>
    )
  }

  if (error || !purchase) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-3">
        <p className="text-sm text-danger">Purchase not found or failed to load.</p>
        <Button asChild size="sm" variant="outline">
          <Link to="/purchases">Back to purchases</Link>
        </Button>
      </div>
    )
  }

  const supplier = purchase.suppliers as { name: string; phone: string | null } | null
  const items = ((purchase.purchase_items ?? []) as PurchaseItemRow[]).filter((item) => !item.deleted_at)
  const payments = ((purchase.purchase_payments ?? []) as PurchasePaymentRow[]).filter(
    (payment) => !payment.deleted_at,
  )

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-text-muted">
            <Link to="/purchases" className="hover:text-primary">
              Purchases
            </Link>
            {' / '}
            {purchase.invoice_no}
          </p>
          <h1 className="text-xl font-bold text-text-primary">{purchase.invoice_no}</h1>
          <div className="mt-1 flex flex-wrap gap-2">
            <Badge variant="info">{purchase.status}</Badge>
            <Badge>{purchase.payment_status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="purchases.read">
            <Button size="sm" variant="outline" onClick={() => openPurchasePrint(purchase.id)}>
              <Printer className="mr-1.5 h-3.5 w-3.5" />
              Print
            </Button>
            <Button size="sm" variant="outline" onClick={() => openPurchasePrint(purchase.id)}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Download
            </Button>
          </PermissionGate>
          {Number(purchase.due_total) > 0 ? (
            <Button asChild size="sm">
              <Link to="/purchases/payments">Record payment</Link>
            </Button>
          ) : null}
          <Button asChild size="sm" variant="outline">
            <Link to="/purchases/new">New purchase</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-text-muted">Supplier</p>
          <p className="font-medium">{supplier?.name ?? '—'}</p>
          {supplier?.phone ? <p className="text-text-muted">{supplier.phone}</p> : null}
        </div>
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-text-muted">Completed</p>
          <p className="font-medium">
            {purchase.completed_at
              ? new Date(purchase.completed_at).toLocaleString()
              : new Date(purchase.created_at).toLocaleString()}
          </p>
          <p className="text-text-muted">Created {new Date(purchase.created_at).toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-text-muted">Totals</p>
          <p className={enterpriseReadable.grandTotal}>
            {formatBDT(Number(purchase.grand_total))}
          </p>
          <p className="text-success">Paid {formatBDT(Number(purchase.paid_total))}</p>
          {Number(purchase.due_total) > 0 ? (
            <p className="text-danger">Due {formatBDT(Number(purchase.due_total))}</p>
          ) : null}
        </div>
      </div>

      {purchase.note ? (
        <div className="rounded-xl border border-border bg-white p-3 text-sm">
          <p className="text-text-muted">Note</p>
          <p className="mt-0.5 text-text-primary">{purchase.note}</p>
        </div>
      ) : null}

      <TransactionLineItemsSection
        items={items.map((item) => {
          const variant = item.product_variants
          const parts = [variant?.sku, variant?.name].filter(Boolean)
          return {
            id: item.id,
            productName: variant?.products?.name ?? 'Item',
            metadata: parts.length ? parts.join(' · ') : undefined,
            qty: Number(item.qty),
            unitPrice: Number(item.unit_cost),
            lineDiscount: Number(item.line_discount),
            lineTotal: Number(item.line_total),
          }
        })}
        grandTotal={Number(purchase.grand_total)}
        showImage={false}
        showDiscount
        labels={{
          unitPrice: 'Unit cost',
          empty: 'No line items recorded.',
        }}
        headingId="purchase-items-heading"
      />

      <div className="rounded-xl border border-border bg-white">
        <div className="border-b border-border px-4 py-2 text-sm font-semibold">Payments</div>
        {payments.length === 0 ? (
          <p className="p-4 text-sm text-text-muted">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-border">
            {payments.map((payment) => (
              <li key={payment.id} className="flex justify-between px-4 py-2 text-sm">
                <span>
                  {payment.method}
                  {payment.reference ? ` · ${payment.reference}` : ''}
                </span>
                <span className="font-medium">{formatBDT(Number(payment.amount))}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
