import type { Permission } from '@/lib/permissions/catalog'

export type ReportCategory = 'sales' | 'inventory' | 'finance' | 'logistics' | 'hr'

export type ReportFilterKey =
  | 'dateRange'
  | 'branch'
  | 'customer'
  | 'supplier'
  | 'product'
  | 'salesperson'
  | 'paymentMethod'
  | 'channel'
  | 'status'
  | 'search'

export type ReportExportFormat = 'csv' | 'print'

export type ReportStatus = 'available' | 'gated' | 'deprecated'

export type ReportDefinition = {
  id: string
  title: string
  description: string
  category: ReportCategory
  path: string
  requiredPermissions: Permission[]
  /** OR of any permission in the list grants access when length > 0 beyond reports.read */
  extraPermissionsAny?: Permission[]
  supportedFilters: ReportFilterKey[]
  supportedExports: ReportExportFormat[]
  status: ReportStatus
  gatedReason?: string
}

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  sales: 'Sales & performance',
  inventory: 'Inventory & purchase',
  finance: 'Finance & accounts',
  logistics: 'Courier & delivery',
  hr: 'Employees & payroll',
}

export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: 'sales',
    title: 'Sales Register',
    description: 'Completed sales by period (document authority)',
    category: 'sales',
    path: '/reports/sales',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'branch', 'customer', 'salesperson', 'status', 'search'],
    supportedExports: ['csv', 'print'],
    status: 'available',
  },
  {
    id: 'returns',
    title: 'Sales Returns & Exchanges',
    description: 'Posted returns and exchange settlements',
    category: 'sales',
    path: '/reports/returns',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'branch', 'customer', 'status', 'search'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'top-customers',
    title: 'Top Customers',
    description: 'Ranked by rating and period spend',
    category: 'sales',
    path: '/reports/top-customers',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'product-performance',
    title: 'Product Performance',
    description: 'Variant revenue with historical COGS margin',
    category: 'sales',
    path: '/reports/product-performance',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'branch'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'variant-performance',
    title: 'Variant-wise Performance',
    description: 'Alias of Product Performance at variant/SKU level',
    category: 'sales',
    path: '/reports/variant-performance',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'branch'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'branch',
    title: 'Branch Performance',
    description: 'Sales totals by original branch attribution',
    category: 'sales',
    path: '/reports/branch',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'salesperson',
    title: 'Salesperson Performance',
    description: 'Performance by attributed staff',
    category: 'sales',
    path: '/reports/salesperson',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'channels',
    title: 'Sales Channel Performance',
    description: 'Revenue by order_source (POS, ecommerce, etc.)',
    category: 'sales',
    path: '/reports/channels',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'branch'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'purchases',
    title: 'Purchase Register',
    description: 'Completed purchase invoices (not OpEx)',
    category: 'inventory',
    path: '/reports/purchases',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'supplier', 'status'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'inventory',
    title: 'Stock Balance',
    description: 'On-hand qty; WAC cost when permitted',
    category: 'inventory',
    path: '/reports/inventory',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['branch', 'search'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'inventory-valuation',
    title: 'Inventory Valuation',
    description: 'Authoritative WAC stock value by branch',
    category: 'inventory',
    path: '/reports/inventory-valuation',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['inventory.valuation', 'products.manage_prices', 'accounts.read'],
    supportedFilters: ['branch'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'stock-aging',
    title: 'Stock Aging & Slow Moving',
    description: 'Inventory age / last-sale analysis',
    category: 'inventory',
    path: '/reports/stock-aging',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['branch'],
    supportedExports: [],
    status: 'gated',
    gatedReason: 'No authoritative last-sale or remaining-stock age SSOT yet.',
  },
  {
    id: 'supplier-due',
    title: 'Supplier Payables',
    description: 'Outstanding payables (party current_due)',
    category: 'inventory',
    path: '/reports/supplier-due',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['search'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'profit',
    title: 'Profit & Loss',
    description: 'Canonical get_profit_loss_report (same as Accounts)',
    category: 'finance',
    path: '/reports/profit',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['accounts.read', 'profit_loss.read'],
    supportedFilters: ['dateRange', 'branch'],
    supportedExports: ['csv', 'print'],
    status: 'available',
  },
  {
    id: 'customer-due',
    title: 'Customer Receivables',
    description: 'Outstanding receivables (party current_due)',
    category: 'finance',
    path: '/reports/customer-due',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['search'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'dues',
    title: 'Due Management',
    description: 'Accounts dues hub with aging and actions',
    category: 'finance',
    path: '/reports/dues',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['accounts.read'],
    supportedFilters: [],
    supportedExports: [],
    status: 'available',
  },
  {
    id: 'cash-book',
    title: 'Cash Book',
    description: 'Financial transactions (Accounts authority)',
    category: 'finance',
    path: '/reports/cash-book',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['accounts.read'],
    supportedFilters: ['dateRange'],
    supportedExports: [],
    status: 'available',
  },
  {
    id: 'reconciliation',
    title: 'Bank & Accounts Reconciliation',
    description: 'Canonical reconciliation report in Accounts',
    category: 'finance',
    path: '/accounts/reconciliation',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['accounts.read', 'accounts.manage'],
    supportedFilters: ['dateRange'],
    supportedExports: [],
    status: 'available',
  },
  {
    id: 'courier',
    title: 'Courier Performance',
    description: 'Parcels, delivery rates — COD collected ≠ settled',
    category: 'logistics',
    path: '/reports/courier',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['courier.read'],
    supportedFilters: ['dateRange'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'courier-returns',
    title: 'Courier Returns',
    description: 'Return requests (ops — not posted sale returns)',
    category: 'logistics',
    path: '/reports/courier-returns',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'status'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'cod-settlement',
    title: 'COD Settlement',
    description: 'Expected vs settled courier COD and charges',
    category: 'logistics',
    path: '/reports/cod-settlement',
    requiredPermissions: ['reports.read'],
    supportedFilters: ['dateRange', 'status'],
    supportedExports: ['csv'],
    status: 'available',
  },
  {
    id: 'payroll',
    title: 'Payroll Reports',
    description: 'Payroll run summaries (HR authority)',
    category: 'hr',
    path: '/reports/hr',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['hr.payroll.read'],
    supportedFilters: ['dateRange'],
    supportedExports: [],
    status: 'available',
  },
  {
    id: 'commissions',
    title: 'Sales Commission Reports',
    description: 'Commission accruals and payouts (HR authority)',
    category: 'hr',
    path: '/hr/commissions',
    requiredPermissions: ['reports.read'],
    extraPermissionsAny: ['sales.commission.read', 'sales.commission.manage'],
    supportedFilters: ['dateRange'],
    supportedExports: [],
    status: 'available',
  },
]

export function visibleReports(
  can: (permission: Permission | Permission[]) => boolean,
): ReportDefinition[] {
  return REPORT_REGISTRY.filter((r) => {
    if (r.status === 'deprecated') return false
    if (!can(r.requiredPermissions)) return false
    if (r.extraPermissionsAny?.length && !can(r.extraPermissionsAny)) return false
    return true
  })
}

export function reportsByCategory(
  reports: ReportDefinition[],
): Record<ReportCategory, ReportDefinition[]> {
  const out: Record<ReportCategory, ReportDefinition[]> = {
    sales: [],
    inventory: [],
    finance: [],
    logistics: [],
    hr: [],
  }
  for (const r of reports) out[r.category].push(r)
  return out
}
