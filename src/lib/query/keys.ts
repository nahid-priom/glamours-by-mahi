export const queryKeys = {
  session: ['session'] as const,
  profile: ['profile'] as const,
  permissions: ['permissions'] as const,
  branches: ['branches'] as const,
  products: (filters: Record<string, unknown>) => ['products', filters] as const,
  product: (id: string) => ['product', id] as const,
  categories: (filters: Record<string, unknown> = {}) => ['categories', filters] as const,
  subcategories: (filters: Record<string, unknown> = {}) => ['subcategories', filters] as const,
  brands: (filters: Record<string, unknown> = {}) => ['brands', filters] as const,
  variants: (filters: Record<string, unknown> = {}) => ['variants', filters] as const,
  posProducts: (branchId: string, cursor?: string | null) =>
    ['pos-products', branchId, cursor ?? null] as const,
  productVariantByBarcode: (branchId: string, barcode: string) =>
    ['variant-barcode', branchId, barcode] as const,
  posPaymentMethods: ['pos-payment-methods'] as const,
  posFinancialAccounts: (branchId: string) => ['pos-financial-accounts', branchId] as const,
  customers: (q: string) => ['customers', q] as const,
  customersAdmin: (filters: Record<string, unknown> = {}) => ['customers-admin', filters] as const,
  customer: (id: string) => ['customer', id] as const,
  suppliers: (filters: Record<string, unknown> = {}) => ['suppliers', filters] as const,
  supplier: (id: string) => ['supplier', id] as const,
  dashboard: (filters: Record<string, unknown> = {}) => ['dashboard', filters] as const,
  dashboardBranches: ['dashboard-branches'] as const,
  sales: (filters: Record<string, unknown>) => ['sales', filters] as const,
  salesKpis: (filters: Record<string, unknown>) => ['sales-kpis', filters] as const,
  sale: (id: string) => ['sale', id] as const,
  saleReturns: (filters: Record<string, unknown> = {}) => ['sale-returns', filters] as const,
  heldSales: ['held-sales'] as const,
  inventory: (filters: Record<string, unknown>) => ['inventory', filters] as const,
  stockOverview: (filters: Record<string, unknown> = {}) => ['stock-overview', filters] as const,
  stockLedger: (filters: Record<string, unknown> = {}) => ['stock-ledger', filters] as const,
  lowStock: (filters: Record<string, unknown> = {}) => ['low-stock', filters] as const,
  stockTransfers: (filters: Record<string, unknown> = {}) => ['stock-transfers', filters] as const,
  stockTransfer: (id: string) => ['stock-transfer', id] as const,
  stockLocations: (branchId: string) => ['stock-locations', branchId] as const,
  inventoryValuationSummary: (filters: Record<string, unknown> = {}) =>
    ['inventory-valuation-summary', filters] as const,
  inventoryBranchSummary: (includeNonSaleable: boolean) =>
    ['inventory-branch-summary', includeNonSaleable] as const,
  inventoryStockBreakdown: (filters: Record<string, unknown> = {}) =>
    ['inventory-stock-breakdown', filters] as const,
  accounts: ['accounts'] as const,
  couriers: ['couriers'] as const,
  paymentMethods: ['payment-methods'] as const,
  purchases: (filters: Record<string, unknown> = {}) => ['purchases', filters] as const,
  purchase: (id: string) => ['purchase', id] as const,
  purchaseReturns: (filters: Record<string, unknown> = {}) =>
    ['purchase-returns', filters] as const,
  inventoryBalances: (filters: Record<string, unknown> = {}) =>
    ['inventory-balances', filters] as const,
  customersLedger: (customerId: string) => ['customers-ledger', customerId] as const,
  suppliersLedger: (supplierId: string) => ['suppliers-ledger', supplierId] as const,
  accountingAccounts: (filters: Record<string, unknown> = {}) =>
    ['accounting-accounts', filters] as const,
  accountingTransactions: (filters: Record<string, unknown> = {}) =>
    ['accounting-transactions', filters] as const,
  onlineOrders: (filters: Record<string, unknown> = {}) =>
    ['online-orders', filters] as const,
  reconciliationReport: () => ['reconciliation-report'] as const,
  reports: (name: string, filters: Record<string, unknown> = {}) =>
    ['reports', name, filters] as const,
}
