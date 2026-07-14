import type { ERPDatabase, StockBalance, StockMovement, StockMovementType } from '../schema'
import { TransactionError } from '../transaction'

export function getStock(db: ERPDatabase, productId: string, branchId: string): StockBalance | undefined {
  return db.stockBalances.find((s) => s.productId === productId && s.branchId === branchId)
}

export function availableQty(balance: StockBalance | undefined): number {
  if (!balance) return 0
  return balance.quantity - balance.reserved
}

export function ensureStock(
  db: ERPDatabase,
  productId: string,
  branchId: string,
  qty: number,
  allowReserve = false,
): StockBalance {
  let balance = getStock(db, productId, branchId)
  if (!balance) {
    balance = {
      id: `sb_${productId}_${branchId}`,
      productId,
      branchId,
      quantity: 0,
      reserved: 0,
      updated_at: new Date().toISOString(),
    }
    db.stockBalances.push(balance)
  }
  const available = allowReserve ? balance.quantity - balance.reserved : availableQty(balance)
  if (available < qty) {
    throw new TransactionError(`Insufficient stock for product. Available: ${available}, required: ${qty}`)
  }
  return balance
}

export function applyStockChange(
  db: ERPDatabase,
  input: {
    productId: string
    branchId: string
    quantity: number
    type: StockMovementType
    referenceType: string
    referenceId: string
    note?: string
    userName?: string
    reserve?: boolean
    releaseReserve?: boolean
  },
): void {
  const balance = ensureStock(
    db,
    input.productId,
    input.branchId,
    input.type.includes('Out') || input.type === 'Damage' || input.type === 'Lost' || input.type === 'Sale Out'
      ? Math.abs(input.quantity)
      : 0,
  )

  const delta = input.quantity
  if (input.reserve) {
    ensureStock(db, input.productId, input.branchId, Math.abs(delta), true)
    balance.reserved += Math.abs(delta)
  } else if (input.releaseReserve || input.type === 'Release Reserve') {
    balance.reserved = Math.max(0, balance.reserved - Math.abs(delta))
  } else if (
    input.type === 'Sale Out' ||
    input.type === 'Transfer Out' ||
    input.type === 'Purchase Return Out' ||
    input.type === 'Adjustment Decrease' ||
    input.type === 'Damage' ||
    input.type === 'Lost'
  ) {
    balance.quantity -= Math.abs(delta)
  } else if (input.type !== 'Reserve') {
    balance.quantity += Math.abs(delta)
  }

  if (balance.quantity < 0 || balance.reserved < 0) {
    throw new TransactionError('Stock cannot go negative')
  }

  balance.updated_at = new Date().toISOString()

  const movement: StockMovement = {
    id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    productId: input.productId,
    branchId: input.branchId,
    type: input.type,
    quantity: Math.abs(delta),
    referenceType: input.referenceType,
    referenceId: input.referenceId,
    note: input.note ?? '',
    created_at: new Date().toISOString(),
    created_by: input.userName ?? 'System',
  }
  db.stockMovements.unshift(movement)
}
