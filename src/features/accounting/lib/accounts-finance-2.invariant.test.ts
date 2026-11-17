import { describe, expect, it } from 'vitest'
import { summarizePeriodCashFlow } from './cash-flow-metrics'
import type { SimpleTransaction } from '../repositories/simple-accounting.repository'

/**
 * Invariant documentation tests for Accounts & Finance 2.0.
 * SQL smoke for POS FA apply_balance / void restore lives in migration 00146 comments
 * and must be run against a non-prod database with explicit approval.
 */

function t(
  partial: Partial<SimpleTransaction> & Pick<SimpleTransaction, 'direction' | 'amount'>,
): SimpleTransaction {
  return {
    id: crypto.randomUUID(),
    date: '2026-03-15',
    description: '',
    accountId: 'a',
    accountName: 'Cash',
    voided: false,
    ...partial,
  }
}

describe('Accounts 2.0 invariants', () => {
  it('transfer pair nets to zero in money in/out while volume is sum of legs', () => {
    const flow = summarizePeriodCashFlow([
      t({ direction: 'out', amount: 500, category: 'transfer' }),
      t({ direction: 'in', amount: 500, category: 'transfer' }),
    ])
    expect(flow.moneyIn).toBe(0)
    expect(flow.moneyOut).toBe(0)
    expect(flow.netCashFlow).toBe(0)
    expect(flow.transferVolume).toBe(1000)
  })

  it('collect/pay style movements are cash flow, not classified as transfer', () => {
    const flow = summarizePeriodCashFlow([
      t({ direction: 'in', amount: 100, category: 'customer_collection', sourceType: 'customer_due' }),
      t({ direction: 'out', amount: 40, category: 'supplier_payment', sourceType: 'supplier_due' }),
    ])
    expect(flow.moneyIn).toBe(100)
    expect(flow.moneyOut).toBe(40)
  })

  it('deposit and withdraw affect cash flow KPIs (P&L exclusion is income/expense tables)', () => {
    const flow = summarizePeriodCashFlow([
      t({ direction: 'in', amount: 1000, sourceType: 'cash_deposit' }),
      t({ direction: 'out', amount: 250, sourceType: 'cash_withdrawal' }),
    ])
    expect(flow.netCashFlow).toBe(750)
  })
})
