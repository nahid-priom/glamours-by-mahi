import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FraudRiskBadge } from './FraudRiskBadge'
import type { Customer } from '@/features/customers/customers.types'

interface FraudCustomerActionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  mode: 'block' | 'unblock'
  onConfirm: (customerId: string, reason?: string) => Promise<void>
  loading?: boolean
}

export function FraudCustomerActionDialog({
  open,
  onOpenChange,
  customer,
  mode,
  onConfirm,
  loading,
}: FraudCustomerActionDialogProps) {
  const [reason, setReason] = useState('')

  if (!customer) return null

  const handleConfirm = async () => {
    if (mode === 'block' && !reason.trim()) return
    await onConfirm(customer.id, mode === 'block' ? reason : undefined)
    setReason('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{mode === 'block' ? 'Block Customer' : 'Unblock Customer'}</DialogTitle>
          <DialogDescription>
            {mode === 'block'
              ? `Block ${customer.name} from placing new orders?`
              : `Remove ${customer.name} from the blacklist?`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-medium">{customer.name}</p>
            <p className="text-xs text-text-muted">{customer.phone}</p>
            <div className="mt-2">
              <FraudRiskBadge level={customer.fraud_level} />
            </div>
          </div>
          {mode === 'block' && (
            <div className="space-y-1.5">
              <Label>Block Reason</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Repeated COD refusals"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={mode === 'block' ? 'danger' : 'default'}
            onClick={handleConfirm}
            disabled={loading || (mode === 'block' && !reason.trim())}
          >
            {mode === 'block' ? 'Block Customer' : 'Unblock Customer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
