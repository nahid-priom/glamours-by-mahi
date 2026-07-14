import { peekDatabase, runAtomic, TransactionError } from '@/database/transaction'
import { postFinance, logActivity } from '@/database/repositories/finance.repository'

export const accountingService = {
  accounts() {
    return peekDatabase().financialAccounts.filter((a) => a.isActive)
  },

  cashbook(limit = 80) {
    const db = peekDatabase()
    const cashIds = new Set(db.financialAccounts.filter((a) => a.type === 'Cash').map((a) => a.id))
    return db.financialTransactions.filter((t) => cashIds.has(t.accountId)).slice(0, limit)
  },

  addExpense(input: {
    accountId: string
    amount: number
    category: string
    description: string
    userName: string
  }) {
    return runAtomic(`expense:${Date.now()}`, (db) => {
      if (input.amount <= 0) throw new TransactionError('Amount must be greater than zero')
      const tx = postFinance(db, {
        accountId: input.accountId,
        type: 'Expense',
        category: input.category,
        amount: input.amount,
        referenceType: 'expense',
        referenceId: `exp_${Date.now()}`,
        description: input.description,
        userName: input.userName,
      })
      logActivity(db, {
        action: 'Expense Added',
        entityType: 'finance',
        entityId: tx.id,
        userName: input.userName,
        details: `${input.category} · ৳${input.amount}`,
      })
      return tx
    })
  },

  overview() {
    const db = peekDatabase()
    const today = new Date().toISOString().slice(0, 10)
    const todayTx = db.financialTransactions.filter((t) => t.created_at.slice(0, 10) === today)
    return {
      cash: db.financialAccounts.filter((a) => a.type === 'Cash').reduce((s, a) => s + a.balance, 0),
      bank: db.financialAccounts.filter((a) => a.type === 'Bank').reduce((s, a) => s + a.balance, 0),
      mobile: db.financialAccounts.filter((a) => a.type === 'Mobile Banking').reduce((s, a) => s + a.balance, 0),
      todayIncome: todayTx.filter((t) => t.type === 'Income').reduce((s, t) => s + t.amount, 0),
      todayExpense: todayTx.filter((t) => t.type === 'Expense').reduce((s, t) => s + t.amount, 0),
      customerDue: db.customers.reduce((s, c) => s + c.currentDue, 0),
      supplierDue: db.purchases.reduce((s, p) => s + p.dueAmount, 0),
    }
  },
}
