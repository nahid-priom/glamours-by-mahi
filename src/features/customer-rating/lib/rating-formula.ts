/** Pure helpers mirroring Phase A due/advance and rating rules (for unit tests). */

export type FinancialStatus = 'due' | 'advance' | 'settled'

/** Ledger net: debit − credit. Positive = due, negative = advance. */
export function splitCustomerBalance(net: number): {
  due: number
  advance: number
  financialStatus: FinancialStatus
} {
  const n = Number.isFinite(net) ? net : 0
  const due = Math.max(0, n)
  const advance = Math.max(0, -n)
  return {
    due,
    advance,
    financialStatus: due > 0 ? 'due' : advance > 0 ? 'advance' : 'settled',
  }
}

export function clampRating(value: number): number {
  if (!Number.isFinite(value)) return 3
  return Math.round(Math.max(1, Math.min(5, value)) * 10) / 10
}

export function ratingFactorFromRatio(ratio: number): number {
  const r = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
  return clampRating(1 + 4 * r)
}

export type RatingStatus = 'unrated' | 'provisional' | 'rated'

export function ratingStatusFromOrders(completedOrders: number): RatingStatus {
  if (completedOrders <= 0) return 'unrated'
  if (completedOrders === 1) return 'provisional'
  return 'rated'
}

/**
 * Weighted formula (same weights as refresh_customer_rating):
 * frequency 20% · amount 25% · orders 20% · return 15% · payment 20%
 */
export function computeWeightedRating(factors: {
  frequency: number
  amount: number
  orders: number
  returnRatio: number
  payment: number
}): number {
  return clampRating(
    factors.frequency * 0.2 +
      factors.amount * 0.25 +
      factors.orders * 0.2 +
      factors.returnRatio * 0.15 +
      factors.payment * 0.2,
  )
}

export function normalizeLogRatio(value: number, orgBaseline: number): number {
  const denom = Math.log(1 + Math.max(orgBaseline * 2, 1))
  if (!Number.isFinite(denom) || denom === 0) return 0
  return Math.min(1, Math.max(0, Math.log(1 + Math.max(0, value)) / denom))
}
