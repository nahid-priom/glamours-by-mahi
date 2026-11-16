import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupplier, type Supplier } from '@/features/suppliers/repositories/suppliers.repository'
import { friendlyRpcError } from '@/lib/errors/rpc-error'

export type PurchaseQuickAddSupplierDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  branchId?: string | null
  onCreated: (supplier: Supplier) => void
}

export function PurchaseQuickAddSupplierDialog({
  open,
  onOpenChange,
  organizationId,
  branchId,
  onCreated,
}: PurchaseQuickAddSupplierDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setPhone('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const supplier = await createSupplier(organizationId, {
        name: trimmed,
        phone: phone.trim() || null,
        branch_id: branchId ?? null,
      })
      onCreated(supplier)
      onOpenChange(false)
    } catch (err) {
      setError(friendlyRpcError(err, 'Could not create supplier'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Supplier</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="purchase-quick-supplier-name">
              Name <span className="text-danger">*</span>
            </Label>
            <Input
              id="purchase-quick-supplier-name"
              autoFocus
              autoComplete="off"
              value={name}
              onChange={(ev) => setName(ev.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchase-quick-supplier-phone">
              Phone <span className="font-normal text-text-muted">(optional)</span>
            </Label>
            <Input
              id="purchase-quick-supplier-phone"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              disabled={submitting}
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {error}
            </div>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create &amp; Select
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
