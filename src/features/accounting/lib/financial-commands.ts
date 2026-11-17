/**
 * Thin command façade over existing accounting RPCs.
 * Does not create ledger rows on the client.
 */
import { simpleAccountingRepository } from '../repositories/simple-accounting.repository'

export const financialCommands = {
  createIncome: simpleAccountingRepository.createIncome,
  createExpense: simpleAccountingRepository.createExpense,
  postCashMovement: simpleAccountingRepository.postCashMovement,
  transferBalance: simpleAccountingRepository.transferBalance,
  collectCustomerDue: simpleAccountingRepository.collectCustomerDue,
  paySupplier: simpleAccountingRepository.paySupplier,
  closeBusinessDay: simpleAccountingRepository.closeBusinessDay,
  voidTransaction: simpleAccountingRepository.voidTransaction,
  upsertAccount: simpleAccountingRepository.upsertAccount,
  createAlignedFinancialAccount: simpleAccountingRepository.createAlignedFinancialAccount,
  setAccountActive: simpleAccountingRepository.setAccountActive,
  linkPaymentMethodAccount: simpleAccountingRepository.linkPaymentMethodAccount,
}
