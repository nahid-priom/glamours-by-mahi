import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function ValuationInfoTooltip({
  label,
  formula,
  className,
}: {
  label: string
  formula: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} title={formula}>
      <span>{label}</span>
      <Info className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" aria-hidden />
      <span className="sr-only">{formula}</span>
    </span>
  )
}

export function InventoryKpiCard({
  label,
  value,
  hint,
  accent,
}: {
  label: ReactNode
  value: string
  hint?: string
  accent?: 'primary' | 'cost' | 'value' | 'profit' | 'warning' | 'danger'
}) {
  const accentClass =
    accent === 'cost'
      ? 'border-l-[#6366F1]'
      : accent === 'value'
        ? 'border-l-[#059669]'
        : accent === 'profit'
          ? 'border-l-[#168F5C]'
          : accent === 'warning'
            ? 'border-l-[#D97706]'
            : accent === 'danger'
              ? 'border-l-[#DC2626]'
              : 'border-l-[#111827]'

  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border border-border bg-white px-4 py-3 shadow-sm',
        'border-l-4',
        accentClass,
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-[#111827] sm:text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[#9CA3AF]">{hint}</p> : null}
    </div>
  )
}

export function MoneyValue({
  amount,
  hidden,
  className,
}: {
  amount: number | null | undefined
  hidden?: boolean
  className?: string
}) {
  if (hidden || amount == null) {
    return <span className={cn('text-[#9CA3AF]', className)}>—</span>
  }
  return (
    <span className={className}>
      ৳{amount.toLocaleString('en-BD', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
    </span>
  )
}

export function QuantityValue({ qty, className }: { qty: number; className?: string }) {
  return (
    <span className={className}>
      {qty.toLocaleString('en-BD', { maximumFractionDigits: 3 })}
    </span>
  )
}
