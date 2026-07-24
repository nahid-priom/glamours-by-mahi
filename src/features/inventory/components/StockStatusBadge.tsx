import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  overstock: 'Overstock',
}

const STYLES: Record<string, string> = {
  in_stock: 'bg-[#ECFDF5] text-[#168F5C]',
  low_stock: 'bg-[#FFF7ED] text-[#C2410C]',
  out_of_stock: 'bg-[#FEF2F2] text-[#DC2626]',
  overstock: 'bg-[#EFF6FF] text-[#2563EB]',
}

export function StockStatusBadge({ status, className }: { status: string; className?: string }) {
  const key = status?.toLowerCase() ?? 'in_stock'
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        STYLES[key] ?? STYLES.in_stock,
        className,
      )}
    >
      {LABELS[key] ?? key}
    </span>
  )
}
