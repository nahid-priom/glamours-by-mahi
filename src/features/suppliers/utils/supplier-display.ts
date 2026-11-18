import { formatRelativeTime } from '@/lib/format'

export function supplierInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function formatActivityDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diffDays = (now - d.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 14) return formatRelativeTime(iso)
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatStockQuantity(value: number | null | undefined): string {
  if (value == null) return '—'
  return value.toLocaleString('en-BD')
}

export function stockQuantityLabel(value: number | null | undefined): string {
  if (value == null) return 'Unattributed'
  return value.toLocaleString('en-BD')
}