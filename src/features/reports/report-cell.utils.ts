import type { FraudLevel } from '@/lib/constants'
import type { ReportCellData } from './reports.types'

export function formatReportDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function paymentStatusLabel(status?: string): string {
  switch (status) {
    case 'collected':
      return 'Collected'
    case 'refunded':
      return 'Refunded'
    default:
      return 'Unpaid'
  }
}

export function fraudRecommendation(level: string): string {
  switch (level) {
    case 'BLOCKED':
      return 'Do not ship'
    case 'HIGH':
      return 'Advance payment recommended'
    case 'MEDIUM':
      return 'Call confirmation'
    default:
      return 'Normal delivery'
  }
}

export function shortAddress(address?: string, max = 40): string | undefined {
  if (!address?.trim()) return undefined
  const trimmed = address.trim()
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

export function reportCell(
  title?: string,
  subtitle?: string,
  extra?: string,
  status?: string,
  tooltip?: string,
): ReportCellData {
  return { title, subtitle, extra, status, tooltip }
}

export function flattenReportCell(cell: ReportCellData): string {
  return [cell.title, cell.subtitle, cell.extra, cell.status].filter(Boolean).join(' · ')
}

export function isFraudLevel(value?: string): value is FraudLevel {
  return value === 'SAFE' || value === 'LOW' || value === 'MEDIUM' || value === 'HIGH' || value === 'BLOCKED'
}
