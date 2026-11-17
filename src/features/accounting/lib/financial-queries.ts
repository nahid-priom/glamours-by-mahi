/**
 * Shared read contracts for Accounts 2.0 hubs.
 */
import {
  simpleAccountingRepository,
  type AccountKind,
  type FinancialAccountRow,
  type ProfitLossResult,
  type SimpleTransaction,
} from '../repositories/simple-accounting.repository'
import {
  isNonPnlCashMovement,
  isTransferTxn,
  summarizePeriodCashFlow,
} from './cash-flow-metrics'
import { queryKeys } from '@/lib/query/keys'

export { isNonPnlCashMovement, isTransferTxn, summarizePeriodCashFlow }

export function totalAccountBalance(accounts: FinancialAccountRow[]): number {
  return accounts
    .filter((a) => a.is_active)
    .reduce((s, a) => s + Number(a.current_balance || 0), 0)
}

export function accountsByKind(accounts: FinancialAccountRow[], kind: AccountKind) {
  return accounts.filter((a) => a.is_active && a.account_kind === kind)
}

/** Shared React Query key fragments for accounts hubs. */
export const financialQueryKeys = {
  hubAccounts: (branchId?: string | null) =>
    [...queryKeys.accounts, 'hub-accounts', branchId] as const,
  hubCashFlow: (branchId: string | null | undefined, from: string, to: string) =>
    [...queryKeys.accounts, 'hub-cash-flow', branchId, from, to] as const,
  partyDetail: (party: 'customer' | 'supplier', id: string) =>
    [...queryKeys.accounts, 'party-detail', party, id] as const,
  hubRecent: (branchId?: string | null) =>
    [...queryKeys.accounts, 'hub-recent', branchId] as const,
  dues: (tab: 'customers' | 'suppliers') =>
    [...queryKeys.accounts, 'dues', tab] as const,
  dueAging: (party: 'customer' | 'supplier') =>
    [...queryKeys.accounts, 'due-aging', party] as const,
  profitLoss: (from: string, to: string, branchId?: string | null) =>
    [...queryKeys.accounts, 'simple-pl', from, to, branchId] as const,
  profitLossReport: (from: string, to: string, branchId?: string | null) =>
    [...queryKeys.accounts, 'pl-report', from, to, branchId] as const,
}

export const financialQueries = {
  listFinancialAccounts: simpleAccountingRepository.listFinancialAccounts,
  listTransactions: simpleAccountingRepository.listTransactions,
  listAccountTransactions: simpleAccountingRepository.listAccountTransactions,
  getDashboardKpis: simpleAccountingRepository.getDashboardKpis,
  getProfitLoss: simpleAccountingRepository.getProfitLoss,
  getProfitLossReport: simpleAccountingRepository.getProfitLossReport,
  getPeriodCashFlow: simpleAccountingRepository.getPeriodCashFlow,
  getPartyDueAging: simpleAccountingRepository.getPartyDueAging,
  listCustomerDues: simpleAccountingRepository.listCustomerDues,
  listSupplierDues: simpleAccountingRepository.listSupplierDues,
  listOpenCustomerInvoices: simpleAccountingRepository.listOpenCustomerInvoices,
  listOpenSupplierPurchases: simpleAccountingRepository.listOpenSupplierPurchases,
  listCustomerLedgerEntries: simpleAccountingRepository.listCustomerLedgerEntries,
  listSupplierLedgerEntries: simpleAccountingRepository.listSupplierLedgerEntries,
  getAccountSettings: simpleAccountingRepository.getAccountSettings,
  getExpectedCash: simpleAccountingRepository.getExpectedCash,
  listIncome: simpleAccountingRepository.listIncome,
  listExpenses: simpleAccountingRepository.listExpenses,
  summarizePeriodCashFlow,
  totalAccountBalance,
  accountsByKind,
}

export type { FinancialAccountRow, ProfitLossResult, SimpleTransaction }
