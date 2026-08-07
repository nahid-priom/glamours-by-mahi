import type { ExchangeCatalogueVariant } from './repositories/exchanges.repository'

export type ExchangeStep = 1 | 2 | 3 | 4

export type ReturnLine = {
  saleItemId: string
  variantId: string
  label: string
  maxQty: number
  qty: number
  unitPrice: number
  condition: string
}

export type ReplacementLine = {
  key: string
  variantId: string
  label: string
  productName: string
  variantLabel: string
  thumbnailUrl: string | null
  qty: number
  unitPrice: number
}

export const EXCHANGE_CONDITIONS = [
  { value: 'sellable', label: 'Sellable' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'defective', label: 'Defective' },
  { value: 'quarantine', label: 'Quarantine' },
] as const

export const EXCHANGE_STEP_LABELS: Record<ExchangeStep, string> = {
  1: 'Invoice',
  2: 'Returns',
  3: 'Replacements',
  4: 'Confirm',
}

export type { ExchangeCatalogueVariant }
