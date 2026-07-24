/** @deprecated Legacy IndexedDB sales/commission — not used by production routes. Use Supabase salesman_commissions. */
import type {
  Sale,
  SaleItem,
  SaleReturn,
  SaleStatus,
  SalesChannel,
  PaymentMethod,
  Collection,
  ERPDatabase,
} from '@/database/schema'
import { withIdempotency, runAtomic, TransactionError, peekDatabase } from '@/database/transaction'
import { applyStockChange, ensureStock } from '@/database/repositories/stock.repository'
import { postFinance, logActivity, pushNotification } from '@/database/repositories/finance.repository'

export interface CreateSaleInput {
  customerId: string
  branchId: string
  salespersonId: string
  channel: SalesChannel
  items: { productId: string; quantity: number; unitPrice: number; discount?: number }[]
  discount?: number
  paymentMethod: PaymentMethod
  paidAmount: number
  accountId: string
  deliveryMethod: 'Pickup' | 'Home Delivery' | 'Courier'
  courierId?: string | null
  note?: string
  idempotencyKey: string
  userName: string
}

export type UpdateSaleInput = Omit<CreateSaleInput, 'idempotencyKey'> & {
  saleId: string
}

export interface SaleListFilters {
  search?: string
  branchId?: string
  customerId?: string
  salespersonId?: string
  channel?: string
  paymentStatus?: string
  deliveryStatus?: string
  courierId?: string
  invoiceNo?: string
  amountMin?: number
  amountMax?: number
  from?: string
  to?: string
  includeDeleted?: boolean
  status?: SaleStatus | 'all'
}

export interface SaleListRow extends Sale {
  customerName: string
  customerPhone: string
  branchName: string
  salespersonName: string
  courierName: string | null
  grossProfit: number
}

function deriveStatus(paidAmount: number, dueAmount: number, forced?: SaleStatus): SaleStatus {
  if (forced === 'Returned' || forced === 'Cancelled') return forced
  if (dueAmount > 0 && paidAmount > 0) return 'Partial Paid'
  if (dueAmount > 0 && paidAmount === 0) return 'Processing'
  return 'Completed'
}

function buildSaleItems(
  db: ERPDatabase,
  items: CreateSaleInput['items'],
  branchId: string,
): SaleItem[] {
  return items.map((item) => {
    const product = db.products.find((p) => p.id === item.productId)
    if (!product) throw new TransactionError('Product not found')
    ensureStock(db, item.productId, branchId, item.quantity)
    const lineDiscount = item.discount ?? 0
    const total = item.unitPrice * item.quantity - lineDiscount
    return {
      productId: product.id,
      name: product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: lineDiscount,
      total,
      cost: product.cost,
    }
  })
}

function calcCommission(
  salesperson: ERPDatabase['employees'][number],
  saleItems: SaleItem[],
  total: number,
): number {
  if (salesperson.commissionRule === 'fixed') return salesperson.commissionValue
  if (salesperson.commissionRule === 'percent_sale') {
    return Math.round(total * (salesperson.commissionValue / 100))
  }
  if (salesperson.commissionRule === 'percent_profit') {
    const cogs = saleItems.reduce((s, i) => s + i.cost * i.quantity, 0)
    return Math.round((total - cogs) * (salesperson.commissionValue / 100))
  }
  return 0
}

/** Reverse stock, finance, customer ledger, and commission for an active sale. */
function reverseSaleImpacts(
  db: ERPDatabase,
  sale: Sale,
  userName: string,
  reason: string,
): void {
  if (sale.status === 'Cancelled' || sale.deleted_at) return
  if (sale.status === 'Returned') {
    // Already returned — stock/finance handled by return flow
    return
  }

  for (const item of sale.items) {
    applyStockChange(db, {
      productId: item.productId,
      branchId: sale.branchId,
      quantity: item.quantity,
      type: 'Sales Return In',
      referenceType: 'sale',
      referenceId: sale.id,
      note: `${reason} · ${sale.saleNo}`,
      userName,
    })
  }

  if (sale.paidAmount > 0 && sale.accountId) {
    postFinance(db, {
      accountId: sale.accountId,
      type: 'Expense',
      category: 'Sales Reversal',
      amount: sale.paidAmount,
      referenceType: 'sale',
      referenceId: sale.id,
      description: `${reason} · ${sale.saleNo}`,
      userName,
    })
  }

  const customer = db.customers.find((c) => c.id === sale.customerId)
  if (customer) {
    customer.totalOrders = Math.max(0, customer.totalOrders - 1)
    customer.deliveredOrders = Math.max(0, customer.deliveredOrders - 1)
    customer.totalSpent = Math.max(0, customer.totalSpent - sale.total)
    customer.totalPaid = Math.max(0, customer.totalPaid - sale.paidAmount)
    customer.currentDue = Math.max(0, customer.currentDue - sale.dueAmount)
  }

  db.commissions
    .filter((c) => c.saleId === sale.id && c.status !== 'Reversed')
    .forEach((c) => {
      c.status = 'Reversed'
    })
}

function applySaleImpacts(
  db: ERPDatabase,
  sale: Sale,
  saleItems: SaleItem[],
  userName: string,
): void {
  const branch = db.branches.find((b) => b.id === sale.branchId)
  const salesperson = db.employees.find((e) => e.id === sale.salespersonId)
  if (!salesperson) throw new TransactionError('Salesperson is required')

  for (const item of saleItems) {
    applyStockChange(db, {
      productId: item.productId,
      branchId: sale.branchId,
      quantity: item.quantity,
      type: 'Sale Out',
      referenceType: 'sale',
      referenceId: sale.id,
      note: sale.saleNo,
      userName,
    })
  }

  if (sale.paidAmount > 0 && sale.accountId) {
    postFinance(db, {
      accountId: sale.accountId,
      type: 'Income',
      category: 'Sales',
      amount: sale.paidAmount,
      referenceType: 'sale',
      referenceId: sale.id,
      description: `Sale ${sale.saleNo}`,
      userName,
    })
  }

  const customer = db.customers.find((c) => c.id === sale.customerId)
  if (customer) {
    customer.totalOrders += 1
    customer.deliveredOrders += 1
    customer.totalSpent += sale.total
    customer.totalPaid += sale.paidAmount
    customer.currentDue += sale.dueAmount
  }

  const commissionAmount = calcCommission(salesperson, saleItems, sale.total)
  if (commissionAmount > 0) {
    db.commissions.unshift({
      id: `com_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      employeeId: salesperson.id,
      saleId: sale.id,
      amount: commissionAmount,
      status: sale.dueAmount === 0 ? 'Approved' : 'Pending',
      created_at: new Date().toISOString(),
      paid_at: null,
    })
  }

  for (const item of saleItems) {
    const bal = db.stockBalances.find(
      (s) => s.productId === item.productId && s.branchId === sale.branchId,
    )
    if (bal && bal.quantity - bal.reserved <= db.settings.lowStockThreshold) {
      pushNotification(db, 'Low Stock', `${item.name} is low at ${branch?.name ?? 'branch'}`, 'warning')
    }
  }
}

function matchesFilters(sale: Sale, filters: SaleListFilters, db: ERPDatabase): boolean {
  if (!filters.includeDeleted && sale.deleted_at) return false
  if (filters.includeDeleted === false && sale.deleted_at) return false
  if (filters.status && filters.status !== 'all' && sale.status !== filters.status) return false
  if (filters.branchId && filters.branchId !== 'all' && sale.branchId !== filters.branchId) return false
  if (filters.customerId && sale.customerId !== filters.customerId) return false
  if (filters.salespersonId && filters.salespersonId !== 'all' && sale.salespersonId !== filters.salespersonId) {
    return false
  }
  if (filters.channel && filters.channel !== 'all' && sale.channel !== filters.channel) return false
  if (filters.courierId && filters.courierId !== 'all' && sale.courierId !== filters.courierId) return false
  if (filters.from && sale.created_at.slice(0, 10) < filters.from) return false
  if (filters.to && sale.created_at.slice(0, 10) > filters.to) return false
  if (filters.amountMin != null && sale.total < filters.amountMin) return false
  if (filters.amountMax != null && sale.total > filters.amountMax) return false
  if (filters.invoiceNo) {
    const q = filters.invoiceNo.trim().toLowerCase()
    if (!sale.saleNo.toLowerCase().includes(q)) return false
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    if (filters.paymentStatus === 'paid' && sale.dueAmount > 0) return false
    if (filters.paymentStatus === 'partial' && !(sale.dueAmount > 0 && sale.paidAmount > 0)) return false
    if (filters.paymentStatus === 'due' && sale.dueAmount <= 0) return false
  }
  if (filters.deliveryStatus && filters.deliveryStatus !== 'all') {
    if (sale.deliveryMethod !== filters.deliveryStatus) return false
  }
  if (filters.search) {
    const q = filters.search.trim().toLowerCase()
    const customer = db.customers.find((c) => c.id === sale.customerId)
    const match =
      sale.saleNo.toLowerCase().includes(q) ||
      customer?.name.toLowerCase().includes(q) ||
      customer?.phone.includes(q) ||
      sale.channel.toLowerCase().includes(q) ||
      sale.paymentMethod.toLowerCase().includes(q)
    if (!match) return false
  }
  return true
}

function toListRow(sale: Sale, db: ERPDatabase): SaleListRow {
  const customer = db.customers.find((c) => c.id === sale.customerId)
  const branch = db.branches.find((b) => b.id === sale.branchId)
  const salesperson = db.employees.find((e) => e.id === sale.salespersonId)
  const cogs = sale.items.reduce((s, i) => s + i.cost * i.quantity, 0)
  return {
    ...sale,
    customerName: customer?.name ?? '—',
    customerPhone: customer?.phone ?? '',
    branchName: branch?.name ?? '—',
    salespersonName: salesperson?.name ?? '—',
    courierName: sale.courierId,
    grossProfit: sale.total - cogs,
  }
}

export const salesService = {
  list(filters: SaleListFilters = {}): SaleListRow[] {
    const db = peekDatabase()
    return db.sales
      .filter((s) => matchesFilters(s, filters, db))
      .map((s) => toListRow(s, db))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  getById(id: string): Sale | null {
    return peekDatabase().sales.find((s) => s.id === id) ?? null
  },

  getDetail(id: string) {
    const db = peekDatabase()
    const sale = db.sales.find((s) => s.id === id)
    if (!sale) return null
    const customer = db.customers.find((c) => c.id === sale.customerId) ?? null
    const branch = db.branches.find((b) => b.id === sale.branchId) ?? null
    const salesperson = db.employees.find((e) => e.id === sale.salespersonId) ?? null
    const account = sale.accountId
      ? db.financialAccounts.find((a) => a.id === sale.accountId) ?? null
      : null
    const returns = db.saleReturns.filter((r) => r.saleId === sale.id)
    const collections = db.collections.filter(
      (c) => c.saleId === sale.id || (c.customerId === sale.customerId && !c.saleId),
    )
    const commissions = db.commissions.filter((c) => c.saleId === sale.id)
    const activities = db.activities.filter(
      (a) => a.entityType === 'sale' && a.entityId === sale.id,
    )
    const previousOrders = db.sales.filter(
      (s) => s.customerId === sale.customerId && s.id !== sale.id && !s.deleted_at,
    ).length
    const cogs = sale.items.reduce((s, i) => s + i.cost * i.quantity, 0)
    const itemsSold = sale.items.reduce((s, i) => s + i.quantity, 0)
    return {
      sale,
      customer,
      branch,
      salesperson,
      account,
      returns,
      collections,
      commissions,
      activities,
      insights: {
        grossProfit: sale.total - cogs,
        discount: sale.discount,
        itemsSold,
        customerLifetimeValue: customer?.totalSpent ?? 0,
        previousOrders,
        outstandingDue: customer?.currentDue ?? 0,
        cogs,
      },
    }
  },

  create(input: CreateSaleInput): Sale {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.sales.find((s) => s.idempotencyKey === input.idempotencyKey) ?? null,
      (db) => {
        if (!input.items.length) throw new TransactionError('Add at least one product')
        const customer = db.customers.find((c) => c.id === input.customerId)
        if (!customer) throw new TransactionError('Customer is required')
        const branch = db.branches.find((b) => b.id === input.branchId)
        if (!branch) throw new TransactionError('Branch is required')
        const salesperson = db.employees.find((e) => e.id === input.salespersonId)
        if (!salesperson) throw new TransactionError('Salesperson is required')

        const saleItems = buildSaleItems(db, input.items, input.branchId)
        const subtotal = saleItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
        const discount = (input.discount ?? 0) + saleItems.reduce((s, i) => s + i.discount, 0)
        const total = subtotal - discount
        if (input.paidAmount < 0 || input.paidAmount > total) {
          throw new TransactionError('Paid amount is invalid')
        }
        const dueAmount = total - input.paidAmount
        const now = new Date().toISOString()
        const saleId = `sale_${Date.now()}`
        const saleNo = `SL-${Date.now().toString().slice(-6)}`

        const sale: Sale = {
          id: saleId,
          saleNo,
          customerId: customer.id,
          branchId: input.branchId,
          salespersonId: input.salespersonId,
          channel: input.channel,
          items: saleItems,
          subtotal,
          discount,
          total,
          paidAmount: input.paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          accountId: input.accountId,
          deliveryMethod: input.deliveryMethod,
          courierId: input.courierId ?? null,
          note: input.note ?? '',
          status: deriveStatus(input.paidAmount, dueAmount),
          created_at: now,
          updated_at: now,
          deleted_at: null,
          idempotencyKey: input.idempotencyKey,
        }

        applySaleImpacts(db, sale, saleItems, input.userName)
        db.sales.unshift(sale)
        logActivity(db, {
          action: 'Sale Created',
          entityType: 'sale',
          entityId: saleId,
          userName: input.userName,
          details: `${saleNo} · ৳${total}`,
        })
        return sale
      },
    )
  },

  update(input: UpdateSaleInput): Sale {
    return runAtomic(`sale-update-${input.saleId}`, (db) => {
      const existing = db.sales.find((s) => s.id === input.saleId)
      if (!existing) throw new TransactionError('Sale not found')
      if (existing.deleted_at) throw new TransactionError('Cannot edit a deleted sale')
      if (existing.status === 'Returned' || existing.status === 'Cancelled') {
        throw new TransactionError(`Cannot edit a ${existing.status.toLowerCase()} sale`)
      }
      if (!input.items.length) throw new TransactionError('Add at least one product')

      reverseSaleImpacts(db, existing, input.userName, 'Sale Edit Reversal')

      const saleItems = buildSaleItems(db, input.items, input.branchId)
      const subtotal = saleItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
      const discount = (input.discount ?? 0) + saleItems.reduce((s, i) => s + i.discount, 0)
      const total = subtotal - discount
      if (input.paidAmount < 0 || input.paidAmount > total) {
        throw new TransactionError('Paid amount is invalid')
      }
      const dueAmount = total - input.paidAmount
      const now = new Date().toISOString()

      existing.customerId = input.customerId
      existing.branchId = input.branchId
      existing.salespersonId = input.salespersonId
      existing.channel = input.channel
      existing.items = saleItems
      existing.subtotal = subtotal
      existing.discount = discount
      existing.total = total
      existing.paidAmount = input.paidAmount
      existing.dueAmount = dueAmount
      existing.paymentMethod = input.paymentMethod
      existing.accountId = input.accountId
      existing.deliveryMethod = input.deliveryMethod
      existing.courierId = input.courierId ?? null
      existing.note = input.note ?? ''
      existing.status = deriveStatus(input.paidAmount, dueAmount)
      existing.updated_at = now

      applySaleImpacts(db, existing, saleItems, input.userName)
      logActivity(db, {
        action: 'Sale Updated',
        entityType: 'sale',
        entityId: existing.id,
        userName: input.userName,
        details: `${existing.saleNo} · ৳${total}`,
      })
      return { ...existing }
    })
  },

  softDelete(saleId: string, userName: string): Sale {
    return runAtomic(`sale-delete-${saleId}`, (db) => {
      const sale = db.sales.find((s) => s.id === saleId)
      if (!sale) throw new TransactionError('Sale not found')
      if (sale.deleted_at) throw new TransactionError('Sale already deleted')

      reverseSaleImpacts(db, sale, userName, 'Sale Deleted')
      sale.status = 'Cancelled'
      sale.deleted_at = new Date().toISOString()
      sale.updated_at = sale.deleted_at

      logActivity(db, {
        action: 'Sale Deleted',
        entityType: 'sale',
        entityId: sale.id,
        userName,
        details: `${sale.saleNo} soft-deleted · stock & finance reversed`,
      })
      return { ...sale }
    })
  },

  duplicate(saleId: string, userName: string): Sale {
    const source = this.getById(saleId)
    if (!source || source.deleted_at) throw new TransactionError('Sale not found')
    return this.create({
      customerId: source.customerId,
      branchId: source.branchId,
      salespersonId: source.salespersonId,
      channel: source.channel,
      items: source.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
      })),
      discount: 0,
      paymentMethod: source.paymentMethod,
      paidAmount: 0,
      accountId: source.accountId ?? peekDatabase().financialAccounts[0]?.id ?? '',
      deliveryMethod: source.deliveryMethod,
      courierId: source.courierId,
      note: `Duplicated from ${source.saleNo}`,
      idempotencyKey: `dup_${saleId}_${Date.now()}`,
      userName,
    })
  },

  createReturn(input: {
    saleId: string
    items?: { productId: string; quantity: number }[]
    reason: string
    userName: string
    idempotencyKey: string
  }): SaleReturn {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.saleReturns.find((r) => r.id === `ret_${input.idempotencyKey}`) ?? null,
      (db) => {
        const sale = db.sales.find((s) => s.id === input.saleId)
        if (!sale) throw new TransactionError('Sale not found')
        if (sale.deleted_at) throw new TransactionError('Cannot return a deleted sale')
        if (sale.status === 'Returned') throw new TransactionError('Sale already returned')
        if (sale.status === 'Cancelled') throw new TransactionError('Cannot return a cancelled sale')

        const returnItems: SaleItem[] = (input.items?.length
          ? input.items
          : sale.items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
        ).map((sel) => {
          const original = sale.items.find((i) => i.productId === sel.productId)
          if (!original) throw new TransactionError('Return item not on sale')
          if (sel.quantity <= 0 || sel.quantity > original.quantity) {
            throw new TransactionError('Invalid return quantity')
          }
          const ratio = sel.quantity / original.quantity
          return {
            ...original,
            quantity: sel.quantity,
            discount: Math.round(original.discount * ratio),
            total: Math.round(original.total * ratio),
          }
        })

        const returnTotal = returnItems.reduce((s, i) => s + i.total, 0)
        const isFullReturn = returnItems.every((ri) => {
          const orig = sale.items.find((i) => i.productId === ri.productId)!
          return ri.quantity === orig.quantity
        }) && returnItems.length === sale.items.length

        for (const item of returnItems) {
          applyStockChange(db, {
            productId: item.productId,
            branchId: sale.branchId,
            quantity: item.quantity,
            type: 'Sales Return In',
            referenceType: 'sale_return',
            referenceId: sale.id,
            note: input.reason,
            userName: input.userName,
          })
        }

        const paidRatio = sale.total > 0 ? sale.paidAmount / sale.total : 0
        const refundAmount = Math.round(returnTotal * paidRatio)
        if (refundAmount > 0 && sale.accountId) {
          postFinance(db, {
            accountId: sale.accountId,
            type: 'Expense',
            category: 'Sales Return',
            amount: refundAmount,
            referenceType: 'sale_return',
            referenceId: sale.id,
            description: `Return ${sale.saleNo}`,
            userName: input.userName,
          })
        }

        const dueRatio = sale.total > 0 ? sale.dueAmount / sale.total : 0
        const dueRelease = Math.round(returnTotal * dueRatio)
        const customer = db.customers.find((c) => c.id === sale.customerId)
        if (customer) {
          customer.totalSpent = Math.max(0, customer.totalSpent - returnTotal)
          customer.totalPaid = Math.max(0, customer.totalPaid - refundAmount)
          customer.currentDue = Math.max(0, customer.currentDue - dueRelease)
          if (isFullReturn) {
            customer.deliveredOrders = Math.max(0, customer.deliveredOrders - 1)
            customer.returnedOrders += 1
          }
        }

        if (isFullReturn) {
          sale.paidAmount = 0
          sale.dueAmount = 0
          sale.status = 'Returned'
          db.commissions
            .filter((c) => c.saleId === sale.id && c.status !== 'Reversed')
            .forEach((c) => {
              c.status = 'Reversed'
            })
        } else {
          sale.paidAmount = Math.max(0, sale.paidAmount - refundAmount)
          sale.dueAmount = Math.max(0, sale.dueAmount - dueRelease)
          sale.total = Math.max(0, sale.total - returnTotal)
          sale.status = deriveStatus(sale.paidAmount, sale.dueAmount)
        }
        sale.updated_at = new Date().toISOString()

        const saleReturn: SaleReturn = {
          id: `ret_${input.idempotencyKey}`,
          saleId: sale.id,
          items: returnItems,
          total: returnTotal,
          reason: input.reason,
          created_at: new Date().toISOString(),
        }
        db.saleReturns.unshift(saleReturn)
        logActivity(db, {
          action: 'Sale Returned',
          entityType: 'sale',
          entityId: sale.id,
          userName: input.userName,
          details: `${sale.saleNo} · ৳${returnTotal} · ${input.reason}`,
        })
        return saleReturn
      },
    )
  },

  receivePayment(input: {
    saleId: string
    amount: number
    accountId: string
    note?: string
    userName: string
    idempotencyKey: string
  }): Collection {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.collections.find((c) => c.id === `col_${input.idempotencyKey}`) ?? null,
      (db) => {
        const sale = db.sales.find((s) => s.id === input.saleId)
        if (!sale) throw new TransactionError('Sale not found')
        if (sale.deleted_at) throw new TransactionError('Cannot collect on deleted sale')
        if (sale.status === 'Returned' || sale.status === 'Cancelled') {
          throw new TransactionError('Cannot collect on this sale')
        }
        if (input.amount <= 0) throw new TransactionError('Amount must be greater than zero')
        if (input.amount > sale.dueAmount) {
          throw new TransactionError(`Amount exceeds sale due (৳${sale.dueAmount})`)
        }

        postFinance(db, {
          accountId: input.accountId,
          type: 'Income',
          category: 'Customer Collection',
          amount: input.amount,
          referenceType: 'collection',
          referenceId: `col_${input.idempotencyKey}`,
          description: `Collection ${sale.saleNo}`,
          userName: input.userName,
        })

        sale.dueAmount -= input.amount
        sale.paidAmount += input.amount
        sale.status = deriveStatus(sale.paidAmount, sale.dueAmount)
        sale.updated_at = new Date().toISOString()

        const customer = db.customers.find((c) => c.id === sale.customerId)
        if (customer) {
          customer.currentDue = Math.max(0, customer.currentDue - input.amount)
          customer.totalPaid += input.amount
        }

        if (sale.dueAmount === 0) {
          db.commissions
            .filter((c) => c.saleId === sale.id && c.status === 'Pending')
            .forEach((c) => {
              c.status = 'Approved'
            })
        }

        const collection: Collection = {
          id: `col_${input.idempotencyKey}`,
          customerId: sale.customerId,
          saleId: sale.id,
          amount: input.amount,
          accountId: input.accountId,
          reference: `COL-${Date.now().toString().slice(-6)}`,
          note: input.note ?? '',
          created_at: new Date().toISOString(),
        }
        db.collections.unshift(collection)
        logActivity(db, {
          action: 'Payment Received',
          entityType: 'sale',
          entityId: sale.id,
          userName: input.userName,
          details: `${sale.saleNo} · ৳${input.amount}`,
        })
        return collection
      },
    )
  },

  bulkSoftDelete(ids: string[], userName: string) {
    return ids.map((id) => {
      try {
        return this.softDelete(id, userName)
      } catch {
        return null
      }
    }).filter(Boolean)
  },

  getDashboardKpis(filters: { branchId?: string; from?: string; to?: string } = {}) {
    const db = peekDatabase()
    const today = new Date().toISOString().slice(0, 10)
    const monthStart = today.slice(0, 8) + '01'
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    const active = (s: Sale) =>
      !s.deleted_at &&
      s.status !== 'Cancelled' &&
      (!filters.branchId || filters.branchId === 'all' || s.branchId === filters.branchId)

    const todaySales = db.sales.filter((s) => active(s) && s.created_at.slice(0, 10) === today)
    const yesterdaySales = db.sales.filter((s) => active(s) && s.created_at.slice(0, 10) === yesterday)
    const monthSales = db.sales.filter(
      (s) => active(s) && s.created_at.slice(0, 10) >= monthStart && s.status !== 'Returned',
    )
    const allActive = db.sales.filter((s) => active(s) && s.status !== 'Returned')
    const returns = db.saleReturns.filter((r) => {
      const sale = db.sales.find((s) => s.id === r.saleId)
      if (!sale || !active(sale)) return false
      return r.created_at.slice(0, 10) >= monthStart
    })

    const todayTotal = todaySales.reduce((s, x) => s + x.total, 0)
    const yesterdayTotal = yesterdaySales.reduce((s, x) => s + x.total, 0)
    const todayTrend =
      yesterdayTotal > 0 ? Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 1000) / 10 : 0

    return {
      todaySales: todayTotal,
      todayTrend,
      monthSales: monthSales.reduce((s, x) => s + x.total, 0),
      collections: allActive.reduce((s, x) => s + x.paidAmount, 0),
      outstandingDue: allActive.reduce((s, x) => s + x.dueAmount, 0),
      returns: returns.reduce((s, x) => s + x.total, 0),
      averageOrderValue: allActive.length
        ? Math.round(allActive.reduce((s, x) => s + x.total, 0) / allActive.length)
        : 0,
    }
  },

  getAnalytics(filters: { branchId?: string; days?: number } = {}) {
    const db = peekDatabase()
    const days = filters.days ?? 14
    const trend: { label: string; sales: number; collections: number; returns: number }[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      const daySales = db.sales.filter(
        (s) =>
          !s.deleted_at &&
          s.status !== 'Cancelled' &&
          s.created_at.slice(0, 10) === key &&
          (!filters.branchId || filters.branchId === 'all' || s.branchId === filters.branchId),
      )
      const dayReturns = db.saleReturns.filter((r) => r.created_at.slice(0, 10) === key)
      trend.push({
        label,
        sales: daySales.reduce((s, x) => s + x.total, 0),
        collections: daySales.reduce((s, x) => s + x.paidAmount, 0),
        returns: dayReturns.reduce((s, x) => s + x.total, 0),
      })
    }

    const channelMap = new Map<string, number>()
    const paymentMap = new Map<string, number>()
    const productMap = new Map<string, { name: string; qty: number; revenue: number }>()
    const personMap = new Map<string, { name: string; sales: number; orders: number }>()

    for (const sale of db.sales.filter(
      (s) =>
        !s.deleted_at &&
        s.status !== 'Cancelled' &&
        s.status !== 'Returned' &&
        (!filters.branchId || filters.branchId === 'all' || s.branchId === filters.branchId),
    )) {
      channelMap.set(sale.channel, (channelMap.get(sale.channel) ?? 0) + sale.total)
      paymentMap.set(sale.paymentMethod, (paymentMap.get(sale.paymentMethod) ?? 0) + sale.paidAmount)
      for (const item of sale.items) {
        const row = productMap.get(item.productId) ?? { name: item.name, qty: 0, revenue: 0 }
        row.qty += item.quantity
        row.revenue += item.total
        productMap.set(item.productId, row)
      }
      const emp = db.employees.find((e) => e.id === sale.salespersonId)
      const prow = personMap.get(sale.salespersonId) ?? {
        name: emp?.name ?? '—',
        sales: 0,
        orders: 0,
      }
      prow.sales += sale.total
      prow.orders += 1
      personMap.set(sale.salespersonId, prow)
    }

    const byChannel = [...channelMap.entries()].map(([channel, sales]) => ({ channel, sales }))
    const byPayment = [...paymentMap.entries()].map(([method, amount]) => ({ method, amount }))
    const topProducts = [...productMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8)
    const salespersonPerformance = [...personMap.values()].sort((a, b) => b.sales - a.sales)

    return { trend, byChannel, byPayment, topProducts, salespersonPerformance }
  },

  getTodayStats(branchId?: string) {
    const kpis = this.getDashboardKpis({ branchId })
    return {
      salesCount: this.list({
        from: new Date().toISOString().slice(0, 10),
        to: new Date().toISOString().slice(0, 10),
        branchId,
      }).length,
      salesTotal: kpis.todaySales,
      collection: kpis.collections,
      due: kpis.outstandingDue,
    }
  },
}
