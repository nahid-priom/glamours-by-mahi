import { Link } from 'react-router-dom'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type ReportKpi = {
  id: string
  label: string
  value: string
  hint?: string
  href?: string
  error?: string | null
  asOf?: boolean
}

export function ReportKPIGrid({
  items,
  loading,
  className,
}: {
  items: ReportKpi[]
  loading?: boolean
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-4', className)}>
      {items.map((k) => {
        const body = (
          <div className="rounded-xl border border-border bg-white p-4 transition-colors hover:border-[#D1D5DB]">
            <p className="text-[13px] text-[#6B7280]">{k.label}</p>
            {k.error ? (
              <p className="mt-2 text-sm text-[#E11D48]">{k.error}</p>
            ) : (
              <p className="mt-2 text-xl font-semibold tabular-nums text-[#111827]">{k.value}</p>
            )}
            {k.hint ? <p className="mt-1 text-xs text-[#9CA3AF]">{k.hint}</p> : null}
          </div>
        )
        return k.href && !k.error ? (
          <Link key={k.id} to={k.href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {body}
          </Link>
        ) : (
          <div key={k.id}>{body}</div>
        )
      })}
    </div>
  )
}
