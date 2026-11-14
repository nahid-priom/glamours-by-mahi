import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Copy,
  FileText,
  Gift,
  Pencil,
  Printer,
  Share2,
  Tag,
  Trash2,
  Undo2,
  Wallet,
} from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { TransactionLineItemsSection } from '@/components/transaction-line-items'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth.context'
import { salesService } from '@/services/sales.service'
import { formatBDT, formatDateShort, formatDateTime } from '@/lib/format'
import { SaleStatusBadge } from './components/SaleStatusBadge'
import { useState } from 'react'

function openPrint(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

export function SaleDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sales', 'detail', id],
    queryFn: () => salesService.getDetail(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: async () => salesService.softDelete(id!, session.name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast('Sale deleted')
      navigate('/sales')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const duplicateMutation = useMutation({
    mutationFn: async () => salesService.duplicate(id!, session.name),
    onSuccess: (sale) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast(`Duplicated as ${sale.saleNo}`)
      navigate(`/sales/${sale.id}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) return <LoadingSkeleton rows={8} />
  if (!data) return <EmptyState title="Sale not found" description="This invoice may have been removed." />

  const { sale, customer, branch, salesperson, account, returns, collections, commissions, activities, insights } = data
  const deleted = !!sale.deleted_at

  return (
    <PageShell
      title={sale.saleNo}
      description={`${formatDateShort(sale.created_at)} · ${sale.channel}`}
      actions={
        <div className="flex flex-wrap gap-2">
          <SaleStatusBadge status={sale.status} />
          {!deleted && (
            <>
              <Link to={`/sales/${sale.id}/edit`}>
                <Button variant="outline" size="sm" className="rounded-full gap-1">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
              </Link>
              {sale.dueAmount > 0 && (
                <Link to={`/sales/${sale.id}/collections`}>
                  <Button size="sm" className="rounded-full gap-1">
                    <Wallet className="h-3.5 w-3.5" /> Receive Payment
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => openPrint(`/print/sales/${sale.id}/a4`)}>
              <Printer className="h-3.5 w-3.5" /> A4 Invoice
            </Button>
            <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => openPrint(`/print/sales/${sale.id}/pos`)}>
              <Tag className="h-3.5 w-3.5" /> POS Receipt
            </Button>
            <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => openPrint(`/print/sales/${sale.id}/gift-label`)}>
              <Gift className="h-3.5 w-3.5" /> Gift Label
            </Button>
            <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => openPrint(`/print/sales/${sale.id}/a4`)}>
              <FileText className="h-3.5 w-3.5" /> Invoice
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full gap-1"
              onClick={() => {
                const text = encodeURIComponent(`Invoice ${sale.saleNo} · ${formatBDT(sale.total)}`)
                window.open(`https://wa.me/?text=${text}`, '_blank')
              }}
            >
              <Share2 className="h-3.5 w-3.5" /> Share
            </Button>
            <Button variant="outline" size="sm" className="rounded-full gap-1" onClick={() => duplicateMutation.mutate()}>
              <Copy className="h-3.5 w-3.5" /> Duplicate
            </Button>
            {!deleted && sale.status !== 'Returned' && (
              <Link to={`/sales/${sale.id}/return`}>
                <Button variant="outline" size="sm" className="rounded-full gap-1">
                  <Undo2 className="h-3.5 w-3.5" /> Return
                </Button>
              </Link>
            )}
            {!deleted && (
              <Button variant="danger" size="sm" className="rounded-full gap-1" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>

          <Tabs defaultValue="overview">
            <TabsList className="h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="items">Items</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="collections">Collections</TabsTrigger>
              <TabsTrigger value="courier">Courier</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="print">Print</TabsTrigger>
              <TabsTrigger value="attachments">Attachments</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <Section title="Invoice Information">
                <Grid
                  rows={[
                    ['Invoice', sale.saleNo],
                    ['Date', formatDateShort(sale.created_at)],
                    ['Channel', sale.channel],
                    ['Branch', branch?.name ?? '—'],
                    ['Salesperson', salesperson?.name ?? '—'],
                    ['Delivery', sale.deliveryMethod],
                    ['Status', sale.status],
                    ['Note', sale.note || '—'],
                  ]}
                />
              </Section>
              <Section title="Customer Information">
                <Grid
                  rows={[
                    ['Name', customer?.name ?? '—'],
                    ['Phone', customer?.phone ?? '—'],
                    ['Email', customer?.email || '—'],
                    ['Current Due', formatBDT(customer?.currentDue ?? 0)],
                    ['Lifetime Spend', formatBDT(customer?.totalSpent ?? 0)],
                  ]}
                />
              </Section>
              <Section title="Payment Information">
                <Grid
                  rows={[
                    ['Method', sale.paymentMethod],
                    ['Account', account?.name ?? '—'],
                    ['Subtotal', formatBDT(sale.subtotal)],
                    ['Discount', formatBDT(sale.discount)],
                    ['Total', formatBDT(sale.total)],
                    ['Paid', formatBDT(sale.paidAmount)],
                    ['Due', formatBDT(sale.dueAmount)],
                  ]}
                />
              </Section>
              <Section title="Profit Summary">
                <Grid
                  rows={[
                    ['COGS', formatBDT(insights.cogs)],
                    ['Gross Profit', formatBDT(insights.grossProfit)],
                    ['Discount', formatBDT(insights.discount)],
                    ['Items Sold', String(insights.itemsSold)],
                  ]}
                />
              </Section>
            </TabsContent>

            <TabsContent value="items">
              <TransactionLineItemsSection
                items={sale.items.map((item) => ({
                  id: item.productId,
                  productName: item.name,
                  productId: item.productId,
                  qty: item.quantity,
                  unitPrice: item.unitPrice,
                  lineDiscount: item.discount,
                  lineTotal: item.total,
                }))}
                grandTotal={sale.total}
                showImage={false}
                showDiscount
                labels={{
                  unitPrice: 'Price',
                  empty: 'No items on this sale.',
                }}
                headingId="legacy-sale-items-heading"
              />
            </TabsContent>

            <TabsContent value="payments">
              <Section title="Payment Summary">
                <Grid
                  rows={[
                    ['Payment Method', sale.paymentMethod],
                    ['Paid Amount', formatBDT(sale.paidAmount)],
                    ['Outstanding', formatBDT(sale.dueAmount)],
                    ['Commission', commissions.map((c) => `${formatBDT(c.amount)} (${c.status})`).join(', ') || '—'],
                  ]}
                />
              </Section>
            </TabsContent>

            <TabsContent value="collections">
              <Section title="Collections">
                {collections.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No collections yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {collections.map((c) => (
                      <li key={c.id} className="flex justify-between border-t pt-2 text-sm">
                        <span>
                          {c.reference} · {formatDateShort(c.created_at)}
                          {c.saleId === sale.id ? ' · This sale' : ''}
                        </span>
                        <span className="font-semibold">{formatBDT(c.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="courier">
              <Section title="Courier Information">
                <Grid
                  rows={[
                    ['Delivery Method', sale.deliveryMethod],
                    ['Courier', sale.courierId || '—'],
                    ['Customer Address', customer?.address || '—'],
                  ]}
                />
              </Section>
            </TabsContent>

            <TabsContent value="activity">
              <Section title="Activity Timeline">
                {activities.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No activity logged.</p>
                ) : (
                  <ol className="space-y-3 border-l-2 border-[#E5E7EB] pl-4">
                    {activities.map((a) => (
                      <li key={a.id} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#E11D48]" />
                        <p className="font-medium">{a.action}</p>
                        <p className="text-xs text-[#6B7280]">{a.details}</p>
                        <p className="text-[11px] text-[#9CA3AF]">
                          {a.userName} · {formatDateTime(a.created_at)}
                        </p>
                      </li>
                    ))}
                  </ol>
                )}
                {returns.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase text-[#6B7280]">Returns</p>
                    {returns.map((r) => (
                      <p key={r.id} className="text-sm">
                        {formatBDT(r.total)} · {r.reason} · {formatDateShort(r.created_at)}
                      </p>
                    ))}
                  </div>
                )}
              </Section>
            </TabsContent>

            <TabsContent value="print">
              <Section title="Print Actions">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => openPrint(`/print/sales/${sale.id}/a4`)}>A4 Invoice</Button>
                  <Button variant="outline" onClick={() => openPrint(`/print/sales/${sale.id}/pos`)}>
                    POS 58/80mm
                  </Button>
                  <Button variant="outline" onClick={() => openPrint(`/print/sales/${sale.id}/gift-label`)}>
                    Gift Label
                  </Button>
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="attachments">
              <Section title="Attachments">
                <p className="text-sm text-[#6B7280]">No attachments uploaded for this sale.</p>
              </Section>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Quick Stats</p>
            <dl className="space-y-2.5 text-sm">
              <Stat label="Gross Profit" value={formatBDT(insights.grossProfit)} />
              <Stat label="Discount" value={formatBDT(insights.discount)} />
              <Stat label="Items Sold" value={String(insights.itemsSold)} />
              <Stat label="Customer LTV" value={formatBDT(insights.customerLifetimeValue)} />
              <Stat label="Previous Orders" value={String(insights.previousOrders)} />
              <Stat label="Outstanding Due" value={formatBDT(insights.outstandingDue)} />
            </dl>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this sale?"
        description="Soft delete removes the list record only. Use Void on a completed sale to reverse stock, ledger, and residual commission."
        confirmLabel="Delete Sale"
        variant="danger"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </PageShell>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-serif text-lg">{title}</h3>
      {children}
    </div>
  )
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-[#F1F5F9] py-1.5 text-sm last:border-0 sm:block sm:border-0 sm:py-0">
          <dt className="text-[#6B7280]">{k}</dt>
          <dd className="font-medium text-[#111111]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-[#6B7280]">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  )
}
