import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
import { invalidateCustomerCollectionCaches } from '@/lib/mutations/party-finance-cache'

export function SaleCollectionPage() {
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

  const [amount, setAmount] = useState(0)
  const [accountId, setAccountId] = useState(
    () => db.financialAccounts.find((a) => a.type === 'Cash')?.id ?? db.financialAccounts[0]?.id ?? '',
  )
  const [note, setNote] = useState('')

  const mutation = useMutation({
    mutationFn: async () =>
      salesService.receivePayment({
        saleId: id!,
        amount,
        accountId,
        note,
        userName: session.name,
        idempotencyKey: `pay_${id}_${Date.now()}`,
      }),
    onSuccess: async () => {
      await invalidateCustomerCollectionCaches(queryClient, {
        customerId: sale?.customerId,
        saleId: id,
        branchId: session.branchId,
      })
      toast('Payment received')
      navigate(`/sales/${id}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!sale || sale.deleted_at) return <EmptyState title="Sale not found" />
  if (sale.dueAmount <= 0) {
    return <EmptyState title="Nothing due" description="This sale is fully paid." />
  }

  return (
    <PageShell
      title={`Collect · ${sale.saleNo}`}
      description={`Outstanding due ${formatBDT(sale.dueAmount)}`}
      actions={
        <Link to={`/sales/${sale.id}`}>
          <Button variant="outline" className="rounded-full">Back</Button>
        </Link>
      }
    >
      <div className="mx-auto max-w-md space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex justify-between text-sm">
          <span>Invoice total</span>
          <span className="font-semibold">{formatBDT(sale.total)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>Already paid</span>
          <span>{formatBDT(sale.paidAmount)}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-sm font-bold text-amber-700">
          <span>Due</span>
          <span>{formatBDT(sale.dueAmount)}</span>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-[#6B7280]">Amount</span>
          <Input
            type="number"
            value={amount || ''}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            placeholder={String(sale.dueAmount)}
            className="rounded-xl"
          />
          <button
            type="button"
            className="mt-1 text-xs font-medium text-[#E11D48]"
            onClick={() => setAmount(sale.dueAmount)}
          >
            Pay full due
          </button>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#6B7280]">Account</span>
          <select
            className="h-10 w-full rounded-xl border px-3 text-sm"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {db.financialAccounts.filter((a) => a.isActive).map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[#6B7280]">Note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="rounded-xl" />
        </label>
        <Button
          className="w-full rounded-full"
          disabled={mutation.isPending || amount <= 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Saving…' : 'Receive Payment'}
        </Button>
      </div>
    </PageShell>
  )
}
