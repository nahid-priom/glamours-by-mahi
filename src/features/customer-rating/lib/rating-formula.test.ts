import { describe, expect, it } from 'vitest'
import {
  clampRating,
  computeWeightedRating,
  normalizeLogRatio,
  ratingFactorFromRatio,
  ratingStatusFromOrders,
  splitCustomerBalance,
} from './rating-formula'

describe('splitCustomerBalance', () => {
  it('maps positive net to due only', () => {
    expect(splitCustomerBalance(1500)).toEqual({
      due: 1500,
      advance: 0,
      financialStatus: 'due',
    })
  })

  it('maps negative net to advance only', () => {
    expect(splitCustomerBalance(-800)).toEqual({
      due: 0,
      advance: 800,
      financialStatus: 'advance',
    })
  })

  it('maps zero to settled', () => {
    expect(splitCustomerBalance(0)).toEqual({
      due: 0,
      advance: 0,
      financialStatus: 'settled',
    })
  })

  it('never shows due and advance together', () => {
    const a = splitCustomerBalance(100)
    const b = splitCustomerBalance(-50)
    expect(a.due > 0 && a.advance > 0).toBe(false)
    expect(b.due > 0 && b.advance > 0).toBe(false)
  })
})

/**
 * Documents approve_sales_return money path (00085):
 * always post full return_credit, then refund debit for cash excess.
 * Net after both = settled when cash matches excess over open due.
 */
describe('return_credit + refund debit nets (Phase A)', () => {
  it('return ≤ open due: credit only reduces due', () => {
    const dueBefore = 1000
    const returnTotal = 400
    expect(splitCustomerBalance(dueBefore - returnTotal)).toEqual({
      due: 600,
      advance: 0,
      financialStatus: 'due',
    })
  })

  it('return on fully paid sale + cash refund: settles (no phantom advance)', () => {
    const paidSaleNet = 0
    const returnTotal = 500
    const afterCredit = splitCustomerBalance(paidSaleNet - returnTotal)
    expect(afterCredit).toEqual({
      due: 0,
      advance: 500,
      financialStatus: 'advance',
    })
    const cashRefund = returnTotal // entire return is cash
    expect(splitCustomerBalance(paidSaleNet - returnTotal + cashRefund)).toEqual({
      due: 0,
      advance: 0,
      financialStatus: 'settled',
    })
  })

  it('partial due + excess return: due cleared; refund clears advance', () => {
    const dueBefore = 300
    const returnTotal = 500
    const cashRefund = Math.max(returnTotal - dueBefore, 0) // 200
    expect(cashRefund).toBe(200)
    expect(splitCustomerBalance(dueBefore - returnTotal)).toEqual({
      due: 0,
      advance: 200,
      financialStatus: 'advance',
    })
    expect(splitCustomerBalance(dueBefore - returnTotal + cashRefund)).toEqual({
      due: 0,
      advance: 0,
      financialStatus: 'settled',
    })
  })
})

describe('ratingStatusFromOrders', () => {
  it('unrated with zero orders', () => {
    expect(ratingStatusFromOrders(0)).toBe('unrated')
  })
  it('provisional with one order', () => {
    expect(ratingStatusFromOrders(1)).toBe('provisional')
  })
  it('rated with two or more', () => {
    expect(ratingStatusFromOrders(2)).toBe('rated')
    expect(ratingStatusFromOrders(10)).toBe('rated')
  })
})

describe('clampRating', () => {
  it('bounds to 1..5', () => {
    expect(clampRating(0)).toBe(1)
    expect(clampRating(9)).toBe(5)
    expect(clampRating(3.26)).toBe(3.3)
  })
  it('handles NaN', () => {
    expect(clampRating(Number.NaN)).toBe(3)
  })
})

describe('normalizeLogRatio / single large order', () => {
  it('does not max out from one large sale vs high org baseline', () => {
    const oneSale = normalizeLogRatio(50_000, 40_000)
    expect(oneSale).toBeLessThan(1)
    expect(ratingFactorFromRatio(oneSale)).toBeLessThan(5)
  })

  it('rewards frequent activity', () => {
    const rare = normalizeLogRatio(0.2, 1)
    const frequent = normalizeLogRatio(4, 1)
    expect(frequent).toBeGreaterThan(rare)
  })
})

describe('computeWeightedRating', () => {
  it('uses documented weights and stays in range', () => {
    const score = computeWeightedRating({
      frequency: 5,
      amount: 5,
      orders: 5,
      returnRatio: 5,
      payment: 5,
    })
    expect(score).toBe(5)

    const poorReturns = computeWeightedRating({
      frequency: 4,
      amount: 4,
      orders: 4,
      returnRatio: 1,
      payment: 4,
    })
    expect(poorReturns).toBeLessThan(4)
    expect(poorReturns).toBeGreaterThanOrEqual(1)
  })

  it('penalizes overdue payment behaviour', () => {
    const good = computeWeightedRating({
      frequency: 3,
      amount: 3,
      orders: 3,
      returnRatio: 4,
      payment: 5,
    })
    const overdue = computeWeightedRating({
      frequency: 3,
      amount: 3,
      orders: 3,
      returnRatio: 4,
      payment: 1,
    })
    expect(overdue).toBeLessThan(good)
  })
})
