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
  /** Null/undefined when prior-period baseline is unavailable — never fabricate +0%. */
  trend?: number | null
  trendLabel?: string
  to?: string
  sparkline?: number[]
  size?: 'primary' | 'secondary'
  valueAsCount?: boolean
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
    <svg width="56" height="20" viewBox="0 0 64 24" className="shrink-0 opacity-80" aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} />
    </svg>
  )
}

function formatValue(value: number, asCount: boolean) {
  if (asCount) return new Intl.NumberFormat('en-BD').format(value)
  return formatBDT(value)
}

export function DashboardKpiCard({
  title,
  value,
  icon: Icon,
  tone = 'slate',
  trend = null,
  trendLabel = 'vs prior period',
  to,
  sparkline,
  size = 'secondary',
  valueAsCount = false,
}: DashboardKpiCardProps) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend)
  const positive = hasTrend ? trend >= 0 : true
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
    <div
      className={cn(
        'flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-sm transition hover:shadow-md',
        size === 'primary' ? 'p-4' : 'p-3',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={cn('inline-flex rounded-xl p-2', tones[tone])}>
          <Icon className={cn(size === 'primary' ? 'h-4 w-4' : 'h-3.5 w-3.5')} />
        </div>
        {sparkline && sparkline.length > 1 && size === 'primary' ? (
          <MiniSparkline values={sparkline} color={sparkColor} />
        ) : null}
      </div>
      <p
        className={cn(
          'mt-3 font-bold leading-tight tracking-tight text-slate-900',
          size === 'primary' ? 'text-[1.55rem]' : 'text-lg',
        )}
      >
        {formatValue(value, valueAsCount)}
      </p>
      <p className="mt-1 truncate text-xs font-medium text-slate-500">{title}</p>
      {hasTrend ? (
        <div
          className={cn(
            'mt-2 flex items-center gap-1 truncate text-[11px] font-semibold',
            positive ? 'text-emerald-600' : 'text-[#E11D48]',
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3 shrink-0" /> : <TrendingDown className="h-3 w-3 shrink-0" />}
          <span className="truncate">
            {positive ? '+' : ''}
            {trend}% {trendLabel}
          </span>
        </div>
      ) : trendLabel && size === 'secondary' ? (
        <p className="mt-2 truncate text-[11px] text-slate-400">{trendLabel}</p>
      ) : (
        <p className="mt-2 text-[11px] text-slate-400">—</p>
      )}
    </div>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="block h-full rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48] focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    )
  }
  return content
}
