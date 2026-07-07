import type {
  ChartDataPoint,
  CourierPerformanceRow,
  DeliveryProgressItem,
  FraudSummary,
  OrderAutomationStatus,
  PickupQueueItem,
  SmartAlert,
  TopStoreRow,
} from '@/types'

export const KPI_DATA = [
  { id: '1', title: 'Total Orders Today', value: 18735, trend: 8.2, trend_label: 'vs yesterday', icon: 'Package', color: 'bg-red-50 text-primary' },
  { id: '2', title: 'Delivered', value: 14842, trend: 5.4, trend_label: 'vs yesterday', icon: 'CheckCircle', color: 'bg-green-50 text-success' },
  { id: '3', title: 'Pending', value: 3215, trend: -2.1, trend_label: 'vs yesterday', icon: 'Clock', color: 'bg-amber-50 text-warning' },
  { id: '4', title: 'Failed / Returned', value: 678, trend: -1.3, trend_label: 'vs yesterday', icon: 'XCircle', color: 'bg-red-50 text-danger' },
  { id: '5', title: 'Total COD Amount', value: 48750000, trend: 12.5, trend_label: 'vs yesterday', icon: 'Banknote', color: 'bg-blue-50 text-blue-600', isCurrency: true },
  { id: '6', title: "Today's Collection", value: 9850000, trend: 6.8, trend_label: 'vs yesterday', icon: 'Wallet', color: 'bg-emerald-50 text-emerald-600', isCurrency: true },
  { id: '7', title: "Today's Profit", value: 1245000, trend: 9.2, trend_label: 'vs yesterday', icon: 'TrendingUp', color: 'bg-purple-50 text-purple-600', isCurrency: true },
] as const

export const CASH_FLOW_DATA: ChartDataPoint[] = [
  { name: 'Mon', cashIn: 820000, cashOut: 450000 },
  { name: 'Tue', cashIn: 950000, cashOut: 520000 },
  { name: 'Wed', cashIn: 1100000, cashOut: 480000 },
  { name: 'Thu', cashIn: 890000, cashOut: 610000 },
  { name: 'Fri', cashIn: 1250000, cashOut: 550000 },
  { name: 'Sat', cashIn: 1400000, cashOut: 620000 },
  { name: 'Sun', cashIn: 985000, cashOut: 410000 },
]

export const PROFIT_TREND_DATA: ChartDataPoint[] = [
  { name: 'Mon', profit: 180000 },
  { name: 'Tue', profit: 210000 },
  { name: 'Wed', profit: 245000 },
  { name: 'Thu', profit: 195000 },
  { name: 'Fri', profit: 280000 },
  { name: 'Sat', profit: 320000 },
  { name: 'Sun', profit: 215000 },
]

export const BALANCE_CARDS = [
  { label: 'Cash Balance', amount: 2450000, color: 'text-success' },
  { label: 'bKash Balance', amount: 1850000, color: 'text-pink-600' },
  { label: 'Bank Balance', amount: 5200000, color: 'text-blue-600' },
]

export const ORDER_STATUS_DATA = [
  { name: 'Delivered', value: 79.3, color: '#22C55E' },
  { name: 'Pending', value: 17.2, color: '#F59E0B' },
  { name: 'Returned', value: 3.6, color: '#EF4444' },
]

export const PICKUP_QUEUE: PickupQueueItem[] = [
  { hub: 'Dhanmondi Hub', count: 256 },
  { hub: 'Gulshan Hub', count: 189 },
  { hub: 'Uttara Hub', count: 312 },
  { hub: 'Chattogram Hub', count: 278 },
  { hub: 'Sylhet Hub', count: 165 },
]

export const DELIVERY_PROGRESS: DeliveryProgressItem[] = [
  { zone: 'Dhaka Zone', progress: 85 },
  { zone: 'Gulshan Zone', progress: 78 },
  { zone: 'Uttara Zone', progress: 72 },
  { zone: 'Chattogram Zone', progress: 68 },
  { zone: 'Sylhet Zone', progress: 65 },
]

export const TOP_STORES: TopStoreRow[] = [
  { store: 'Pickaboo', orders: 4250, collection: 12500000, growth: 15.2 },
  { store: 'Daraz Bangladesh', orders: 3890, collection: 9800000, growth: 8.5 },
  { store: 'Evaly', orders: 3120, collection: 7200000, growth: -3.2 },
  { store: 'AjkerDeal', orders: 2780, collection: 6500000, growth: 12.1 },
  { store: 'Electro Mart', orders: 1950, collection: 4800000, growth: 6.8 },
]

export const COURIER_PERFORMANCE: CourierPerformanceRow[] = [
  { courier: 'Steadfast', deliveries: 4520, success_rate: 97.2, rating: 4.8 },
  { courier: 'Pathao', deliveries: 3890, success_rate: 95.8, rating: 4.6 },
  { courier: 'RedX', deliveries: 3210, success_rate: 94.5, rating: 4.5 },
  { courier: 'eCourier', deliveries: 2780, success_rate: 93.2, rating: 4.3 },
  { courier: 'Paperfly', deliveries: 1950, success_rate: 91.8, rating: 4.1 },
]

export const SMART_ALERTS: SmartAlert[] = [
  { id: '1', title: 'Cash Short Alert', description: 'Dhanmondi hub cash balance below threshold', type: 'warning', time: '5 min ago' },
  { id: '2', title: 'Merchant Payment Pending', description: '3 store payouts awaiting approval', type: 'info', time: '12 min ago' },
  { id: '3', title: 'High Fraud Risk Orders', description: '8 orders flagged for review', type: 'danger', time: '18 min ago' },
  { id: '4', title: 'Courier Delay Alert', description: 'Pathao API response degraded', type: 'warning', time: '25 min ago' },
]

export const FRAUD_SUMMARY: FraudSummary = {
  safe: 12450,
  medium: 856,
  high: 124,
  blocked: 38,
  needs_call: 67,
}

export const ORDER_AUTOMATION: OrderAutomationStatus[] = [
  { status: 'New', count: 245 },
  { status: 'Confirmed', count: 512 },
  { status: 'Packed', count: 389 },
  { status: 'Courier Booked', count: 678 },
  { status: 'Delivered', count: 14842 },
  { status: 'Returned', count: 678 },
  { status: 'Cancelled', count: 156 },
  { status: 'High Fraud Risk', count: 24 },
]

export const ANALYTICS_CARDS = [
  { title: 'Delivery Success Rate', value: '96.4%', subtitle: '+1.2% this week', color: 'text-success' },
  { title: 'Weekly Growth', value: '12.8%', subtitle: 'Revenue increase', color: 'text-primary' },
  { title: 'Business Health Score', value: '87/100', subtitle: 'Good', color: 'text-blue-600' },
]
