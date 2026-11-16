import { cn } from '@/lib/utils'

const LABELS: Record<string, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
  negative_stock: 'Negative stock',
  in_transit: 'In transit',
  damaged: 'Damaged',
  quarantine: 'Quarantine',
}

const STYLES: Record<string, string> = {
  in_stock: 'bg-[#ECFDF5] text-[#168F5C]',
  low_stock: 'bg-[#FFF7ED] text-[#C2410C]',
  out_of_stock: 'bg-[#FEF2F2] text-[#DC2626]',
  negative_stock: 'bg-[#FEF2F2] text-[#991B1B]',
  in_transit: 'bg-[#EFF6FF] text-[#2563EB]',
  damaged: 'bg-[#FFF7ED] text-[#9A3412]',
  quarantine: 'bg-[#F5F3FF] text-[#6D28D9]',
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
