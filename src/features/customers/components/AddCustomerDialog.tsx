import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCreateCustomer } from '../hooks/useCreateCustomer'
import { isValidBdPhone, looksLikePhoneQuery, normalizeBdPhone } from '@/lib/phone-utils'
import { useAuth } from '@/features/auth/auth.context'
import { useToast } from '@/components/ui/toast'
import type { Customer } from '@/database/schema'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AddCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialPhone?: string
  initialName?: string
  preferredBranchId?: string | null
  onCreated: (customer: Customer) => void
  onSelectExisting?: (customer: Customer) => void
}

export function AddCustomerDialog({
  open,
  onOpenChange,
  initialPhone = '',
  initialName = '',
  preferredBranchId,
  onCreated,
  onSelectExisting,
}: AddCustomerDialogProps) {
  const { session } = useAuth()
  const { toast } = useToast()
  const { create, saving, error, duplicate, reset } = useCreateCustomer()

  const [phone, setPhone] = useState(initialPhone)
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    reset()
    setPhone(initialPhone)
    setName(looksLikePhoneQuery(initialName) ? '' : initialName)
    setEmail('')
    setAddress('')
    setNotes('')
    setPhoneError(null)
  }, [open, initialPhone, initialName, reset])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValidBdPhone(phone)) {
      setPhoneError('Enter a valid BD mobile (01XXXXXXXXX)')
      return
    }
    setPhoneError(null)

    const customer = await create({
      phone,
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      preferredBranchId: preferredBranchId ?? null,
      userName: session.name,
    })

    if (customer) {
      toast('Customer added successfully')
      onCreated(customer)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogDescription>
            Mobile number is required. Name is optional for quick POS checkout.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-[#6B7280]" htmlFor="pos-cust-phone">
              Mobile Number <span className="text-[#E11D48]">*</span>
            </label>
            <Input
              id="pos-cust-phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setPhoneError(null)
              }}
              placeholder="01XXXXXXXXX"
              autoFocus
              inputMode="tel"
              className="mt-1"
            />
            {(phoneError || (phone && !isValidBdPhone(phone) && phone.length > 8)) && (
              <p className="mt-1 text-xs text-[#E11D48]">
                {phoneError ?? 'Invalid Bangladesh mobile number'}
              </p>
            )}
            {normalizeBdPhone(phone) && (
              <p className="mt-1 text-[11px] text-[#6B7280]">
                Will save as {normalizeBdPhone(phone)}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B7280]" htmlFor="pos-cust-name">
              Customer Name <span className="font-normal">(optional)</span>
            </label>
            <Input
              id="pos-cust-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Optional"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B7280]" htmlFor="pos-cust-email">
              Email
            </label>
            <Input
              id="pos-cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B7280]" htmlFor="pos-cust-address">
              Address
            </label>
            <Input
              id="pos-cust-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[#6B7280]" htmlFor="pos-cust-notes">
              Notes
            </label>
            <Input
              id="pos-cust-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <p>{error}</p>
              {duplicate && onSelectExisting && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2 rounded-full"
                  onClick={() => {
                    onSelectExisting(duplicate)
                    onOpenChange(false)
                  }}
                >
                  Select Existing Customer
                </Button>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="rounded-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
