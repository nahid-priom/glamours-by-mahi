import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { purchasesRepository } from '../repositories/purchases.repository'

export type VoidPurchaseReturnMode = 'delete' | 'edit'

export function VoidPurchaseReturnDialog({
  returnId,
  returnNo,
  mode,
  open,
  onOpenChange,
  onVoided,
}: {
  returnId: string
  returnNo?: string
  mode: VoidPurchaseReturnMode
  open: boolean
  onOpenChange: (open: boolean) => void
  onVoided?: (ctx: {
    mode: VoidPurchaseReturnMode
    returnId: string
    purchaseId: string
    reason: string
    items: Array<{
      purchase_item_id: string | null
      variant_id: string
      qty: number
      unit_cost: number
    }>
  }) => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const mutation = useMutation({
    mutationFn: async () => {
      const detail = await purchasesRepository.getPurchaseReturn(returnId)
      if (!detail) throw new Error('Purchase return not found')
      await purchasesRepository.voidPurchaseReturn(returnId, reason.trim())
      const items = (
        detail.purchase_return_items as Array<{
          purchase_item_id: string | null
          variant_id: string
          qty: number
          unit_cost: number
        }> | null
      ) ?? []
      return {
        mode,
        returnId,
        purchaseId: detail.purchase_id,
        reason: detail.reason ?? '',
        items: items.map((i) => ({
          purchase_item_id: i.purchase_item_id,
          variant_id: i.variant_id,
          qty: Number(i.qty),
          unit_cost: Number(i.unit_cost),
        })),
      }
    },
    onSuccess: (ctx) => {
      toast(mode === 'edit' ? 'Return voided — recreate below' : 'Purchase return voided')
      onOpenChange(false)
      setReason('')
      setConfirmed(false)
      onVoided?.(ctx)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const title = mode === 'edit' ? 'Edit purchase return' : 'Void purchase return'

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setReason('')
          setConfirmed(false)
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-[#6B7280]">
            {mode === 'edit'
              ? `Voiding ${returnNo ?? 'this return'} restores stock, supplier due, cash refund, and journals. You can then post a corrected return.`
              : `Returns are never hard-deleted. Voiding ${returnNo ?? 'this return'} restores stock, reverses supplier ledger and purchase due, voids cash refunds, and reverses the journal.`}
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="pr-void-reason">Reason *</Label>
            <Input
              id="pr-void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required reason"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this void is authorized and understand stock and ledger will be restored.
          </label>
          <Button
            className="w-full"
            variant="danger"
            disabled={!reason.trim() || !confirmed || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending
              ? 'Voiding…'
              : mode === 'edit'
                ? 'Void and edit'
                : 'Confirm void'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
