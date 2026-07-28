import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { EmptyState } from '@/components/shared/EmptyState'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { friendlyRpcError } from '@/lib/errors/rpc-error'
import { queryKeys } from '@/lib/query/keys'
import { invalidateSaleCompletionCaches } from '@/lib/mutations/party-finance-cache'
import {
  approveSalesReturn,
  getSale,
  listPaymentMethods,
} from './repositories/sales.repository'

type ReturnDraft = {
  saleItemId: string
  label: string
  maxQty: number
  qty: number
  unitPrice: number
  selected: boolean
  condition: string
}

export function SaleReturnPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [refundAccountId, setRefundAccountId] = useState('')
  const [lines, setLines] = useState<ReturnDraft[] | null>(null)

  const { data: sale, isLoading } = useQuery({
    queryKey: queryKeys.sale(id ?? ''),
    queryFn: () => getSale(id!),
    enabled: !!id,
  })

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: () => listPaymentMethods(),
  })

  const draftLines = useMemo(() => {
    if (lines) return lines
    if (!sale?.sale_items) return []
    return sale.sale_items.map((item) => {
      const product = item.product_variants?.products?.name ?? 'Product'
      const variant = item.product_variants?.name || item.product_variants?.sku || 'variant'
      return {
        saleItemId: item.id,
        label: `${product} · ${variant}`,
        maxQty: Number(item.qty),
        qty: Number(item.qty),
        unitPrice: Number(item.unit_price),
        selected: true,
        condition: 'sellable',
      } satisfies ReturnDraft
    })
  }, [lines, sale])

  const selectedLines = draftLines.filter((l) => l.selected && l.qty > 0)
  const returnTotal = selectedLines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0)

  const mutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Missing sale id')
      if (selectedLines.length === 0) throw new Error('Select at least one item to return')
      return approveSalesReturn({
        sale_id: id,
        reason: reason.trim() || 'Customer return',
        refund_account_id: refundAccountId || null,
        items: selectedLines.map((l) => ({
          sale_item_id: l.saleItemId,
          qty: l.qty,
          condition: l.condition,
        })),
      })
    },
    onSuccess: async () => {
      await invalidateSaleCompletionCaches(queryClient, {
        customerId: sale?.customer_id,
        branchId: sale?.branch_id,
      })
      await queryClient.invalidateQueries({ queryKey: queryKeys.sale(id ?? '') })
      toast('Sale return completed')
      navigate(`/sales/${id}`)
    },
    onError: (e: Error) => toast(friendlyRpcError(e), 'error'),
  })

  function updateLine(saleItemId: string, patch: Partial<ReturnDraft>) {
    setLines(
      draftLines.map((line) => {
        if (line.saleItemId !== saleItemId) return line
        const next = { ...line, ...patch }
        next.qty = Math.min(Math.max(0, next.qty), next.maxQty)
        return next
      }),
    )
  }

  if (isLoading) return <LoadingSkeleton rows={4} />
  if (!sale || sale.deleted_at) return <EmptyState title="Sale not found" />
  if (sale.status !== 'completed') {
    return (
      <EmptyState
        title="Cannot return"
        description="Only completed sales can be returned."
      />
    )
  }

  const refundAccounts = paymentMethods.filter((m) => m.financial_account_id)

  return (
    <PageShell
      title={`Return ${sale.invoice_no}`}
      description="Creates a completed sale return via approve_sales_return (stock + finance)."
      actions={
        <Link to={`/sales/${sale.id}`}>
          <Button variant="outline" className="rounded-full">
            Cancel
          </Button>
        </Link>
      }
    >
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-white p-5 shadow-sm">
        <ul className="space-y-3 text-sm">
          {draftLines.map((line) => (
            <li key={line.saleItemId} className="space-y-2 border-b pb-3">
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={line.selected}
                  onChange={(e) => updateLine(line.saleItemId, { selected: e.target.checked })}
                />
                <span className="flex-1">
                  <span className="font-medium">{line.label}</span>
                  <span className="mt-0.5 block text-xs text-[#6B7280]">
                    Sold {line.maxQty} · {formatBDT(line.unitPrice)}
                  </span>
                </span>
              </label>
              {line.selected ? (
                <div className="grid grid-cols-2 gap-2 pl-6">
                  <div>
                    <Label>Qty</Label>
                    <Input
                      type="number"
                      min={0.001}
                      max={line.maxQty}
                      step="any"
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.saleItemId, { qty: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={line.condition}
                      onChange={(e) =>
                        updateLine(line.saleItemId, { condition: e.target.value })
                      }
                    >
                      <option value="sellable">Sellable</option>
                      <option value="damaged">Damaged</option>
                      <option value="quarantine">Quarantine</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <p className="text-sm font-semibold">Return total: {formatBDT(returnTotal)}</p>

        <div>
          <Label>Refund account (if cash refund due)</Label>
          <select
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            value={refundAccountId}
            onChange={(e) => setRefundAccountId(e.target.value)}
          >
            <option value="">None / due only</option>
            {refundAccounts.map((m) => (
              <option key={m.id} value={m.financial_account_id ?? ''}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-[#6B7280]">Reason</span>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Damaged / Wrong size / Customer request"
            className="rounded-xl"
          />
        </label>

        <Button
          className="w-full rounded-full"
          disabled={mutation.isPending || selectedLines.length === 0}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'Processing…' : 'Confirm Return'}
        </Button>
      </div>
    </PageShell>
  )
}
