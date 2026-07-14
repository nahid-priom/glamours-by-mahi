import type { ERPDatabase, FinancialTransaction } from '../schema'
import { TransactionError } from '../transaction'

export function postFinance(
  db: ERPDatabase,
  input: {
    accountId: string
    type: 'Income' | 'Expense' | 'Transfer'
    category: string
    amount: number
    referenceType: string
    referenceId: string
    description: string
    userName?: string
  },
): FinancialTransaction {
  if (input.amount <= 0) {
    throw new TransactionError('Amount must be greater than zero')
  }
  const account = db.financialAccounts.find((a) => a.id === input.accountId)
  if (!account || !account.isActive) {
    throw new TransactionError('Financial account not found')
  }

  if (input.type === 'Expense') {
    if (account.balance < input.amount) {
      throw new TransactionError(`Insufficient balance in ${account.name}`)
    }
    account.balance -= input.amount
  } else if (input.type === 'Income') {
    account.balance += input.amount
  }

  const tx: FinancialTransaction = {
    id: `ft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    accountId: input.accountId,
    type: input.type,
    category: input.category,
    amount: input.amount,
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    description: input.description,
    created_at: new Date().toISOString(),
    created_by: input.userName ?? 'System',
  }
  db.financialTransactions.unshift(tx)
  return tx
}

export function logActivity(
  db: ERPDatabase,
  input: {
    action: string
    entityType: string
    entityId: string
    userName: string
    details: string
  },
): void {
  db.activities.unshift({
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...input,
    created_at: new Date().toISOString(),
  })
}

export function pushNotification(
  db: ERPDatabase,
  title: string,
  message: string,
  type: 'info' | 'warning' | 'success' | 'danger' = 'info',
): void {
  db.notifications.unshift({
    id: `nt_${Date.now()}`,
    title,
    message,
    type,
    read: false,
    created_at: new Date().toISOString(),
  })
}
