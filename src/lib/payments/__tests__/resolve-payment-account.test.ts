import { describe, expect, it } from 'vitest'
import type { FinancialAccountRow } from '@/features/accounting/repositories/simple-accounting.repository'
import {
  isAccountEligibleForMethod,
  methodCodeToAccountKind,
  methodFromAccountKind,
  missingPaymentAccountMessage,
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

describe('missingPaymentAccountMessage', () => {
  it('is kind-specific', () => {
    expect(missingPaymentAccountMessage('bkash')).toContain('Mobile Money')
    expect(missingPaymentAccountMessage('cash')).toContain('Cash')
    expect(missingPaymentAccountMessage('bank')).toContain('Bank')
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

  it('prefers branch-scoped kind match over org-wide when neither is default', () => {
    const accounts = [
      fa({ id: 'fa-org-cash', name: 'Org Cash', account_kind: 'cash', branch_id: null }),
      fa({ id: 'fa-br-cash', name: 'Branch Cash', account_kind: 'cash', branch_id: 'br-1' }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'cash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved?.account.id).toBe('fa-br-cash')
    expect(resolved?.source).toBe('kind_first')
  })

  it('returns null when only wrong-kind accounts exist', () => {
    const accounts = [
      fa({ id: 'fa-cash', name: 'Cash', account_kind: 'cash', branch_id: 'br-1', is_default: true }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'bkash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved).toBeNull()
  })

  it('returns null for cash method when only bank accounts exist', () => {
    const accounts = [
      fa({ id: 'fa-bank', name: 'Bank', account_kind: 'bank', branch_id: 'br-1', is_default: true }),
    ]
    expect(
      resolvePaymentAccount({
        methodCode: 'cash',
        branchId: 'br-1',
        methods: [{ code: 'cash' }],
        accounts,
        settings: {
          defaultCashAccountId: null,
          defaultBankAccountId: 'fa-bank',
          defaultPurchasePaymentAccountId: 'fa-bank',
        },
      }),
    ).toBeNull()
  })

  it('rejects method_link when linked FA kind mismatches', () => {
    const accounts = [
      fa({ id: 'fa-hq-bkash', name: 'bKash', account_kind: 'other', branch_id: null }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'bkash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved).toBeNull()
  })

  it('resolves kind-matching linked FA via kind path (not wrong-kind fallback)', () => {
    const accounts = [
      fa({
        id: 'fa-hq-bkash',
        name: 'bKash',
        account_kind: 'mobile_money',
        branch_id: null,
      }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'bkash',
      branchId: 'br-1',
      methods,
      accounts,
    })
    expect(resolved?.account.id).toBe('fa-hq-bkash')
    expect(resolved?.source).toBe('kind_first')
  })

  it('does not use bank settings default for mobile method', () => {
    const accounts = [
      fa({ id: 'fa-bank', name: 'Bank', account_kind: 'bank', branch_id: 'br-1', is_default: true }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'bkash',
      branchId: 'br-1',
      methods: [{ code: 'bkash', financial_account_id: null }],
      accounts,
      settings: {
        defaultCashAccountId: null,
        defaultBankAccountId: 'fa-bank',
        defaultPurchasePaymentAccountId: 'fa-bank',
      },
    })
    expect(resolved).toBeNull()
  })

  it('rejects inactive accounts', () => {
    const accounts = [
      fa({
        id: 'fa-cash',
        name: 'Cash',
        account_kind: 'cash',
        branch_id: 'br-1',
        is_active: false,
      }),
    ]
    expect(
      resolvePaymentAccount({
        methodCode: 'cash',
        branchId: 'br-1',
        methods,
        accounts,
      }),
    ).toBeNull()
  })

  it('rejects other-branch accounts when branch-scoped', () => {
    const accounts = [
      fa({
        id: 'fa-other',
        name: 'Other branch cash',
        account_kind: 'cash',
        branch_id: 'br-2',
      }),
    ]
    expect(
      resolvePaymentAccount({
        methodCode: 'cash',
        branchId: 'br-1',
        methods,
        accounts,
      }),
    ).toBeNull()
  })

  it('never picks bank settings when cash accounts exist via kind path', () => {
    const accounts = [
      fa({ id: 'fa-cash', name: 'Cash', account_kind: 'cash', branch_id: null }),
      fa({ id: 'fa-bank', name: 'Bank', account_kind: 'bank', branch_id: null, is_default: true }),
    ]
    const resolved = resolvePaymentAccount({
      methodCode: 'cash',
      branchId: 'br-1',
      methods: [{ code: 'cash' }],
      accounts,
      settings: {
        defaultCashAccountId: null,
        defaultBankAccountId: 'fa-bank',
        defaultPurchasePaymentAccountId: 'fa-bank',
      },
    })
    expect(resolved?.account.id).toBe('fa-cash')
    expect(resolved?.account.account_kind).toBe('cash')
  })
})

describe('isAccountEligibleForMethod', () => {
  it('returns false for wrong kind or inactive', () => {
    const accounts = [
      fa({ id: 'fa-bank', name: 'Bank', account_kind: 'bank', branch_id: 'br-1' }),
      fa({
        id: 'fa-cash-off',
        name: 'Cash',
        account_kind: 'cash',
        branch_id: 'br-1',
        is_active: false,
      }),
    ]
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-bank',
        methodCode: 'cash',
        branchId: 'br-1',
        accounts,
      }),
    ).toBe(false)
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-cash-off',
        methodCode: 'cash',
        branchId: 'br-1',
        accounts,
      }),
    ).toBe(false)
  })

  it('returns true for matching active branch account', () => {
    const accounts = [
      fa({ id: 'fa-cash', name: 'Cash', account_kind: 'cash', branch_id: 'br-1' }),
    ]
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-cash',
        methodCode: 'cash',
        branchId: 'br-1',
        accounts,
      }),
    ).toBe(true)
  })

  it('clears eligibility when method or branch changes', () => {
    const accounts = [
      fa({ id: 'fa-cash', name: 'Cash', account_kind: 'cash', branch_id: 'br-1' }),
      fa({ id: 'fa-br2-cash', name: 'B2 Cash', account_kind: 'cash', branch_id: 'br-2' }),
    ]
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-cash',
        methodCode: 'bkash',
        branchId: 'br-1',
        accounts,
      }),
    ).toBe(false)
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-cash',
        methodCode: 'cash',
        branchId: 'br-2',
        accounts,
      }),
    ).toBe(false)
    expect(
      isAccountEligibleForMethod({
        accountId: 'fa-br2-cash',
        methodCode: 'cash',
        branchId: 'br-2',
        accounts,
      }),
    ).toBe(true)
  })
})

describe('methodFromAccountKind', () => {
  it('maps POS account-first kinds', () => {
    expect(methodFromAccountKind('cash')).toBe('cash')
    expect(methodFromAccountKind('bank')).toBe('bank')
    expect(methodFromAccountKind('mobile_money')).toBe('bkash')
  })
})
