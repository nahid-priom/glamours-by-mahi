import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { voidSale } from '../repositories/sales.repository'
import { useInvalidateSalesQueries } from '../hooks/use-sales-list'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function VoidSaleDialog({
  saleId,
  open,
  onOpenChange,
}: {
  saleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { toast } = useToast()
  const invalidate = useInvalidateSalesQueries()
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const mutation = useMutation({
    mutationFn: () => voidSale(saleId, reason.trim(), note.trim() || null),
    onSuccess: () => {
      toast('Sale voided')
      invalidate(saleId)
      onOpenChange(false)
      setReason('')
      setNote('')
      setConfirmed(false)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o)
        if (!o) {
          setReason('')
          setNote('')
          setConfirmed(false)
        }
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Void sale</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Completed invoices are never hard-deleted. Voiding restores stock, reverses ledger
            impact, and reverses remaining commission while preserving the original invoice.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="void-reason">Reason *</Label>
            <Input
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Required reason"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="void-note">Note (optional)</Label>
            <Input
              id="void-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional context"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I confirm this void is authorized and understand it cannot be undone as a hard delete.
          </label>
          <Button
            className="w-full"
            variant="danger"
            disabled={!reason.trim() || !confirmed || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Voiding…' : 'Confirm void'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
