import type { BaseEntity } from '@/types'

export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'void'

export interface Invoice extends BaseEntity {
  invoice_no: string
  order_id: string
  order_number: string
  customer_id?: string
  customer_name: string
  store_id: string
  store_name: string
  invoice_date: string
  amount: number
  status: InvoiceStatus
  print_count: number
  last_printed_at?: string | null
}

export interface InvoiceFilters {
  search?: string
  status?: InvoiceStatus | 'all'
  store?: string
  date_from?: string
  date_to?: string
  include_deleted?: boolean
}

export interface InvoiceStats {
  total: number
  issued: number
  paid: number
  void: number
  total_amount: number
}

export interface CreateInvoiceInput {
  order_id: string
  status?: InvoiceStatus
}

export interface UpdateInvoiceInput {
  status?: InvoiceStatus
  print_count?: number
  last_printed_at?: string | null
}
