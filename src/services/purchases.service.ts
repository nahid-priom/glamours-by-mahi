import type { Purchase, PurchaseItem } from '@/database/schema'
import { withIdempotency, TransactionError, peekDatabase } from '@/database/transaction'
import { applyStockChange } from '@/database/repositories/stock.repository'
import { postFinance, logActivity, pushNotification } from '@/database/repositories/finance.repository'

export interface CreatePurchaseInput {
  supplierId: string
  branchId: string
  items: { productId: string; quantity: number; unitCost: number; discount?: number }[]
  discount?: number
  transportCost?: number
  paidAmount: number
  accountId?: string | null
  note?: string
  idempotencyKey: string
  userName: string
}

export const purchasesService = {
  list() {
    return peekDatabase().purchases
  },

  getById(id: string) {
    return peekDatabase().purchases.find((p) => p.id === id) ?? null
  },

  create(input: CreatePurchaseInput): Purchase {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.purchases.find((p) => p.id === `pur_${input.idempotencyKey}`) ?? null,
      (db) => {
        const supplier = db.suppliers.find((s) => s.id === input.supplierId && !s.deleted_at)
        if (!supplier) throw new TransactionError('Supplier is required')
        const branch = db.branches.find((b) => b.id === input.branchId)
        if (!branch) throw new TransactionError('Branch is required')
        if (!input.items.length) throw new TransactionError('Add at least one product')

        const items: PurchaseItem[] = input.items.map((item) => {
          const product = db.products.find((p) => p.id === item.productId)
          if (!product) throw new TransactionError('Product not found')
          const discount = item.discount ?? 0
          const total = item.unitCost * item.quantity - discount
          product.cost = item.unitCost
          return {
            productId: product.id,
            quantity: item.quantity,
            unitCost: item.unitCost,
            discount,
            total,
          }
        })

        const subtotal = items.reduce((s, i) => s + i.unitCost * i.quantity, 0)
        const discount = (input.discount ?? 0) + items.reduce((s, i) => s + i.discount, 0)
        const transportCost = input.transportCost ?? 0
        const total = subtotal - discount + transportCost
        if (input.paidAmount < 0 || input.paidAmount > total) {
          throw new TransactionError('Paid amount is invalid')
        }
        const dueAmount = total - input.paidAmount
        const purchaseId = `pur_${input.idempotencyKey}`
        const purchaseNo = `PO-${Date.now().toString().slice(-6)}`
        const now = new Date().toISOString()

        for (const item of items) {
          applyStockChange(db, {
            productId: item.productId,
            branchId: input.branchId,
            quantity: item.quantity,
            type: 'Purchase In',
            referenceType: 'purchase',
            referenceId: purchaseId,
            note: purchaseNo,
            userName: input.userName,
          })
        }

        if (input.paidAmount > 0) {
          if (!input.accountId) throw new TransactionError('Select payment account')
          postFinance(db, {
            accountId: input.accountId,
            type: 'Expense',
            category: 'Supplier Payment',
            amount: input.paidAmount,
            referenceType: 'purchase',
            referenceId: purchaseId,
            description: `Purchase ${purchaseNo}`,
            userName: input.userName,
          })
          db.supplierPayments.unshift({
            id: `sp_${Date.now()}`,
            supplierId: supplier.id,
            amount: input.paidAmount,
            accountId: input.accountId,
            reference: purchaseNo,
            note: 'Purchase payment',
            created_at: now,
          })
        }

        const purchase: Purchase = {
          id: purchaseId,
          purchaseNo,
          supplierId: supplier.id,
          branchId: input.branchId,
          items,
          subtotal,
          discount,
          transportCost,
          total,
          paidAmount: input.paidAmount,
          dueAmount,
          accountId: input.accountId ?? null,
          status: 'Finalized',
          note: input.note ?? '',
          created_at: now,
          finalized_at: now,
        }
        db.purchases.unshift(purchase)
        logActivity(db, {
          action: 'Purchase Created',
          entityType: 'purchase',
          entityId: purchaseId,
          userName: input.userName,
          details: `${purchaseNo} · ${supplier.name} · ৳${total}`,
        })
        pushNotification(db, 'Purchase Saved', `${purchaseNo} stock updated at ${branch.name}`, 'success')
        return purchase
      },
    )
  },

  paySupplier(input: {
    supplierId: string
    amount: number
    accountId: string
    note?: string
    idempotencyKey: string
    userName: string
  }) {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.supplierPayments.find((p) => p.id === `sp_${input.idempotencyKey}`) ?? null,
      (db) => {
        const supplier = db.suppliers.find((s) => s.id === input.supplierId)
        if (!supplier) throw new TransactionError('Supplier not found')
        if (input.amount <= 0) throw new TransactionError('Amount must be greater than zero')

        const openPurchases = db.purchases
          .filter((p) => p.supplierId === input.supplierId && p.dueAmount > 0)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
        const totalDue = openPurchases.reduce((s, p) => s + p.dueAmount, 0)
        if (input.amount > totalDue) {
          throw new TransactionError(`Payment exceeds supplier due (৳${totalDue})`)
        }

        postFinance(db, {
          accountId: input.accountId,
          type: 'Expense',
          category: 'Supplier Payment',
          amount: input.amount,
          referenceType: 'supplier_payment',
          referenceId: `sp_${input.idempotencyKey}`,
          description: `Supplier payment · ${supplier.name}`,
          userName: input.userName,
        })

        let remaining = input.amount
        for (const purchase of openPurchases) {
          if (remaining <= 0) break
          const apply = Math.min(remaining, purchase.dueAmount)
          purchase.dueAmount -= apply
          purchase.paidAmount += apply
          remaining -= apply
        }

        const payment = {
          id: `sp_${input.idempotencyKey}`,
          supplierId: supplier.id,
          amount: input.amount,
          accountId: input.accountId,
          reference: `PAY-${Date.now().toString().slice(-6)}`,
          note: input.note ?? '',
          created_at: new Date().toISOString(),
        }
        db.supplierPayments.unshift(payment)
        logActivity(db, {
          action: 'Supplier Payment',
          entityType: 'supplier',
          entityId: supplier.id,
          userName: input.userName,
          details: `৳${input.amount} paid to ${supplier.name}`,
        })
        return payment
      },
    )
  },
}
