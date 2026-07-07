export const APP_NAME = 'SMART ORDER MS'
export const APP_VERSION = '1.0.0'
export const COMPANY_NAME = 'Code Bondhu IT'

export const COLORS = {
  primary: '#EF4444',
  primaryDark: '#E11D48',
  sidebar: '#0B0F15',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  border: '#E5E7EB',
  background: '#F8FAFC',
  card: '#FFFFFF',
} as const

export const ROLES = [
  'Super Admin',
  'Admin',
  'Order Manager',
  'Courier Operator',
  'Customer Support',
] as const

export type UserRole = (typeof ROLES)[number]

export const ORDER_STATUSES = [
  'New',
  'Confirmed',
  'Packed',
  'Courier Booked',
  'Shipped',
  'Delivered',
  'Returned',
  'Cancelled',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const PAYMENT_STATUSES = ['pending', 'collected', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const LOW_STOCK_THRESHOLD = 10

export const FRAUD_LEVELS = ['SAFE', 'MEDIUM', 'HIGH', 'BLOCKED'] as const
export type FraudLevel = (typeof FRAUD_LEVELS)[number]

export const SIDEBAR_WIDTH = 260
