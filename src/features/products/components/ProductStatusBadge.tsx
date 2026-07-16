import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ProductLifecycleStatus } from '../lib/product-filters'

const STATUS_CONFIG: Record<
  ProductLifecycleStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'blocked' }
> = {
  draft: { label: 'Draft', variant: 'default' },
  pending_approval: { label: 'Pending', variant: 'warning' },
  approved: { label: 'Approved', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  inactive: { label: 'Inactive', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'danger' },
  archived: { label: 'Archived', variant: 'purple' },
}

type Props = {
  status?: string | null
  className?: string
}

export function ProductStatusBadge({ status, className }: Props) {
  const key = (status ?? 'draft') as ProductLifecycleStatus
  const config = STATUS_CONFIG[key] ?? { label: status ?? 'Unknown', variant: 'default' as const }

  return (
    <Badge variant={config.variant} className={cn('capitalize', className)}>
      {config.label}
    </Badge>
  )
}
