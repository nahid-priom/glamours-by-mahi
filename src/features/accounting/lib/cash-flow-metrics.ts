/**
 * Pure cash-flow classification for Accounts 2.0 KPIs.
 * Transfer legs excluded from money in/out; deposits/withdrawals count as cash moves (not P&L).
 */
import type { SimpleTransaction } from '../repositories/simple-accounting.repository'

const TRANSFER_TYPES = new Set(['transfer', 'account_transfer'])
const NON_PNL_CASH_TYPES = new Set(['cash_deposit', 'cash_withdrawal'])

export function isTransferTxn(t: SimpleTransaction): boolean {
  const blob = `${t.category ?? ''} ${t.sourceType ?? ''}`.toLowerCase()
  return TRANSFER_TYPES.has(blob) || blob.includes('transfer')
}

export function isNonPnlCashMovement(t: SimpleTransaction): boolean {
  const blob = `${t.category ?? ''} ${t.sourceType ?? ''}`.toLowerCase()
  return (
    NON_PNL_CASH_TYPES.has(blob) ||
    blob.includes('cash_deposit') ||
    blob.includes('cash_withdrawal')
  )
}

export function summarizePeriodCashFlow(txns: SimpleTransaction[]) {
  let moneyIn = 0
  let moneyOut = 0
  let transferVolume = 0
  for (const t of txns) {
    if (t.voided) continue
    if (isTransferTxn(t)) {
      transferVolume += t.amount
      continue
    }
    if (t.direction === 'in') moneyIn += t.amount
    else moneyOut += t.amount
  }
  return {
    moneyIn,
    moneyOut,
    transferVolume,
    netCashFlow: moneyIn - moneyOut,
  }
}
