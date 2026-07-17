import { BadgeCheck, RefreshCcw, ShieldCheck, Sparkles, Tags, Truck } from 'lucide-react'

const BENEFITS = [
  { icon: Truck, title: 'Free Delivery', desc: 'Orders over ৳3,000' },
  { icon: BadgeCheck, title: 'Authentic Products', desc: 'Verified brands' },
  { icon: RefreshCcw, title: 'Easy Return', desc: '3-day exchange' },
  { icon: ShieldCheck, title: 'Secure Payment', desc: 'COD available' },
  { icon: Sparkles, title: 'New Arrivals', desc: 'Weekly drops' },
  { icon: Tags, title: 'Special Offers', desc: 'Exclusive deals' },
] as const

export function BenefitStrip() {
  return (
    <section className="sf-container max-w-[1440px] py-5 sm:py-6" aria-label="Shopping benefits">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex items-center gap-3 rounded-xl border border-[var(--sf-border)] bg-white p-3"
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--sf-primary-soft)] text-[var(--sf-primary)]">
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-[var(--sf-ink)]">{title}</h3>
              <p className="truncate text-xs text-[var(--sf-muted)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
