export { CustomerSummaryCard } from './components/CustomerSummaryCard'
export { CustomerRecentOrders } from './components/CustomerRecentOrders'
export { CustomersAdminPage } from './pages/CustomersAdminPage'
export { CustomerDetailPage, CustomerProfilePage } from './pages/CustomerProfilePage'
export { CustomersPage } from './CustomersPage'
export { customersRepository } from './repositories/customers.repository'
export type {
  Customer,
  CustomerInput,
  CustomerFilters,
  CustomerLedgerStatement,
} from './repositories/customers.repository'
export type { CustomerProfileTab } from './types/customer-profile.types'
