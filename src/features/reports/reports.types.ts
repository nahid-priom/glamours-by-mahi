import type { FraudLevel, OrderStatus } from '@/lib/constants'

export type ReportType =
  | 'orders'
  | 'courier'
  | 'store'
  | 'collection'
  | 'fraud'
  | 'product_stock'
  | 'invoice'

export interface ReportFilters {
  date_from?: string
  date_to?: string
  store?: string
  courier?: string
  status?: OrderStatus | 'all'
  fraud_level?: FraudLevel | 'all'
}

export interface ReportSummary {
  label: string
  value: string | number
  color?: string
}

export interface ReportCellData {
  title?: string
  subtitle?: string
  extra?: string
  status?: string
  tooltip?: string
}

export interface ReportRow {
  [key: string]: ReportCellData
}

export interface ReportResult {
  type: ReportType
  title: string
  summary: ReportSummary[]
  columns: { key: string; label: string }[]
  rows: ReportRow[]
}
