import type { ReportFilters, ReportResult, ReportType } from './reports.types'
import { reportsService } from './reports.service'
import { MOCK_COURIERS, MOCK_STORES } from '@/lib/mock-data'
import { brandConfig } from '@/config/brand'

export type ReportTypeSlug =
  | 'order'
  | 'courier'
  | 'store'
  | 'collection'
  | 'fraud'
  | 'product-stock'
  | 'invoice'

const SLUG_TO_TYPE: Record<ReportTypeSlug, ReportType> = {
  order: 'orders',
  courier: 'courier',
  store: 'store',
  collection: 'collection',
  fraud: 'fraud',
  'product-stock': 'product_stock',
  invoice: 'invoice',
}

const TYPE_TO_SLUG: Record<ReportType, ReportTypeSlug> = {
  orders: 'order',
  courier: 'courier',
  store: 'store',
  collection: 'collection',
  fraud: 'fraud',
  product_stock: 'product-stock',
  invoice: 'invoice',
}

export interface ReportPrintMeta {
  generatedAt: string
  periodLabel: string
  filterLabels: string[]
  companyName: string
  poweredBy: string
}

export interface ReportPrintDocument extends ReportResult {
  meta: ReportPrintMeta
}

export function slugToReportType(slug: string): ReportType | null {
  return SLUG_TO_TYPE[slug as ReportTypeSlug] ?? null
}

export function reportTypeToSlug(type: ReportType): ReportTypeSlug {
  return TYPE_TO_SLUG[type]
}

export function parseFiltersFromSearchParams(params: URLSearchParams): ReportFilters {
  const filters: ReportFilters = {}
  const dateFrom = params.get('dateFrom') || params.get('date_from')
  const dateTo = params.get('dateTo') || params.get('date_to')
  const store = params.get('store')
  const courier = params.get('courier')
  const status = params.get('status')
  const risk = params.get('risk') || params.get('fraud_level')

  if (dateFrom) filters.date_from = dateFrom
  if (dateTo) filters.date_to = dateTo
  if (store && store !== 'all') filters.store = store
  if (courier && courier !== 'all') filters.courier = courier
  if (status && status !== 'all') filters.status = status as ReportFilters['status']
  if (risk && risk !== 'all') filters.fraud_level = risk as ReportFilters['fraud_level']

  return filters
}

export function buildReportPrintQuery(filters: ReportFilters): string {
  const params = new URLSearchParams()
  if (filters.date_from) params.set('dateFrom', filters.date_from)
  if (filters.date_to) params.set('dateTo', filters.date_to)
  if (filters.store && filters.store !== 'all') params.set('store', filters.store)
  if (filters.courier && filters.courier !== 'all') params.set('courier', filters.courier)
  if (filters.status && filters.status !== 'all') params.set('status', filters.status)
  if (filters.fraud_level && filters.fraud_level !== 'all') params.set('risk', filters.fraud_level)
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export function buildReportPrintUrl(type: ReportType, filters: ReportFilters): string {
  const slug = reportTypeToSlug(type)
  return `/print/reports/${slug}${buildReportPrintQuery(filters)}`
}

function formatPeriod(filters: ReportFilters): string {
  if (filters.date_from && filters.date_to) {
    return `${formatDate(filters.date_from)} — ${formatDate(filters.date_to)}`
  }
  if (filters.date_from) return `From ${formatDate(filters.date_from)}`
  if (filters.date_to) return `Until ${formatDate(filters.date_to)}`
  return 'All dates'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-BD', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function resolveFilterLabels(filters: ReportFilters): Promise<string[]> {
  const labels: string[] = []

  if (filters.store && filters.store !== 'all') {
    try {
      const { storesService } = await import('@/features/stores/stores.service')
      const store = await storesService.getById(filters.store)
      labels.push(`Store: ${store?.name ?? filters.store}`)
    } catch {
      const mock = MOCK_STORES.find((s) => s.id === filters.store)
      labels.push(`Store: ${mock?.name ?? filters.store}`)
    }
  }

  if (filters.courier && filters.courier !== 'all') {
    const courier = MOCK_COURIERS.find((c) => c.id === filters.courier)
    labels.push(`Courier: ${courier?.name ?? filters.courier}`)
  }

  if (filters.status && filters.status !== 'all') {
    labels.push(`Status: ${filters.status}`)
  }

  if (filters.fraud_level && filters.fraud_level !== 'all') {
    labels.push(`Risk: ${filters.fraud_level}`)
  }

  return labels
}

export const reportPrintService = {
  slugToReportType,
  reportTypeToSlug,
  parseFiltersFromSearchParams,
  buildReportPrintUrl,

  async loadReportDocument(
    slug: string,
    filters: ReportFilters,
  ): Promise<ReportPrintDocument | null> {
    const type = slugToReportType(slug)
    if (!type) return null

    const [report, filterLabels] = await Promise.all([
      reportsService.generateReport(type, filters),
      resolveFilterLabels(filters),
    ])

    return {
      ...report,
      meta: {
        generatedAt: new Date().toLocaleString('en-BD', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
        periodLabel: formatPeriod(filters),
        filterLabels,
        companyName: brandConfig.name,
        poweredBy: brandConfig.poweredBy,
      },
    }
  },
}
