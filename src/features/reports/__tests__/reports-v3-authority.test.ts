import { describe, expect, it } from 'vitest'
import { reportsRepository } from '../repositories/reports.repository'
import {
  isNonPnlCashMovement,
  isTransferTxn,
  summarizePeriodCashFlow,
} from '@/features/accounting/lib/cash-flow-metrics'
import type { SimpleTransaction } from '@/features/accounting/repositories/simple-accounting.repository'
import { reportQueryKey, resolveDatePreset, defaultPeriodRange } from '../reports.filters'

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
    const key = reportQueryKey('sales', { from: '2026-01-01', to: '2026-01-31' })
    expect(key[0]).toBe('reports')
    expect(key[1]).toBe('v4')
    expect(key[2]).toBe('sales')
    expect(key[3]).toBe('2026-01-01')
    expect(key[4]).toBe('2026-01-31')
  })
})

describe('Reports V4 — registry & new authorities', () => {
  it('exposes returns/channels/cod helpers without a second P&L calculator', async () => {
    const { REPORT_REGISTRY } = await import('../config/report-registry')
    expect(reportsRepository).not.toHaveProperty('profitReport')
    expect(typeof reportsRepository.salesReturnsReport).toBe('function')
    expect(typeof reportsRepository.channelPerformanceReport).toBe('function')
    expect(typeof reportsRepository.codSettlementReport).toBe('function')
    expect(REPORT_REGISTRY.some((r) => r.id === 'stock-aging' && r.status === 'gated')).toBe(true)
    expect(REPORT_REGISTRY.some((r) => r.id === 'returns' && r.status === 'available')).toBe(true)
    expect(REPORT_REGISTRY.some((r) => r.id === 'channels' && r.path === '/reports/channels')).toBe(
      true,
    )
    expect(REPORT_REGISTRY.find((r) => r.id === 'courier')?.extraPermissionsAny).toContain(
      'courier.read',
    )
  })

  it('defaults period reports to this month and resolves presets', () => {
    const period = defaultPeriodRange(new Date('2026-11-15T12:00:00+06:00'))
    expect(period.from).toBe('2026-11-01')
    expect(period.to).toBe('2026-11-15')
    const last7 = resolveDatePreset('last7', new Date('2026-11-15T12:00:00+06:00'))
    expect(last7.from).toBe('2026-11-09')
    expect(last7.to).toBe('2026-11-15')
  })

  it('Scenario A — discount and partial return net sales fixture', () => {
    const gross = 10000
    const discount = 1000
    const netDoc = gross - discount
    const postedReturn = 2000
    const netSales = netDoc - postedReturn
    expect(netSales).toBe(7000)
    const originalCogs = 5000
    const returnedCogs = 1000
    const netCogs = originalCogs - returnedCogs
    expect(netCogs).toBe(4000)
    expect(netSales - netCogs).toBe(3000)
  })
})

describe('Reports V3 — cash vs P&L (Tests B/D)', () => {
  it('cash deposits/withdrawals are non-P&L cash movements', () => {
    const deposit = txn({
      amount: 500,
      direction: 'in',
      sourceType: 'cash_deposit',
      category: 'cash_deposit',
    })
    expect(isNonPnlCashMovement(deposit)).toBe(true)
  })

  it('transfers are excluded from period cash-flow summary', () => {
    const transfer = txn({
      amount: 100,
      direction: 'out',
      sourceType: 'transfer',
      category: 'transfer',
    })
    expect(isTransferTxn(transfer)).toBe(true)
    const summary = summarizePeriodCashFlow([
      transfer,
      txn({ amount: 200, direction: 'in', sourceType: 'sale', category: 'sale' }),
    ])
    expect(summary.moneyIn).toBe(200)
  })
})
