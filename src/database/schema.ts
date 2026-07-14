export type ErpRole =
  | 'Super Admin'
  | 'Owner'
  | 'Branch Admin'
  | 'Sales Manager'
  | 'Accounts User'
  | 'HR User'
  | 'Salesperson'

export type SalesChannel =
  | 'Physical Shop'
  | 'Website'
  | 'Facebook'
  | 'WhatsApp'
  | 'Phone Order'
  | 'Marketplace'

export type PaymentMethod =
  | 'Cash'
  | 'Card'
  | 'bKash'
  | 'Nagad'
  | 'Bank Transfer'
  | 'COD'
  | 'Mixed'

export type StockMovementType =
  | 'Opening'
  | 'Purchase In'
  | 'Sale Out'
  | 'Sales Return In'
  | 'Purchase Return Out'
  | 'Transfer Out'
  | 'Transfer In'
  | 'Adjustment Increase'
  | 'Adjustment Decrease'
  | 'Damage'
  | 'Lost'
  | 'Reserve'
  | 'Release Reserve'

export type OrderLifecycleStatus =
  | 'Draft'
  | 'New'
  | 'Confirmed'
  | 'Packed'
  | 'Courier Ready'
  | 'Courier Booked'
  | 'Picked Up'
  | 'In Transit'
  | 'Delivered'
  | 'Cancelled'
  | 'Failed'
  | 'Returned'
  | 'Refunded'

export type CommissionStatus = 'Pending' | 'Approved' | 'Paid' | 'Reversed'
export type TransferStatus = 'Draft' | 'Requested' | 'Approved' | 'Dispatched' | 'Received'
export type AccountType = 'Cash' | 'Bank' | 'Mobile Banking'

export interface DatabaseMeta {
  version: number
  brand: string
  seededAt: string
  updatedAt: string
}

export interface AppSettings {
  companyName: string
  address: string
  phone: string
  email: string
  website: string
  currency: string
  lowStockThreshold: number
  deliveryCharge: number
  freeDeliveryThreshold: number
}

export interface Branch {
  id: string
  name: string
  code: string
  address: string
  phone: string
  isCentral: boolean
  isActive: boolean
  created_at: string
}

export interface User {
  id: string
  name: string
  email: string
  phone: string
  role: ErpRole
  branchId: string | null
  employeeId: string | null
  isActive: boolean
  password: string
}

export interface Role {
  id: string
  name: ErpRole
  permissions: string[]
}

export interface Employee {
  id: string
  name: string
  phone: string
  email: string
  department: string
  designation: string
  branchId: string
  joiningDate: string
  basicSalary: number
  commissionRule: 'fixed' | 'percent_sale' | 'percent_profit' | 'none'
  commissionValue: number
  deviceId: string
  status: 'active' | 'inactive'
  created_at: string
}

export interface Department {
  id: string
  name: string
}

export interface Designation {
  id: string
  name: string
  departmentId: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  date: string
  checkIn: string | null
  checkOut: string | null
  status: 'Present' | 'Late' | 'Early Leave' | 'Absent' | 'Leave' | 'Overtime'
  source: 'Biometric Device' | 'Mobile Check-in' | 'Manual Entry' | 'Admin Correction'
  notes: string
}

export interface LeaveRecord {
  id: string
  employeeId: string
  fromDate: string
  toDate: string
  type: 'Casual' | 'Sick' | 'Annual' | 'Unpaid'
  status: 'Pending' | 'Approved' | 'Rejected'
  reason: string
}

export interface Payroll {
  id: string
  employeeId: string
  month: string
  basicSalary: number
  overtime: number
  commission: number
  bonus: number
  absenceDeduction: number
  lateDeduction: number
  advance: number
  otherDeduction: number
  netSalary: number
  status: 'Draft' | 'Approved' | 'Paid'
  paidAt: string | null
  accountId: string | null
}

export interface Category {
  id: string
  name: string
  slug: string
}

export interface Brand {
  id: string
  name: string
}

export interface Product {
  id: string
  sku: string
  name: string
  categoryId: string
  brandId: string
  price: number
  cost: number
  salePrice?: number
  image: string
  status: 'active' | 'inactive'
  created_at: string
  deleted_at: string | null
}

export interface StockBalance {
  id: string
  productId: string
  branchId: string
  quantity: number
  reserved: number
  updated_at: string
}

export interface StockMovement {
  id: string
  productId: string
  branchId: string
  type: StockMovementType
  quantity: number
  referenceType: string
  referenceId: string
  note: string
  created_at: string
  created_by: string
}

export interface StockTransfer {
  id: string
  transferNo: string
  fromBranchId: string
  toBranchId: string
  status: TransferStatus
  items: { productId: string; quantity: number }[]
  note: string
  created_at: string
  dispatched_at: string | null
  received_at: string | null
}

export interface Supplier {
  id: string
  name: string
  phone: string
  email: string
  address: string
  status: 'active' | 'inactive'
  created_at: string
  deleted_at: string | null
}

export interface PurchaseItem {
  productId: string
  quantity: number
  unitCost: number
  discount: number
  total: number
}

export interface Purchase {
  id: string
  purchaseNo: string
  supplierId: string
  branchId: string
  items: PurchaseItem[]
  subtotal: number
  discount: number
  transportCost: number
  total: number
  paidAmount: number
  dueAmount: number
  accountId: string | null
  status: 'Draft' | 'Finalized' | 'Cancelled'
  note: string
  created_at: string
  finalized_at: string | null
}

export interface PurchaseReturn {
  id: string
  purchaseId: string
  supplierId: string
  branchId: string
  items: PurchaseItem[]
  total: number
  reason: string
  created_at: string
}

export interface SupplierPayment {
  id: string
  supplierId: string
  amount: number
  accountId: string
  reference: string
  note: string
  created_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string
  email: string
  address: string
  district: string
  totalOrders: number
  deliveredOrders: number
  returnedOrders: number
  totalSpent: number
  totalPaid: number
  currentDue: number
  preferredBranchId: string | null
  preferredChannel: SalesChannel | null
  status: 'active' | 'blocked' | 'archived'
  created_at: string
  deleted_at: string | null
}

export interface CustomerAddress {
  id: string
  customerId: string
  label: 'Home' | 'Office' | 'Other'
  fullName: string
  phone: string
  district: string
  area: string
  address: string
  isDefault: boolean
}

export interface SaleItem {
  productId: string
  name: string
  quantity: number
  unitPrice: number
  discount: number
  total: number
  cost: number
}

export type SaleStatus = 'Completed' | 'Partial Paid' | 'Processing' | 'Returned' | 'Cancelled'

export interface Sale {
  id: string
  saleNo: string
  customerId: string
  branchId: string
  salespersonId: string
  channel: SalesChannel
  items: SaleItem[]
  subtotal: number
  discount: number
  total: number
  paidAmount: number
  dueAmount: number
  paymentMethod: PaymentMethod
  accountId: string | null
  deliveryMethod: 'Pickup' | 'Home Delivery' | 'Courier'
  courierId: string | null
  note: string
  status: SaleStatus
  created_at: string
  updated_at: string
  deleted_at: string | null
  idempotencyKey: string
}

export interface SaleReturn {
  id: string
  saleId: string
  items: SaleItem[]
  total: number
  reason: string
  created_at: string
}

export interface OrderItem {
  productId: string
  name: string
  sku: string
  quantity: number
  unitPrice: number
  total: number
}

export interface Order {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  district: string
  branchId: string
  items: OrderItem[]
  subtotal: number
  deliveryCharge: number
  total: number
  paymentMethod: PaymentMethod
  paymentStatus: 'pending' | 'collected' | 'refunded'
  status: OrderLifecycleStatus
  source: 'Website' | 'Admin' | 'Phone' | 'Facebook' | 'WhatsApp'
  courierId: string | null
  trackingId: string | null
  courierCharge: number
  note: string
  timeline: { status: string; at: string; note: string }[]
  reserved: boolean
  stockFinalized: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Collection {
  id: string
  customerId: string
  saleId: string | null
  amount: number
  accountId: string
  reference: string
  note: string
  created_at: string
}

export interface CourierBooking {
  id: string
  orderId: string
  courierName: string
  consignmentId: string
  charge: number
  codAmount: number
  status: 'Booked' | 'Picked Up' | 'In Transit' | 'Delivered' | 'Failed' | 'Returned' | 'Cancelled'
  booked_at: string
  updated_at: string
}

export interface CourierSettlement {
  id: string
  courierName: string
  orderId: string
  codAmount: number
  courierCharge: number
  returnCharge: number
  settlementAmount: number
  status: 'Pending' | 'Settled'
  settlementDate: string | null
}

export interface FinancialAccount {
  id: string
  name: string
  type: AccountType
  branchId: string | null
  balance: number
  isActive: boolean
}

export interface FinancialTransaction {
  id: string
  accountId: string
  type: 'Income' | 'Expense' | 'Transfer'
  category: string
  amount: number
  referenceType: string
  referenceId: string
  description: string
  created_at: string
  created_by: string
}

export interface Commission {
  id: string
  employeeId: string
  saleId: string
  amount: number
  status: CommissionStatus
  created_at: string
  paid_at: string | null
}

export interface ActivityLog {
  id: string
  action: string
  entityType: string
  entityId: string
  userName: string
  details: string
  created_at: string
}

export interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'warning' | 'success' | 'danger'
  read: boolean
  created_at: string
}

export interface ERPDatabase {
  meta: DatabaseMeta
  settings: AppSettings
  branches: Branch[]
  users: User[]
  roles: Role[]
  employees: Employee[]
  departments: Department[]
  designations: Designation[]
  attendance: AttendanceRecord[]
  leaves: LeaveRecord[]
  payrolls: Payroll[]
  products: Product[]
  categories: Category[]
  brands: Brand[]
  stockBalances: StockBalance[]
  stockMovements: StockMovement[]
  stockTransfers: StockTransfer[]
  suppliers: Supplier[]
  purchases: Purchase[]
  purchaseReturns: PurchaseReturn[]
  supplierPayments: SupplierPayment[]
  customers: Customer[]
  addresses: CustomerAddress[]
  sales: Sale[]
  saleReturns: SaleReturn[]
  orders: Order[]
  collections: Collection[]
  courierBookings: CourierBooking[]
  courierSettlements: CourierSettlement[]
  financialAccounts: FinancialAccount[]
  financialTransactions: FinancialTransaction[]
  commissions: Commission[]
  activities: ActivityLog[]
  notifications: Notification[]
}

export const ERP_DB_KEY = 'glamourous_by_mahi_erp_v1'
export const ERP_DB_VERSION = 2
