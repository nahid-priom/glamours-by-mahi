import { CreditCard, Package, RotateCcw, Shield, Sparkles, Truck } from 'lucide-react'

const BENEFITS = [
  { icon: Truck, title: 'Free Delivery', desc: 'Orders over ৳3,000' },
  { icon: Shield, title: 'Authentic Products', desc: 'Verified brands' },
  { icon: RotateCcw, title: 'Easy Return', desc: '3-day exchange' },
  { icon: CreditCard, title: 'Secure Payment', desc: 'COD available' },
  { icon: Sparkles, title: 'New Arrivals', desc: 'Weekly drops' },
  { icon: Package, title: 'Special Offers', desc: 'Beauty & fashion' },
] as const

export function BenefitStrip() {
  return (
    <section className="border-y border-[var(--sf-border)] bg-white">
      <div className="sf-container grid max-w-[1440px] grid-cols-2 gap-px bg-[var(--sf-border)] sm:grid-cols-3 lg:grid-cols-6">
        {BENEFITS.map(({ icon: Icon, title, desc }) => (
          <div
            key={title}
            className="flex flex-col items-start gap-2 bg-white px-4 py-5 sm:px-5 sm:py-6"
          >
            <Icon className="h-5 w-5 text-[var(--sf-primary)]" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-[var(--sf-ink)]">{title}</p>
              <p className="mt-0.5 text-xs text-[var(--sf-muted)]">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
