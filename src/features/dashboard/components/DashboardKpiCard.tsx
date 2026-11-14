import type { LucideIcon } from 'lucide-react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DashboardKpiCardProps {
  title: string
  value: number
  icon: LucideIcon
  tone?: 'rose' | 'green' | 'amber' | 'blue' | 'slate' | 'violet'
  /** Null/undefined when prior-period baseline is unavailable — never fabricate +0%. */
  trend?: number | null
  trendLabel?: string
  to?: string
  sparkline?: number[]
  size?: 'primary' | 'secondary'
  valueAsCount?: boolean
}

const iconTones = {
  rose: 'bg-[#E11D48]/12 text-[#E11D48]',
  green: 'bg-emerald-500/12 text-emerald-600',
  amber: 'bg-amber-500/12 text-amber-600',
  blue: 'bg-sky-500/12 text-sky-600',
  slate: 'bg-slate-100 text-slate-700',
  violet: 'bg-violet-500/12 text-violet-600',
}

const cardTints = {
  rose: 'border-[#FBCFE8]/80 bg-gradient-to-br from-[#FFF1F2] to-white',
  green: 'border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white',
  amber: 'border-amber-100 bg-gradient-to-br from-amber-50/70 to-white',
  blue: 'border-sky-100 bg-gradient-to-br from-sky-50/80 to-white',
  slate: 'border-slate-200/80 bg-white',
  violet: 'border-violet-100 bg-gradient-to-br from-violet-50/70 to-white',
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
  trendLabel,
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
            : tone === 'violet'
              ? '#7C3AED'
              : '#64748B'

  const content = (
    <div
      className={cn(
        'flex h-full items-center gap-3 rounded-2xl border shadow-sm transition hover:shadow-md',
        cardTints[tone],
        size === 'primary' ? 'min-h-[88px] px-3.5 py-3' : 'min-h-[72px] px-3 py-2.5',
      )}
    >
      <div
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl',
          iconTones[tone],
          size === 'primary' ? 'h-11 w-11' : 'h-9 w-9',
        )}
      >
        <Icon className={cn(size === 'primary' ? 'h-5 w-5' : 'h-4 w-4')} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-slate-500">{title}</p>
        <p
          className={cn(
            'mt-0.5 font-bold tabular-nums leading-tight tracking-tight text-slate-900',
            size === 'primary' ? 'text-[1.35rem] sm:text-[1.5rem]' : 'text-base sm:text-lg',
          )}
        >
          {formatValue(value, valueAsCount)}
        </p>
        {hasTrend ? (
          <div
            className={cn(
              'mt-1 flex items-center gap-1 truncate text-[11px] font-semibold',
              positive ? 'text-emerald-600' : 'text-[#E11D48]',
            )}
          >
            {positive ? (
              <TrendingUp className="h-3 w-3 shrink-0" />
            ) : (
              <TrendingDown className="h-3 w-3 shrink-0" />
            )}
            <span className="truncate">
              {positive ? '+' : ''}
              {trend}%
              {trendLabel ? ` ${trendLabel}` : ''}
            </span>
          </div>
        ) : trendLabel && size === 'secondary' ? (
          <p className="mt-0.5 truncate text-[10px] text-slate-400">{trendLabel}</p>
        ) : null}
      </div>

      {sparkline && sparkline.length > 1 && size === 'primary' ? (
        <MiniSparkline values={sparkline} color={sparkColor} />
      ) : null}
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
