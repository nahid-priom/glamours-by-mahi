import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DashboardKpiCardProps {
  title: string
  value: number
  icon: LucideIcon
  tone?: 'rose' | 'green' | 'amber' | 'blue' | 'slate'
  trend?: number
  trendLabel?: string
  to?: string
  sparkline?: number[]
}

const tones = {
  rose: 'bg-[#E11D48]/10 text-[#E11D48]',
  green: 'bg-emerald-500/10 text-emerald-600',
  amber: 'bg-amber-500/10 text-amber-600',
  blue: 'bg-sky-500/10 text-sky-600',
  slate: 'bg-slate-100 text-slate-700',
}

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 64
      const y = 20 - ((v - min) / range) * 16
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width="48" height="18" viewBox="0 0 64 24" className="shrink-0 opacity-80" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  )
}

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  tone = 'slate',
  trend = 0,
  trendLabel = 'vs yesterday',
  to,
  sparkline,
}: DashboardKpiCardProps) {
  const positive = trend >= 0
  const sparkColor =
    tone === 'rose'
      ? '#E11D48'
      : tone === 'green'
        ? '#059669'
        : tone === 'amber'
          ? '#D97706'
          : tone === 'blue'
            ? '#0284C7'
            : '#64748B'

  const content = (
    <div className="flex h-full flex-col rounded-xl border border-[#E5E7EB] bg-white p-2 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-1">
        <div className={cn('inline-flex rounded-lg p-1.5', tones[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        {sparkline && sparkline.length > 1 && <MiniSparkline values={sparkline} color={sparkColor} />}
      </div>
      <p className="mt-1.5 truncate text-sm font-bold leading-tight text-[#111111]">{formatBDT(value)}</p>
      <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-wide text-[#6B7280]">{title}</p>
      <div
        className={cn(
          'mt-1 flex items-center gap-0.5 truncate text-[9px] font-semibold',
          positive ? 'text-emerald-600' : 'text-[#E11D48]',
        )}
      >
        {positive ? <TrendingUp className="h-2.5 w-2.5 shrink-0" /> : <TrendingDown className="h-2.5 w-2.5 shrink-0" />}
        <span className="truncate">
          {positive ? '+' : ''}
          {trend}% {trendLabel}
        </span>
      </div>
    </div>
  )

  if (to) {
    return (
      <Link to={to} className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2">
        {content}
      </Link>
    )
  }
  return content
}
