import { UserRound, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/auth-session'
import {
  CustomerRatingStars,
  getPosCustomerSummary,
  type PosCustomerSummary,
} from '@/features/customer-rating'

type CustomerSummaryCardProps = {
  customerId: string
  onClear?: () => void
  className?: string
  compact?: boolean
}

function FinancialBadge({ summary }: { summary: PosCustomerSummary }) {
  if (summary.financial_status === 'due') {
    return (
      <Badge variant="danger" className="text-[10px]">
        Due {formatBDT(summary.current_due)}
      </Badge>
    )
  }
  if (summary.financial_status === 'advance') {
    return (
      <Badge variant="info" className="text-[10px]">
        Advance {formatBDT(summary.current_advance)}
      </Badge>
    )
  }
  return (
    <Badge variant="success" className="text-[10px]">
      Settled
    </Badge>
  )
}

export function CustomerSummaryCard({
  customerId,
  onClear,
  className,
  compact = true,
}: CustomerSummaryCardProps) {
  const { profile } = useAuth()
  const orgId = profile?.organization_id ?? null

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['pos-customer-summary', orgId, customerId],
    queryFn: () => getPosCustomerSummary(customerId),
    enabled: Boolean(customerId) && Boolean(orgId),
    staleTime: 30_000,
    // Avoid flashing stale customer when switching quickly
    placeholderData: undefined,
  })

  if (!customerId) return null

  if (isLoading) {
    return (
      <div
        className={cn(
          'animate-pulse rounded-xl border border-border bg-[#F8F6F2] p-3',
          className,
        )}
        aria-busy
      >
        <div className="h-4 w-1/2 rounded bg-[#E5E7EB]" />
        <div className="mt-2 h-3 w-2/3 rounded bg-[#E5E7EB]" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-white p-3 text-xs text-[#6B7280]',
          className,
        )}
      >
        Summary unavailable — checkout still works.
        {onClear ? (
          <Button type="button" variant="ghost" size="sm" className="ml-2 h-7" onClick={onClear}>
            Clear
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-[#E5E7EB] bg-[#F8F6F2] p-3',
        isFetching ? 'opacity-90' : null,
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#E11D48] shadow-sm">
          <UserRound className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-[#111111]">{data.name}</p>
            <Badge
              variant={
                data.status === 'active' ? 'success' : data.status === 'blocked' ? 'danger' : 'default'
              }
              className="text-[10px]"
            >
              {data.status}
            </Badge>
            <FinancialBadge summary={data} />
          </div>
          <p className="truncate text-xs text-[#6B7280]">{data.phone}</p>
          {data.address ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-[#6B7280]">{data.address}</p>
          ) : null}
          <div className="mt-1.5">
            <CustomerRatingStars score={data.rating} status={data.rating_status} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[#4B5563]">
            <span>{formatBDT(data.total_spent)} sales</span>
            <span>{data.completed_orders} orders</span>
            {compact && data.return_count > 0 ? (
              <span>{data.return_count} returns</span>
            ) : null}
            {!compact && data.return_count > 0 ? (
              <span>
                Returns {data.return_count} · {formatBDT(data.return_total)}
              </span>
            ) : null}
            {data.last_purchase_at ? (
              <span>Last {new Date(data.last_purchase_at).toLocaleDateString()}</span>
            ) : null}
          </div>
        </div>
        {onClear ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClear}
            aria-label="Clear customer"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
