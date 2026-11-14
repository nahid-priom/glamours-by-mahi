import { describe, expect, it } from 'vitest'
import type { FinancialAccountRow } from '@/features/accounting/repositories/simple-accounting.repository'
import {
  methodCodeToAccountKind,
  resolvePaymentAccount,
} from '../resolve-payment-account'

function fa(
  partial: Partial<FinancialAccountRow> & Pick<FinancialAccountRow, 'id' | 'name' | 'account_kind'>,
): FinancialAccountRow {
  return {
    branch_id: null,
    opening_balance: 0,
    current_balance: 0,
    is_default: false,
    is_active: true,
    chart_account_id: null,
    ...partial,
  }
}

describe('methodCodeToAccountKind', () => {
  it('maps common codes', () => {
    expect(methodCodeToAccountKind('cash')).toBe('cash')
    expect(methodCodeToAccountKind('bank_transfer')).toBe('bank')
    expect(methodCodeToAccountKind('bkash')).toBe('mobile_money')
  })
})

describe('resolvePaymentAccount', () => {
  const methods = [
    { code: 'cash', financial_account_id: 'fa-hq-cash' },
    { code: 'bkash', financial_account_id: 'fa-hq-bkash' },
  ]

  it('prefers branch default of matching kind', () => {
    const accounts = [
      fa({ id: 'fa-hq-cash', name: 'HQ Cash', account_kind: 'cash', branch_id: null }),
      fa({
        id: 'fa-br-cash',
        name: 'Branch Cash',
        account_kind: 'cash',
        branch_id: 'br-1',
        is_default: true,
      }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'cash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved?.account.id).toBe('fa-br-cash')
    expect(resolved?.source).toBe('kind_default')
  })

  it('falls back to method link when no kind match', () => {
    const accounts = [
      fa({ id: 'fa-hq-bkash', name: 'bKash', account_kind: 'other', branch_id: null }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'bkash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved?.account.id).toBe('fa-hq-bkash')
    expect(resolved?.source).toBe('method_link')
  })
})
