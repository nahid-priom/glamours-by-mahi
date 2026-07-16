import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { listProductAudit, type ProductAuditEntry } from '../repositories/catalog.repository'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

type Props = {
  productId: string
}

function formatAuditMessage(entry: ProductAuditEntry): string {
  const action = entry.action
  const after = entry.after_data as Record<string, unknown> | null

  switch (action) {
    case 'product.create':
      return `Product created${after?.status ? ` as ${String(after.status)}` : ''}`
    case 'product.duplicate':
      return 'Product duplicated from another product'
    case 'product.submit':
      return 'Submitted for approval'
    case 'product.approve':
      return 'Approved for sale'
    case 'product.reject':
      return entry.reason ? `Rejected: ${entry.reason}` : 'Rejected'
    case 'product.activate':
      return 'Activated'
    case 'product.deactivate':
      return 'Deactivated'
    case 'product.archive':
      return 'Archived'
    case 'product.restore':
      return 'Restored from archive'
    case 'product.update':
      return 'Product updated'
    case 'opening_stock.create':
      return after?.quantity
        ? `Opening stock added (${String(after.quantity)} units)`
        : 'Opening stock added'
    default:
      return entry.reason ?? action.replace(/\./g, ' ')
  }
}

export function ProductActivityTimeline({ productId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-audit', productId],
    queryFn: () => listProductAudit(productId),
    enabled: Boolean(productId),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading activity…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-[#E11D48]">Failed to load activity.</p>
  }

  const entries = data ?? []

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="mb-3 font-semibold text-[#111111]">Activity</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-[#6B7280]">No activity recorded yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-border pl-4">
          {entries.map((entry) => (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-4 ring-white" />
              <p className="text-sm font-medium text-[#111111]">{formatAuditMessage(entry)}</p>
              <p className="text-xs text-[#9CA3AF]">
                {relativeTime(entry.created_at)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
