import type { FraudLevel } from '@/lib/constants'
import type { ReportCellData } from './reports.types'

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
  return (
    value === 'SAFE' ||
    value === 'LOW' ||
    value === 'MEDIUM' ||
    value === 'HIGH' ||
    value === 'BLOCKED'
  )
}
