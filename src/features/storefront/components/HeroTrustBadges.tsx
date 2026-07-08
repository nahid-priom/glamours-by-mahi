import { memo } from 'react'
import { Check } from 'lucide-react'

const TRUST_ITEMS = [
  'Cash on Delivery',
  'Easy Return',
  'Nationwide Shipping',
] as const

export const HeroTrustBadges = memo(function HeroTrustBadges() {
  return (
    <div className="mt-8 grid grid-cols-3 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:gap-6 lg:gap-8">
      {TRUST_ITEMS.map((item) => (
        <div key={item} className="flex items-center gap-1.5 sm:gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
          <span className="text-[11px] font-medium text-slate-600 sm:text-sm">{item}</span>
        </div>
      ))}
    </div>
  )
})
