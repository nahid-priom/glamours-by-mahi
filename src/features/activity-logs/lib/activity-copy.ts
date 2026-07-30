export type ActivityModule =
  | 'sales'
  | 'products'
  | 'inventory'
  | 'purchases'
  | 'customers'
  | 'commissions'
  | 'courier'
  | 'hr'
  | 'accounts'
  | 'other'

export type ActivityFeedItem = {
  id: string
  created_at: string
  branch_id: string | null
  branch_name: string | null
  actor_id: string | null
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: string | null
  reason: string | null
  module: ActivityModule | string
  before_data: Record<string, unknown> | null
  after_data: Record<string, unknown> | null
  request_meta: Record<string, unknown> | null
}

function str(v: unknown): string | null {
  if (v == null || v === '') return null
  return String(v)
}

function humanizeAction(action: string): string {
  return action.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Build a plain-language sentence for an audit row. */
export function formatActivitySentence(item: ActivityFeedItem): string {
  const actor = item.actor_name?.trim() || 'Someone'
  const after = item.after_data ?? {}
  const invoice = str(after.invoice_no)
  const name = str(after.name) ?? str(after.full_name) ?? str(after.product_name)

  switch (item.action) {
    case 'sale.create':
      return `${actor} completed sale${invoice ? ` ${invoice}` : ''}`
    case 'sale.void':
      return `${actor} voided invoice${invoice ? ` ${invoice}` : ''}${item.reason ? ` — ${item.reason}` : ''}`
    case 'sale.edit':
      return `${actor} edited sale${invoice ? ` ${invoice}` : ''}`
    case 'online_order.fulfil':
      return `${actor} fulfilled online order${invoice ? ` ${invoice}` : ''}`
    case 'online_order.cancel':
      return `${actor} cancelled an online order${invoice ? ` ${invoice}` : ''}`
    case 'online_order.approve':
      return `${actor} approved an online order${invoice ? ` ${invoice}` : ''}`
    case 'product.create':
      return `${actor} created product${name ? ` “${name}”` : ''}`
    case 'product.update':
      return `${actor} updated product${name ? ` “${name}”` : ''}`
    case 'product.status_change':
      return `${actor} changed product status${after.status ? ` to ${String(after.status)}` : ''}`
    case 'commission.rule.upsert':
      return `${actor} saved a commission structure`
    case 'opening_stock.create':
      return `${actor} added opening stock`
    default:
      if (item.reason?.trim()) return `${actor}: ${item.reason.trim()}`
      return `${actor} — ${humanizeAction(item.action)}`
  }
}

export function activityEntityPath(item: ActivityFeedItem): string | null {
  if (!item.entity_id) return null
  switch (item.entity_type) {
    case 'sale':
      return `/sales/${item.entity_id}`
    case 'product':
      return `/products/${item.entity_id}`
    case 'customer':
      return `/customers/${item.entity_id}`
    case 'purchase':
      return `/purchases/${item.entity_id}`
    case 'salesman_commission_rule':
      return '/hr/commission-settings'
    default:
      return null
  }
}

export function relativeActivityTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 14) return `${days}d ago`
  return new Date(iso).toLocaleString()
}

export const ACTIVITY_MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All modules' },
  { value: 'sales', label: 'Sales' },
  { value: 'products', label: 'Products' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'customers', label: 'Customers' },
  { value: 'commissions', label: 'Commissions' },
  { value: 'courier', label: 'Courier' },
  { value: 'hr', label: 'HR' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'other', label: 'Other' },
]

export function friendlyDiffEntries(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): Array<{ key: string; from: string; to: string }> {
  const keys = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  const skip = new Set(['id', 'organization_id', 'created_at', 'updated_at', 'deleted_at', 'created_by', 'updated_by', 'version'])
  const rows: Array<{ key: string; from: string; to: string }> = []
  for (const key of keys) {
    if (skip.has(key)) continue
    const from = before?.[key]
    const to = after?.[key]
    if (JSON.stringify(from) === JSON.stringify(to)) continue
    rows.push({
      key: key.replace(/_/g, ' '),
      from: from == null ? '—' : typeof from === 'object' ? JSON.stringify(from) : String(from),
      to: to == null ? '—' : typeof to === 'object' ? JSON.stringify(to) : String(to),
    })
  }
  return rows.slice(0, 20)
}
