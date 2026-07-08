import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccountStatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  tone?: 'rose' | 'slate' | 'green' | 'amber' | 'blue'
  className?: string
}

const toneStyles = {
  rose: 'bg-[#E11D48]/8 text-[#E11D48]',
  slate: 'bg-[#111111]/5 text-[#111111]',
  green: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  blue: 'bg-sky-500/10 text-sky-600',
}

export function AccountStatCard({ icon: Icon, value, label, tone = 'slate', className }: AccountStatCardProps) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-[#111111]/8 bg-white p-4 shadow-sm sm:p-5',
        className,
      )}
    >
      <div className={cn('inline-flex rounded-2xl p-2.5', toneStyles[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 font-serif text-2xl text-[#111111]">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-[#6B7280]">{label}</p>
    </div>
  )
}
