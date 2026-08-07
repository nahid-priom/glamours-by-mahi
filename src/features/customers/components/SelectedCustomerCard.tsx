import { Pencil, UserRound, X } from 'lucide-react'
import { formatBDT } from '@/lib/format'
import { displayCustomerName } from '@/lib/phone-utils'
import type { Customer } from '../customers.types'
import { Button } from '@/components/ui/button'

interface SelectedCustomerCardProps {
  customer: Customer
  onChange: () => void
  onClear: () => void
}

export function SelectedCustomerCard({ customer, onChange, onClear }: SelectedCustomerCardProps) {
  const name = displayCustomerName(customer.name, customer.phone)

  return (
    <div className="flex items-start gap-3 rounded-2xl border border-[#E5E7EB] bg-[#F8F6F2] p-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#E11D48] shadow-sm">
        <UserRound className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#111111]">{name}</p>
        <p className="text-xs text-[#6B7280]">{customer.phone}</p>
        {customer.address && (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6B7280]">{customer.address}</p>
        )}
        {Number(customer.currentDue ?? customer.current_due ?? 0) > 0 && (
          <p className="mt-1 text-[11px] font-semibold text-amber-700">
            Current due: {formatBDT(Number(customer.currentDue ?? customer.current_due ?? 0))}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onChange}
          aria-label="Change customer"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClear}
          aria-label="Clear customer"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
