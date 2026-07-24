import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  onClear?: () => void
  onRetry?: () => void
  variant?: 'empty' | 'error'
}

export function InventoryEmptyState({ onClear, onRetry, variant = 'empty' }: Props) {
  if (variant === 'error') {
    return (
      <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-10 text-center">
        <p className="text-sm font-medium text-[#B91C1C]">Unable to load stock records.</p>
        {onRetry ? (
          <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            Retry
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-dashed border-border bg-white px-4 py-12 text-center">
      <p className="text-sm font-medium text-[#111827]">No stock records found</p>
      {onClear ? (
        <Button size="sm" variant="outline" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      ) : null}
    </div>
  )
}
