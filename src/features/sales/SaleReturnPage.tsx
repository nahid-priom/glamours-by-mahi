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
import { salesService } from '@/services/sales.service'
import { formatBDT } from '@/lib/format'

export function SaleReturnPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')

  const { data: sale, isLoading } = useQuery({
    queryKey: ['sales', id],
    queryFn: () => salesService.getById(id!),
    enabled: !!id,
  })

  const mutation = useMutation({
    mutationFn: async () =>
      salesService.createReturn({
        saleId: id!,
        reason: reason.trim() || 'Customer return',
        userName: session.name,
        idempotencyKey: `return_${id}_${Date.now()}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      toast('Sale returned — stock restored & finance reversed')
      navigate(`/sales/${id}`)
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!sale || sale.deleted_at) return <EmptyState title="Sale not found" />
  if (sale.status === 'Returned') {
    return <EmptyState title="Already returned" description="This sale was already returned." />
  }

  return (
    <PageShell
      title={`Return ${sale.saleNo}`}
      description="Restores stock, reverses collections proportionally, and reverses commission on full return."
      actions={
        <Link to={`/sales/${sale.id}`}>
          <Button variant="outline" className="rounded-full">Cancel</Button>
        </Link>
      }
    >
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <ul className="space-y-2 text-sm">
          {sale.items.map((i) => (
            <li key={i.productId} className="flex justify-between border-b py-2">
              <span>
                {i.name} × {i.quantity}
              </span>
              <span className="font-medium">{formatBDT(i.total)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm font-semibold">Return total: {formatBDT(sale.total)}</p>
        <label className="block text-sm">
          <span className="mb-1 block text-[#6B7280]">Reason</span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged / Wrong size / Customer request"
            className="rounded-xl"
          />
        </label>
        <Button className="w-full rounded-full" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Processing…' : 'Confirm Return'}
        </Button>
      </div>
    </PageShell>
  )
}
