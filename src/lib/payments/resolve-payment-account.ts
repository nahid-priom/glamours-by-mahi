import type { AccountKind, AccountSettings, FinancialAccountRow } from '@/features/accounting/repositories/simple-accounting.repository'

export type PaymentMethodLike = {
  code: string
  name?: string
  financial_account_id?: string | null
  is_due?: boolean | null
}

export type ResolvePaymentAccountInput = {
  methodCode: string
  branchId?: string | null
  methods: PaymentMethodLike[]
  accounts: FinancialAccountRow[]
  settings?: Pick<
    AccountSettings,
    'defaultCashAccountId' | 'defaultBankAccountId' | 'defaultPurchasePaymentAccountId'
  > | null
}

export type ResolvedPaymentAccount = {
  account: FinancialAccountRow
  source: 'kind_default' | 'kind_first' | 'method_link' | 'settings'
}

/** Map payment method codes → financial account kinds. */
export function methodCodeToAccountKind(methodCode: string): AccountKind {
  const code = methodCode.trim().toLowerCase()
  if (code === 'cash') return 'cash'
  if (code === 'bank' || code === 'bank_transfer' || code === 'card') return 'bank'
  if (
    code === 'bkash' ||
    code === 'nagad' ||
    code === 'rocket' ||
    code === 'mobile' ||
    code === 'mobile_money' ||
    code.startsWith('mobile')
  ) {
    return 'mobile_money'
  }
  return 'other'
}

/** Which payment method codes should auto-link when creating an FA of this kind. */
export function accountKindToMethodCodes(kind: AccountKind): string[] {
  if (kind === 'cash') return ['cash']
  if (kind === 'bank') return ['bank', 'bank_transfer', 'card']
  if (kind === 'mobile_money') return ['bkash', 'nagad', 'rocket', 'mobile', 'mobile_money']
  return []
}

export function accountKindLabel(kind: AccountKind): string {
  if (kind === 'cash') return 'Cash'
  if (kind === 'bank') return 'Bank'
  if (kind === 'mobile_money') return 'Mobile Money'
  return 'Cash/Bank/Mobile'
}

function activeBranchAccounts(
  accounts: FinancialAccountRow[],
  branchId?: string | null,
): FinancialAccountRow[] {
  return accounts.filter((a) => {
    if (!a.is_active) return false
    if (!branchId) return true
    return a.branch_id === branchId || a.branch_id == null
  })
}

/** Prefer branch-scoped accounts of a kind, then org-wide. */
function preferBranchThenOrg(
  ofKind: FinancialAccountRow[],
  branchId?: string | null,
): FinancialAccountRow[] {
  if (!branchId) return ofKind
  const branchLocal = ofKind.filter((a) => a.branch_id === branchId)
  const orgWide = ofKind.filter((a) => a.branch_id == null)
  return [...branchLocal, ...orgWide]
}

function findById(
  accounts: FinancialAccountRow[],
  id: string | null | undefined,
): FinancialAccountRow | null {
  if (!id) return null
  return accounts.find((a) => a.id === id) ?? null
}

/**
 * Resolve the single payment account for a method + branch.
 * Prefer branch kind defaults, then org-wide of same kind, then kind-matching
 * method link / settings. Never returns a wrong-kind account.
 */
export function resolvePaymentAccount(
  input: ResolvePaymentAccountInput,
): ResolvedPaymentAccount | null {
  const { methodCode, branchId, methods, accounts, settings } = input
  const visible = activeBranchAccounts(accounts, branchId)
  if (!visible.length) return null

  const kind = methodCodeToAccountKind(methodCode)
  const ofKind = preferBranchThenOrg(
    visible.filter((a) => a.account_kind === kind),
    branchId,
  )

  // Within branch-first ordering: default of that slice, else first of that slice.
  const branchSlice = branchId ? ofKind.filter((a) => a.branch_id === branchId) : ofKind
  const orgSlice = branchId ? ofKind.filter((a) => a.branch_id == null) : []
  for (const slice of [branchSlice, orgSlice, ofKind]) {
    if (!slice.length) continue
    const def = slice.find((a) => a.is_default)
    if (def) return { account: def, source: 'kind_default' }
    return { account: slice[0]!, source: 'kind_first' }
  }

  const method = methods.find((m) => m.code === methodCode)
  const linked = findById(visible, method?.financial_account_id)
  if (linked && linked.account_kind === kind) {
    return { account: linked, source: 'method_link' }
  }

  if (settings) {
    const settingsId =
      kind === 'cash'
        ? settings.defaultCashAccountId
        : kind === 'bank' || kind === 'mobile_money'
          ? settings.defaultBankAccountId ?? settings.defaultPurchasePaymentAccountId
          : settings.defaultPurchasePaymentAccountId
    const fromSettings = findById(visible, settingsId)
    if (fromSettings && fromSettings.account_kind === kind) {
      return { account: fromSettings, source: 'settings' }
    }
  }

  return null
}

export const NO_PAYMENT_ACCOUNT_MESSAGE =
  'Create a Cash/Bank/Mobile account for this branch in Accounts → Cash & Bank.'

/** Kind-specific missing-account copy for the active payment method. */
export function missingPaymentAccountMessage(methodCode?: string | null): string {
  if (!methodCode?.trim()) return NO_PAYMENT_ACCOUNT_MESSAGE
  const kind = methodCodeToAccountKind(methodCode)
  const label = accountKindLabel(kind)
  if (kind === 'other') return NO_PAYMENT_ACCOUNT_MESSAGE
  return `Create a ${label} account for this branch in Accounts → Cash & Bank.`
}
