export type CustomerFinancialStatus = 'due' | 'advance' | 'settled'
export type CustomerRatingStatus = 'unrated' | 'provisional' | 'rated'

export type PosCustomerSummary = {
  id: string
  name: string
  phone: string
  email: string | null
  address: string | null
  district: string | null
  status: string
  current_due: number
  current_advance: number
  total_spent: number
  total_paid: number
  completed_orders: number
  return_count: number
  return_total: number
  last_purchase_at: string | null
  rating: number | null
  rating_status: CustomerRatingStatus
  financial_status: CustomerFinancialStatus
}

export type CustomerRecentOrder = {
  id: string
  invoice_no: string
  status: string
  fulfilment_status: string | null
  channel: string | null
  order_source: string | null
  grand_total: number
  due_total: number
  created_at: string
  completed_at: string | null
}

export type TopCustomerRow = {
  id: string
  name: string
  phone: string
  current_due: number
  current_advance: number
  total_spent: number
  status: string
  rating: number | null
  rating_status: CustomerRatingStatus
  completed_orders: number
  return_total: number
  last_purchase_at: string | null
  rank?: number
}
