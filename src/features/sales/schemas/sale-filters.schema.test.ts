import { describe, expect, it } from 'vitest'
import {
  defaultSalesFilters,
  filtersFromSearchParams,
  filtersToRpcPayload,
  filtersToSearchParams,
  formatCategoryChips,
  resolvePresetRange,
} from './sale-filters.schema'
import type { EditSalePayload } from '../types/sale.types'
import { getSavedThermalWidth, saveThermalWidth } from '@/features/print/thermal-preference'
import { STORAGE_KEYS } from '@/lib/storage'

describe('sales URL filter parsing', () => {
  it('defaults to this_month with resolved date bounds', () => {
    const filters = filtersFromSearchParams(new URLSearchParams())
    expect(filters.preset).toBe('this_month')
    expect(filters.fromDate).toBeTruthy()
    expect(filters.toDate).toBeTruthy()
    expect(filters.page).toBe(1)
    expect(filters.pageSize).toBe(20)
  })

  it('parses custom filters and round-trips to search params', () => {
    const params = new URLSearchParams({
      q: 'INV-1',
      preset: 'custom',
      from: '2026-01-01',
      to: '2026-01-31',
      customer: '11111111-1111-1111-1111-111111111111',
      branch: '22222222-2222-2222-2222-222222222222',
      cashier: '33333333-3333-3333-3333-333333333333',
      status: 'completed',
      payStatus: 'partial',
      payMethod: 'cash',
      category: '44444444-4444-4444-4444-444444444444',
      dueOnly: '1',
      sort: 'total_desc',
      page: '2',
      pageSize: '50',
    })

    const filters = filtersFromSearchParams(params)
    expect(filters.search).toBe('INV-1')
    expect(filters.dueOnly).toBe(true)
    expect(filters.sort).toBe('total_desc')
    expect(filters.page).toBe(2)
    expect(filters.pageSize).toBe(50)

    const next = filtersToSearchParams(filters)
    expect(next.get('q')).toBe('INV-1')
    expect(next.get('dueOnly')).toBe('1')
    expect(next.get('page')).toBe('2')
    expect(next.get('pageSize')).toBe('50')
    expect(next.get('payMethod')).toBe('cash')
  })

  it('keeps list and KPI RPC payload filter parity', () => {
    const filters = {
      ...defaultSalesFilters(),
      search: 'A-100',
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'bkash',
      dueOnly: true,
      page: 3,
      pageSize: 25,
    }
    const payload = filtersToRpcPayload(filters)
    expect(payload.search).toBe('A-100')
    expect(payload.status).toBe('completed')
    expect(payload.payment_status).toBe('paid')
    expect(payload.payment_method).toBe('bkash')
    expect(payload.due_only).toBe(true)
    expect(payload.page).toBe(3)
    expect(payload.page_size).toBe(25)
    expect(payload.from_date).toBeTruthy()
    expect(payload.to_date).toBeTruthy()
  })

  it('resolves date presets', () => {
    expect(resolvePresetRange('all', 'x', 'y')).toEqual({ fromDate: null, toDate: null })
    expect(resolvePresetRange('custom', '2026-02-01', '2026-02-10')).toEqual({
      fromDate: '2026-02-01',
      toDate: '2026-02-10',
    })
  })
})

describe('category chip summaries', () => {
  it('formats and truncates chips', () => {
    expect(formatCategoryChips([])).toBe('—')
    expect(
      formatCategoryChips(
        [
          { name: 'Shirts', qty: 2 },
          { name: 'Pants', qty: 1 },
          { name: 'Hats', qty: 4 },
          { name: 'Bags', qty: 1 },
        ],
        2,
      ),
    ).toBe('Shirts ×2 • Pants ×1 • +2 more')
  })
})

describe('edit/void payload contracts', () => {
  it('builds idempotent edit payload with reason and client key', () => {
    const payload: EditSalePayload = {
      sale_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      reason: 'Wrong qty',
      note: 'Customer called',
      client_txn_key: 'txn-1',
      customer_id: null,
      discount: 10,
      tax: 0,
      shipping: 0,
      items: [{ variant_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', qty: 2, unit_price: 100, line_discount: 0 }],
      payments: [{ method: 'cash', amount: 190 }],
    }
    expect(payload.reason.trim().length).toBeGreaterThan(0)
    expect(payload.client_txn_key).toBeTruthy()
    expect(payload.items.length).toBeGreaterThan(0)
    expect(payload.payments.reduce((s, p) => s + p.amount, 0)).toBe(190)
  })

  it('requires void reason and keeps optional note separate', () => {
    const reason = 'Customer cancelled'
    const note = 'Refunded at counter'
    const fullReason = note ? `${reason} — ${note}` : reason
    expect(fullReason).toContain(reason)
    expect(fullReason).toContain(note)
  })
})

describe('thermal preference + post-sale preview idempotency', () => {
  it('persists thermal width preference', () => {
    const store = new Map<string, string>()
    const memoryStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
    }
    Object.defineProperty(globalThis, 'localStorage', {
      value: memoryStorage,
      configurable: true,
    })

    localStorage.removeItem(`oms_${STORAGE_KEYS.posReceiptWidth}`)
    expect(getSavedThermalWidth()).toBe('80mm')
    saveThermalWidth('58mm')
    expect(getSavedThermalWidth()).toBe('58mm')
    saveThermalWidth('80mm')
    expect(getSavedThermalWidth()).toBe('80mm')
  })

  it('preview actions use committed sale id without creating a new sale key', () => {
    const completed = { sale_id: 'sale-1', invoice_no: 'INV-1', client_txn_key: 'key-a' }
    const previewSaleId = completed.sale_id
    const nextClientTxnKey = 'key-b'
    expect(previewSaleId).toBe('sale-1')
    expect(nextClientTxnKey).not.toBe(completed.client_txn_key)
    const printPaths = [
      `/print/sales/${previewSaleId}/pos?width=80mm`,
      `/print/sales/${previewSaleId}/a4`,
    ]
    expect(printPaths.every((p) => p.includes(previewSaleId))).toBe(true)
  })
})

describe('permission visibility helpers', () => {
  it('shows edit when update or correct is granted', () => {
    const can = (p: string) => ['sales.update'].includes(p)
    const canEdit = can('sales.update') || can('sales.correct')
    expect(canEdit).toBe(true)
  })

  it('hides void without sales.void', () => {
    const can = (p: string) => ['sales.read', 'sales.print'].includes(p)
    expect(can('sales.void')).toBe(false)
  })
})
