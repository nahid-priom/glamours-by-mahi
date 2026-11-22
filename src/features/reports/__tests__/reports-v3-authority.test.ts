import { describe, expect, it } from 'vitest'
import { reportsRepository } from '../repositories/reports.repository'
import {
  isNonPnlCashMovement,
  isTransferTxn,
  summarizePeriodCashFlow,
} from '@/features/accounting/lib/cash-flow-metrics'
import type { SimpleTransaction } from '@/features/accounting/repositories/simple-accounting.repository'
import { reportQueryKey } from '../reports.filters'

/** Illustrative P&L fixture from Reports V3 plan (Test A). */
function canonicalNetProfit(input: {
  grossSales: number
  returns: number
  cogs: number
  otherIncome: number
  expenses: number
}) {
  const netSales = input.grossSales - input.returns
  const grossProfit = netSales - input.cogs
  return {
    netSales,
    grossProfit,
    netProfit: grossProfit + input.otherIncome - input.expenses,
  }
}

function txn(
  partial: Partial<SimpleTransaction> & Pick<SimpleTransaction, 'amount' | 'direction'>,
): SimpleTransaction {
  return {
    id: partial.id ?? 't1',
    date: partial.date ?? '2026-01-01',
    description: partial.description ?? 'test',
    accountId: partial.accountId ?? 'a1',
    accountName: partial.accountName ?? 'Cash',
    direction: partial.direction,
    amount: partial.amount,
    category: partial.category ?? null,
    sourceType: partial.sourceType ?? null,
    balanceAfter: partial.balanceAfter ?? null,
    voided: partial.voided ?? false,
  }
}

describe('Reports V3 — P&L authority (Test A)', () => {
  it('does not expose a duplicate profitReport calculator on reportsRepository', () => {
    expect(reportsRepository).not.toHaveProperty('profitReport')
    expect(typeof reportsRepository.salesReport).toBe('function')
  })

  it('matches the canonical net profit fixture used by get_profit_loss_report semantics', () => {
    const r = canonicalNetProfit({
      grossSales: 1000,
      returns: 200,
      cogs: 480,
      otherIncome: 30,
      expenses: 100,
    })
    expect(r.netSales).toBe(800)
    expect(r.grossProfit).toBe(320)
    expect(r.netProfit).toBe(250)
  })

  it('uses stable report query keys', () => {
    expect(reportQueryKey('sales', { from: '2026-01-01', to: '2026-01-31' })).toEqual([
      'reports',
      'sales',
      '2026-01-01',
      '2026-01-31',
      null,
      1,
      null,
    ])
  })
})

describe('Reports V3 — cash vs P&L (Tests B/D)', () => {
  it('collections are cash in, not sales revenue (classification only)', () => {
    const collection = txn({
      direction: 'in',
      amount: 100,
      category: 'customer_collection',
      sourceType: 'collect_customer_due',
    })
    expect(isTransferTxn(collection)).toBe(false)
    expect(isNonPnlCashMovement(collection)).toBe(false)
    const flow = summarizePeriodCashFlow([collection])
    expect(flow.moneyIn).toBe(100)
    // Revenue recognition is on sales docs / P&L RPC — not inferred here.
  })

  it('internal transfers do not inflate money in/out', () => {
    const transfer = txn({
      direction: 'out',
      amount: 500,
      category: 'transfer',
      sourceType: 'account_transfer',
    })
    const flow = summarizePeriodCashFlow([transfer])
    expect(flow.moneyIn).toBe(0)
    expect(flow.moneyOut).toBe(0)
    expect(flow.transferVolume).toBe(500)
  })

  it('deposits/withdrawals are non-P&L cash movements', () => {
    expect(
      isNonPnlCashMovement(
        txn({ direction: 'in', amount: 50, category: 'cash_deposit', sourceType: 'deposit' }),
      ),
    ).toBe(true)
  })
})

describe('Reports V3 — courier return isolation (Test H)', () => {
  it('courier return request rows are not a financial mutation API', () => {
    // Repository only reads courier_return_requests — no post helpers exported.
    expect(reportsRepository).not.toHaveProperty('postCourierReturn')
    expect(typeof reportsRepository.courierReturnsReport).toBe('function')
  })
})
