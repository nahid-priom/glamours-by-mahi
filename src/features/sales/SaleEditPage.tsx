import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Minus, Plus, Trash2 } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth.context'
import { peekDatabase } from '@/database/transaction'
import { salesService } from '@/services/sales.service'
import { formatBDT } from '@/lib/format'
import type { PaymentMethod, SalesChannel } from '@/database/schema'

interface EditLine {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  discount: number
}

const CHANNELS: SalesChannel[] = [
  'Physical Shop',
  'Website',
  'Facebook',
  'WhatsApp',
  'Phone Order',
  'Marketplace',
]

const PAYMENTS: PaymentMethod[] = ['Cash', 'Card', 'bKash', 'Nagad', 'Bank Transfer', 'COD', 'Mixed']

export function SaleEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const db = peekDatabase()

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sales', id],
    queryFn: () => salesService.getById(id!),
    enabled: !!id,
  })

  const [customerId, setCustomerId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [salespersonId, setSalespersonId] = useState('')
  const [channel, setChannel] = useState<SalesChannel>('Physical Shop')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash')
  const [accountId, setAccountId] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState<'Pickup' | 'Home Delivery' | 'Courier'>('Pickup')
  const [courierId, setCourierId] = useState('')
  const [paidAmount, setPaidAmount] = useState(0)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<EditLine[]>([])

  useEffect(() => {
    if (!sale) return
    setCustomerId(sale.customerId)
    setBranchId(sale.branchId)
    setSalespersonId(sale.salespersonId)
    setChannel(sale.channel)
    setPaymentMethod(sale.paymentMethod)
    setAccountId(sale.accountId ?? '')
    setDeliveryMethod(sale.deliveryMethod)
    setCourierId(sale.courierId ?? '')
    setPaidAmount(sale.paidAmount)
    setNote(sale.note)
    setLines(
      sale.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
        discount: i.discount,
      })),
    )
  }, [sale])

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const discount = lines.reduce((s, l) => s + l.discount, 0)
  const total = subtotal - discount

  const mutation = useMutation({
    mutationFn: async () =>
      salesService.update({
        saleId: id!,
        customerId,
        branchId,
        salespersonId,
        channel,
        items: lines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          discount: l.discount,
        })),
        paymentMethod,
        paidAmount,
        accountId,
        deliveryMethod,
        courierId: courierId || null,
        note,
        userName: session.name,
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast('Sale updated — previous impacts reversed safely')
      navigate(`/sales/${updated.id}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) return <LoadingSkeleton rows={8} />
  if (!sale || sale.deleted_at) {
    return <EmptyState title="Cannot edit" description="Sale not found or already deleted." />
  }
  if (sale.status === 'Returned' || sale.status === 'Cancelled') {
    return <EmptyState title="Cannot edit" description={`This sale is ${sale.status.toLowerCase()}.`} />
  }

  const selectClass = 'h-10 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 text-sm'

  return (
    <PageShell
      title={`Edit ${sale.saleNo}`}
      description="Correction reverses stock, ledger, and remaining commission on the original invoice, then posts a linked replacement sale (commission accrues once on the new sale)."
      actions={
        <Link to={`/sales/${sale.id}`}>
          <Button variant="outline" className="rounded-full gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Customer</span>
              <select className={selectClass} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {db.customers.filter((c) => !c.deleted_at).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Branch</span>
              <select className={selectClass} value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {db.branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Salesperson</span>
              <select className={selectClass} value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
                {db.employees.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Channel</span>
              <select className={selectClass} value={channel} onChange={(e) => setChannel(e.target.value as SalesChannel)}>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Payment Method</span>
              <select className={selectClass} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                {PAYMENTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Account</span>
              <select className={selectClass} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {db.financialAccounts.filter((a) => a.isActive).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Delivery</span>
              <select
                className={selectClass}
                value={deliveryMethod}
                onChange={(e) => setDeliveryMethod(e.target.value as typeof deliveryMethod)}
              >
                <option value="Pickup">Pickup</option>
                <option value="Home Delivery">Home Delivery</option>
                <option value="Courier">Courier</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-[#6B7280]">Courier</span>
              <Input value={courierId} onChange={(e) => setCourierId(e.target.value)} placeholder="Optional" className="rounded-xl" />
            </label>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold">Line Items</p>
            <ul className="space-y-2">
              {lines.map((line, idx) => (
                <li key={line.productId} className="flex flex-wrap items-center gap-2 rounded-xl border p-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{line.name}</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l)),
                        )
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-8 text-center text-sm">{line.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, quantity: l.quantity + 1 } : l)),
                        )
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    type="number"
                    className="h-8 w-24 rounded-lg"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)),
                      )
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-[#6B7280]">Note</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
          </label>
        </div>

        <aside className="h-fit space-y-3 rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatBDT(subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span>Discount</span><span>{formatBDT(discount)}</span></div>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span><span>{formatBDT(total)}</span>
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-[#6B7280]">Paid Amount</span>
            <Input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value) || 0)}
              className="rounded-xl"
            />
          </label>
          <p className="text-sm text-[#6B7280]">Due: {formatBDT(Math.max(0, total - paidAmount))}</p>
          <Button
            className="w-full rounded-full"
            disabled={mutation.isPending || lines.length === 0}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </aside>
      </div>
    </PageShell>
  )
}
