import { formatBDT } from '@/lib/format'
import { displayCustomerName } from '@/lib/phone-utils'
import { cn } from '@/lib/utils'
import type { Customer } from '../customers.types'

interface CustomerSearchResultProps {
  customer: Customer
  query: string
  active?: boolean
  onSelect: (customer: Customer) => void
}

function highlight(text: string, query: string) {
  const q = query.trim()
  if (!q) return text
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-amber-100 px-0.5 text-inherit">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  )
}

export function CustomerSearchResult({
  customer,
  query,
  active,
  onSelect,
}: CustomerSearchResultProps) {
  const name = displayCustomerName(customer.name, customer.phone)

  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(customer)}
      className={cn(
        'flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left transition',
        active ? 'bg-[#F8F6F2]' : 'hover:bg-[#F8F6F2]',
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[#111111]">{highlight(name, query)}</p>
        <p className="mt-0.5 text-xs text-[#6B7280]">{highlight(customer.phone, query)}</p>
      </div>
      {Number(customer.currentDue ?? customer.current_due ?? 0) > 0 && (
        <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
          Due {formatBDT(Number(customer.currentDue ?? customer.current_due ?? 0))}
        </span>
      )}
    </button>
  )
}
