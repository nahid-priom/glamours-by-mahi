import { describe, expect, it } from 'vitest'
import { summarizePeriodCashFlow } from './cash-flow-metrics'
import type { SimpleTransaction } from '../repositories/simple-accounting.repository'

function makeTxn(
  i: number,
  partial: Partial<SimpleTransaction> & Pick<SimpleTransaction, 'direction' | 'amount'>,
): SimpleTransaction {
  return {
    id: `t-${i}`,
    date: '2026-03-15',
    description: `row-${i}`,
    accountId: 'a',
    accountName: 'Cash',
    voided: false,
    ...partial,
  }
}

describe('period cash flow completeness (>200 rows)', () => {
  it('aggregates all 201 external movements (not first 200 only)', () => {
    const rows: SimpleTransaction[] = []
    for (let i = 0; i < 201; i++) {
      rows.push(makeTxn(i, { direction: 'in', amount: 1, category: 'sale_payment' }))
    }
    // If someone sliced to 200, sum would be 200 — full set must be 201.
    const truncated = summarizePeriodCashFlow(rows.slice(0, 200))
    const full = summarizePeriodCashFlow(rows)
    expect(truncated.moneyIn).toBe(200)
    expect(full.moneyIn).toBe(201)
    expect(full.netCashFlow).toBe(201)
  })

  it('handles 1000 mixed rows with transfers excluded from money in/out', () => {
    const rows: SimpleTransaction[] = []
    for (let i = 0; i < 1000; i++) {
      if (i % 10 === 0) {
        rows.push(makeTxn(i, { direction: 'out', amount: 5, category: 'transfer' }))
        continue
      }
      rows.push(
        makeTxn(i, {
          direction: i % 2 === 0 ? 'in' : 'out',
          amount: 2,
          category: i % 2 === 0 ? 'cash_deposit' : 'expense',
        }),
      )
    }
    const flow = summarizePeriodCashFlow(rows)
    const transferRows = rows.filter((r) => (r.category ?? '').includes('transfer'))
    const externalRows = rows.filter((r) => !(r.category ?? '').includes('transfer'))
    expect(flow.transferVolume).toBe(transferRows.length * 5)
    expect(transferRows.length + externalRows.length).toBe(1000)
    expect(flow.moneyIn + flow.moneyOut).toBe(externalRows.length * 2)
    expect(flow.netCashFlow).toBe(flow.moneyIn - flow.moneyOut)
  })

  it('zero transactions → zero KPIs', () => {
    expect(summarizePeriodCashFlow([])).toEqual({
      moneyIn: 0,
      moneyOut: 0,
      transferVolume: 0,
      netCashFlow: 0,
    })
  })
})
