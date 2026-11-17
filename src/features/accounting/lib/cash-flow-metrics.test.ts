import { describe, expect, it } from 'vitest'
import {
  isNonPnlCashMovement,
  isTransferTxn,
  summarizePeriodCashFlow,
} from './cash-flow-metrics'
import type { SimpleTransaction } from '../repositories/simple-accounting.repository'

function txn(
  partial: Partial<SimpleTransaction> & Pick<SimpleTransaction, 'direction' | 'amount'>,
): SimpleTransaction {
  return {
    id: partial.id ?? '1',
    date: '2026-03-15',
    description: '',
    accountId: null,
    accountName: null,
    voided: false,
    ...partial,
  }
}

describe('cash-flow-metrics', () => {
  it('excludes transfer legs from money in/out but counts transfer volume', () => {
    const flow = summarizePeriodCashFlow([
      txn({ direction: 'out', amount: 100, category: 'transfer', sourceType: 'account_transfer' }),
      txn({ direction: 'in', amount: 100, category: 'transfer', sourceType: 'account_transfer' }),
      txn({ direction: 'in', amount: 50, category: 'sale_payment' }),
      txn({ direction: 'out', amount: 20, category: 'expense' }),
    ])
    expect(flow.moneyIn).toBe(50)
    expect(flow.moneyOut).toBe(20)
    expect(flow.transferVolume).toBe(200)
    expect(flow.netCashFlow).toBe(30)
  })

  it('counts cash deposit/withdraw as cash movement (not transfer)', () => {
    const deposit = txn({
      direction: 'in',
      amount: 200,
      category: 'cash_deposit',
      sourceType: 'cash_deposit',
    })
    const withdraw = txn({
      direction: 'out',
      amount: 75,
      category: 'cash_withdrawal',
      sourceType: 'cash_withdrawal',
    })
    expect(isNonPnlCashMovement(deposit)).toBe(true)
    expect(isNonPnlCashMovement(withdraw)).toBe(true)
    expect(isTransferTxn(deposit)).toBe(false)
    const flow = summarizePeriodCashFlow([deposit, withdraw])
    expect(flow.moneyIn).toBe(200)
    expect(flow.moneyOut).toBe(75)
    expect(flow.netCashFlow).toBe(125)
  })

  it('skips voided rows', () => {
    const flow = summarizePeriodCashFlow([
      txn({ direction: 'in', amount: 10, voided: true }),
      txn({ direction: 'in', amount: 5 }),
    ])
    expect(flow.moneyIn).toBe(5)
  })
})
