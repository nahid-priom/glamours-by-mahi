import { Banknote, Package, RotateCcw, ShieldCheck } from 'lucide-react'

const TRUST_ITEMS = [
  {
    icon: Package,
    title: 'Fast Delivery',
    text: '2–5 business days nationwide',
  },
  {
    icon: Banknote,
    title: 'Cash on Delivery',
    text: 'Pay when you receive',
  },
  {
    icon: RotateCcw,
    title: 'Easy Return',
    text: 'Exchange within 3 days',
  },
  {
    icon: ShieldCheck,
    title: 'Quality Assured',
    text: 'Premium curated pieces',
  },
] as const

export function ProductTrustCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TRUST_ITEMS.map(({ icon: Icon, title, text }) => (
        <div
          key={title}
          className="flex items-start gap-3 rounded-2xl border border-[#111111]/8 bg-white px-4 py-3.5"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F8F6F2]">
            <Icon className="h-4 w-4 text-[#E11D48]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111111]">{title}</p>
            <p className="mt-0.5 text-xs text-[#6B7280]">{text}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
