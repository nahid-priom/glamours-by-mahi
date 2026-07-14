import type { StockTransfer } from '@/database/schema'
import { runAtomic, withIdempotency, TransactionError, peekDatabase } from '@/database/transaction'
import { applyStockChange, availableQty, getStock } from '@/database/repositories/stock.repository'
import { logActivity, pushNotification } from '@/database/repositories/finance.repository'

export const inventoryService = {
  branchStock(branchId?: string) {
    const db = peekDatabase()
    return db.stockBalances
      .filter((s) => !branchId || s.branchId === branchId)
      .map((s) => {
        const product = db.products.find((p) => p.id === s.productId)
        const branch = db.branches.find((b) => b.id === s.branchId)
        return {
          ...s,
          productName: product?.name ?? s.productId,
          sku: product?.sku ?? '',
          branchName: branch?.name ?? s.branchId,
          available: availableQty(s),
        }
      })
  },

  lowStock(threshold?: number) {
    const db = peekDatabase()
    const limit = threshold ?? db.settings.lowStockThreshold
    return this.branchStock().filter((s) => s.available <= limit)
  },

  ledger(limit = 100) {
    return peekDatabase().stockMovements.slice(0, limit)
  },

  createTransfer(input: {
    fromBranchId: string
    toBranchId: string
    items: { productId: string; quantity: number }[]
    note?: string
    idempotencyKey: string
    userName: string
  }): StockTransfer {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.stockTransfers.find((t) => t.id === `tr_${input.idempotencyKey}`) ?? null,
      (db) => {
        if (input.fromBranchId === input.toBranchId) {
          throw new TransactionError('Same branch transfer is not allowed')
        }
        if (!input.items.length) throw new TransactionError('Add transfer items')
        for (const item of input.items) {
          const bal = getStock(db, item.productId, input.fromBranchId)
          if (availableQty(bal) < item.quantity) {
            throw new TransactionError('Quantity above available stock is not allowed')
          }
        }
        const transfer: StockTransfer = {
          id: `tr_${input.idempotencyKey}`,
          transferNo: `ST-${Date.now().toString().slice(-6)}`,
          fromBranchId: input.fromBranchId,
          toBranchId: input.toBranchId,
          status: 'Requested',
          items: input.items,
          note: input.note ?? '',
          created_at: new Date().toISOString(),
          dispatched_at: null,
          received_at: null,
        }
        db.stockTransfers.unshift(transfer)
        logActivity(db, {
          action: 'Transfer Requested',
          entityType: 'transfer',
          entityId: transfer.id,
          userName: input.userName,
          details: transfer.transferNo,
        })
        return transfer
      },
    )
  },

  dispatch(transferId: string, userName: string): StockTransfer {
    return runAtomic(`transfer-dispatch:${transferId}`, (db) => {
      const transfer = db.stockTransfers.find((t) => t.id === transferId)
      if (!transfer) throw new TransactionError('Transfer not found')
      if (transfer.status === 'Dispatched' || transfer.status === 'Received') {
        throw new TransactionError('Duplicate dispatch is not allowed')
      }
      if (transfer.status !== 'Requested' && transfer.status !== 'Approved') {
        throw new TransactionError('Transfer must be requested or approved before dispatch')
      }
      for (const item of transfer.items) {
        applyStockChange(db, {
          productId: item.productId,
          branchId: transfer.fromBranchId,
          quantity: item.quantity,
          type: 'Transfer Out',
          referenceType: 'transfer',
          referenceId: transfer.id,
          note: transfer.transferNo,
          userName,
        })
      }
      transfer.status = 'Dispatched'
      transfer.dispatched_at = new Date().toISOString()
      logActivity(db, {
        action: 'Transfer Dispatched',
        entityType: 'transfer',
        entityId: transfer.id,
        userName,
        details: transfer.transferNo,
      })
      return transfer
    })
  },

  receive(transferId: string, userName: string): StockTransfer {
    return runAtomic(`transfer-receive:${transferId}`, (db) => {
      const transfer = db.stockTransfers.find((t) => t.id === transferId)
      if (!transfer) throw new TransactionError('Transfer not found')
      if (transfer.status === 'Received') {
        throw new TransactionError('Duplicate receive is not allowed')
      }
      if (transfer.status !== 'Dispatched') {
        throw new TransactionError('Transfer must be dispatched before receive')
      }
      for (const item of transfer.items) {
        applyStockChange(db, {
          productId: item.productId,
          branchId: transfer.toBranchId,
          quantity: item.quantity,
          type: 'Transfer In',
          referenceType: 'transfer',
          referenceId: transfer.id,
          note: transfer.transferNo,
          userName,
        })
      }
      transfer.status = 'Received'
      transfer.received_at = new Date().toISOString()
      logActivity(db, {
        action: 'Transfer Received',
        entityType: 'transfer',
        entityId: transfer.id,
        userName,
        details: transfer.transferNo,
      })
      pushNotification(db, 'Stock Transfer Received', transfer.transferNo, 'success')
      return transfer
    })
  },

  adjust(input: {
    productId: string
    branchId: string
    quantity: number
    reason: 'increase' | 'decrease' | 'damage' | 'lost'
    note: string
    userName: string
  }) {
    return runAtomic(`adjust:${input.productId}:${Date.now()}`, (db) => {
      if (!input.note.trim()) throw new TransactionError('Adjustment requires a reason')
      const typeMap = {
        increase: 'Adjustment Increase' as const,
        decrease: 'Adjustment Decrease' as const,
        damage: 'Damage' as const,
        lost: 'Lost' as const,
      }
      applyStockChange(db, {
        productId: input.productId,
        branchId: input.branchId,
        quantity: Math.abs(input.quantity),
        type: typeMap[input.reason],
        referenceType: 'adjustment',
        referenceId: `adj_${Date.now()}`,
        note: input.note,
        userName: input.userName,
      })
      logActivity(db, {
        action: 'Stock Adjustment',
        entityType: 'product',
        entityId: input.productId,
        userName: input.userName,
        details: `${input.reason} · ${input.quantity} · ${input.note}`,
      })
    })
  },
}
