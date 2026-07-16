import { memo } from 'react'
import { Check } from 'lucide-react'

const TRUST_ITEMS = ['Authentic products', 'Cash on delivery', 'Nationwide shipping'] as const

export const HeroTrustBadges = memo(function HeroTrustBadges() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-2 sm:flex sm:flex-row sm:flex-wrap sm:gap-6">
      {TRUST_ITEMS.map((item) => (
        <div key={item} className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--sf-primary-soft)] text-[var(--sf-primary)]">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
          </span>
          <span className="text-[12px] font-medium text-[var(--sf-muted)] sm:text-sm">{item}</span>
        </div>
      ))}
    </div>
  )
})
