import type { Collection, Customer } from '@/database/schema'
import {
  peekDatabase,
  runAtomic,
  TransactionError,
  withIdempotency,
} from '@/database/transaction'
import { logActivity, postFinance } from '@/database/repositories/finance.repository'
import {
  displayCustomerName,
  looksLikePhoneQuery,
  normalizeBdPhone,
  phoneSearchKey,
  phonesMatch,
} from '@/lib/phone-utils'

export interface CreateCustomerInput {
  phone: string
  name?: string
  email?: string
  address?: string
  district?: string
  notes?: string
  preferredBranchId?: string | null
  userName: string
}

export class DuplicateCustomerError extends Error {
  existing: Customer
  constructor(existing: Customer) {
    super('A customer with this mobile number already exists.')
    this.name = 'DuplicateCustomerError'
    this.existing = existing
  }
}

export const customersService = {
  list(): Customer[] {
    return peekDatabase().customers.filter((c) => !c.deleted_at && c.status !== 'archived')
  },

  getById(id: string): Customer | null {
    return this.list().find((c) => c.id === id) ?? null
  },

  findCustomerByPhone(phone: string): Customer | null {
    const normalized = normalizeBdPhone(phone)
    if (!normalized) return null
    return this.list().find((c) => phonesMatch(c.phone, normalized)) ?? null
  },

  searchCustomers(query: string, limit = 10): Customer[] {
    const q = query.trim().toLowerCase()
    if (!q) return this.list().slice(0, limit)

    const phoneKey = phoneSearchKey(q)
    const isPhone = looksLikePhoneQuery(q)

    const scored = this.list()
      .map((c) => {
        const name = c.name.toLowerCase()
        const phone = phoneSearchKey(c.phone)
        let score = 0
        if (isPhone && phoneKey) {
          if (phone === phoneKey) score = 100
          else if (phone.startsWith(phoneKey)) score = 80
          else if (phone.includes(phoneKey)) score = 60
        }
        if (name.includes(q)) score = Math.max(score, name.startsWith(q) ? 90 : 50)
        if (c.email?.toLowerCase().includes(q)) score = Math.max(score, 30)
        return { c, score }
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.c.created_at.localeCompare(a.c.created_at))

    return scored.slice(0, limit).map((x) => x.c)
  },

  /** @deprecated use searchCustomers */
  search(query: string) {
    return this.searchCustomers(query, 50)
  },

  createCustomer(input: CreateCustomerInput): Customer {
    const normalized = normalizeBdPhone(input.phone)
    if (!normalized) {
      throw new TransactionError('Enter a valid Bangladesh mobile number (01XXXXXXXXX).')
    }

    const existing = this.findCustomerByPhone(normalized)
    if (existing) throw new DuplicateCustomerError(existing)

    const name = input.name?.trim() || displayCustomerName('', normalized)

    return runAtomic(`customer:create:${normalized}`, (db) => {
      const again = db.customers.find(
        (c) => !c.deleted_at && phonesMatch(c.phone, normalized),
      )
      if (again) throw new DuplicateCustomerError(again)

      const customer: Customer = {
        id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        phone: normalized,
        email: input.email?.trim() ?? '',
        address: input.address?.trim() ?? '',
        district: input.district?.trim() ?? '',
        totalOrders: 0,
        deliveredOrders: 0,
        returnedOrders: 0,
        totalSpent: 0,
        totalPaid: 0,
        currentDue: 0,
        preferredBranchId: input.preferredBranchId ?? null,
        preferredChannel: null,
        status: 'active',
        created_at: new Date().toISOString(),
        deleted_at: null,
      }

      db.customers.unshift(customer)
      logActivity(db, {
        action: 'Customer Created',
        entityType: 'customer',
        entityId: customer.id,
        userName: input.userName,
        details: `${customer.name} · ${customer.phone}${input.notes ? ` · ${input.notes}` : ''}`,
      })
      return customer
    })
  },

  collect(input: {
    customerId: string
    amount: number
    accountId: string
    note?: string
    idempotencyKey: string
    userName: string
  }): Collection {
    return withIdempotency(
      input.idempotencyKey,
      (db) => db.collections.find((c) => c.id === `col_${input.idempotencyKey}`) ?? null,
      (db) => {
        const customer = db.customers.find((c) => c.id === input.customerId)
        if (!customer) throw new TransactionError('Customer not found')
        if (input.amount <= 0) throw new TransactionError('Amount must be greater than zero')
        if (input.amount > customer.currentDue) {
          throw new TransactionError(`Collection exceeds customer due (৳${customer.currentDue})`)
        }

        postFinance(db, {
          accountId: input.accountId,
          type: 'Income',
          category: 'Customer Collection',
          amount: input.amount,
          referenceType: 'collection',
          referenceId: `col_${input.idempotencyKey}`,
          description: `Collection from ${customer.name}`,
          userName: input.userName,
        })

        customer.currentDue -= input.amount
        customer.totalPaid += input.amount

        let remaining = input.amount
        const dueSales = db.sales
          .filter((s) => s.customerId === customer.id && s.dueAmount > 0)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
        for (const sale of dueSales) {
          if (remaining <= 0) break
          const apply = Math.min(remaining, sale.dueAmount)
          sale.dueAmount -= apply
          sale.paidAmount += apply
          remaining -= apply
          if (sale.dueAmount === 0) {
            db.commissions
              .filter((c) => c.saleId === sale.id && c.status === 'Pending')
              .forEach((c) => {
                c.status = 'Approved'
              })
          }
        }

        const collection: Collection = {
          id: `col_${input.idempotencyKey}`,
          customerId: customer.id,
          saleId: null,
          amount: input.amount,
          accountId: input.accountId,
          reference: `COL-${Date.now().toString().slice(-6)}`,
          note: input.note ?? '',
          created_at: new Date().toISOString(),
        }
        db.collections.unshift(collection)
        logActivity(db, {
          action: 'Customer Collection',
          entityType: 'customer',
          entityId: customer.id,
          userName: input.userName,
          details: `৳${input.amount} from ${customer.name}`,
        })
        return collection
      },
    )
  },
}
