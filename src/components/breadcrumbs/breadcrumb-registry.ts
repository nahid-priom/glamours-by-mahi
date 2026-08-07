export type BreadcrumbCrumb = {
  label: string
  to?: string
}

export type BreadcrumbResolver = (params: Record<string, string>) => BreadcrumbCrumb[] | null

/** Static route → crumb trail (last crumb is current page, usually without `to`). */
const STATIC_TRAILS: Array<{ pattern: RegExp; crumbs: BreadcrumbCrumb[] }> = [
  { pattern: /^\/dashboard\/?$/, crumbs: [{ label: 'Dashboard' }] },
  {
    pattern: /^\/sales\/pos\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'POS' }],
  },
  {
    pattern: /^\/sales\/held\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Held Sales' }],
  },
  {
    pattern: /^\/sales\/online-orders\/[^/]+\/approve\/?$/,
    crumbs: [
      { label: 'Sales', to: '/sales' },
      { label: 'Online Orders', to: '/sales/online-orders' },
      { label: 'Review & Approve' },
    ],
  },
  {
    pattern: /^\/sales\/online-orders\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Online Orders' }],
  },
  {
    pattern: /^\/sales\/exchanges\/new\/?$/,
    crumbs: [
      { label: 'Sales', to: '/sales' },
      { label: 'Exchanges', to: '/sales/exchanges' },
      { label: 'New Exchange' },
    ],
  },
  {
    pattern: /^\/sales\/exchanges\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Exchanges' }],
  },
  {
    pattern: /^\/sales\/returns\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Sales Returns' }],
  },
  {
    pattern: /^\/sales\/collections\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Due Collection' }],
  },
  {
    pattern: /^\/sales\/?$/,
    crumbs: [{ label: 'Sales', to: '/sales' }, { label: 'Sales History' }],
  },
  {
    pattern: /^\/moderator\/orders\/new\/?$/,
    crumbs: [
      { label: 'My Workspace', to: '/staff/dashboard' },
      { label: 'New Order' },
    ],
  },
  {
    pattern: /^\/moderator\/?$/,
    crumbs: [
      { label: 'My Workspace', to: '/staff/dashboard' },
      { label: 'Order intake' },
    ],
  },
  {
    pattern: /^\/staff\/dashboard\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'Dashboard' }],
  },
  {
    pattern: /^\/staff\/my-sales\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'My Sales' }],
  },
  {
    pattern: /^\/staff\/my-orders\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'My Orders' }],
  },
  {
    pattern: /^\/staff\/my-commission\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'My Commission' }],
  },
  {
    pattern: /^\/staff\/my-targets\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'My Targets' }],
  },
  {
    pattern: /^\/staff\/my-customers\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'My Customers' }],
  },
  {
    pattern: /^\/staff\/follow-ups\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'Follow-ups' }],
  },
  {
    pattern: /^\/staff\/profile\/?$/,
    crumbs: [{ label: 'My Workspace', to: '/staff/dashboard' }, { label: 'Profile' }],
  },
  {
    pattern: /^\/administration\/targets\/?$/,
    crumbs: [{ label: 'Administration', to: '/administration' }, { label: 'Staff Targets' }],
  },
  {
    pattern: /^\/products\/categories\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Categories' }],
  },
  {
    pattern: /^\/products\/subcategories\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Subcategories' }],
  },
  {
    pattern: /^\/products\/brands\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Brands' }],
  },
  {
    pattern: /^\/products\/variants\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Variants' }],
  },
  {
    pattern: /^\/products\/import\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Import' }],
  },
  {
    pattern: /^\/products\/new\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'New Product' }],
  },
  {
    pattern: /^\/products\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Products' }],
  },
  {
    pattern: /^\/inventory\/stock\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Stock Overview' }],
  },
  {
    pattern: /^\/inventory\/ledger\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Stock Ledger' }],
  },
  {
    pattern: /^\/inventory\/low-stock\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Low Stock' }],
  },
  {
    pattern: /^\/inventory\/adjustments\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Adjustments' }],
  },
  {
    pattern: /^\/inventory\/transfers\/new\/?$/,
    crumbs: [
      { label: 'Inventory', to: '/products' },
      { label: 'Transfers', to: '/inventory/transfers' },
      { label: 'New Transfer' },
    ],
  },
  {
    pattern: /^\/inventory\/transfers\/?$/,
    crumbs: [{ label: 'Inventory', to: '/products' }, { label: 'Transfers' }],
  },
  {
    pattern: /^\/purchases\/new\/?$/,
    crumbs: [{ label: 'Purchases', to: '/purchases' }, { label: 'New Purchase' }],
  },
  {
    pattern: /^\/purchases\/returns\/?$/,
    crumbs: [{ label: 'Purchases', to: '/purchases' }, { label: 'Returns' }],
  },
  {
    pattern: /^\/purchases\/payments\/?$/,
    crumbs: [
      { label: 'Accounts', to: '/accounts' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: 'Supplier Payment' },
    ],
  },
  {
    pattern: /^\/purchases\/?$/,
    crumbs: [{ label: 'Purchases', to: '/purchases' }, { label: 'History' }],
  },
  {
    pattern: /^\/suppliers\/new\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Suppliers', to: '/suppliers' }, { label: 'New' }],
  },
  {
    pattern: /^\/suppliers\/import\/?$/,
    crumbs: [
      { label: 'Accounts', to: '/accounts' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: 'Import' },
    ],
  },
  {
    pattern: /^\/suppliers\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Suppliers' }],
  },
  {
    pattern: /^\/customers\/new\/?$/,
    crumbs: [{ label: 'Customers', to: '/customers' }, { label: 'New Customer' }],
  },
  {
    pattern: /^\/customers\/import\/?$/,
    crumbs: [{ label: 'Customers', to: '/customers' }, { label: 'Import' }],
  },
  { pattern: /^\/customers\/?$/, crumbs: [{ label: 'Customers' }] },
  {
    pattern: /^\/couriers\/tracking\/?$/,
    crumbs: [{ label: 'Courier', to: '/couriers' }, { label: 'Tracking' }],
  },
  {
    pattern: /^\/couriers\/settlements\/?$/,
    crumbs: [{ label: 'Courier', to: '/couriers' }, { label: 'Settlements' }],
  },
  {
    pattern: /^\/couriers\/returns\/?$/,
    crumbs: [{ label: 'Courier', to: '/couriers' }, { label: 'Returns' }],
  },
  {
    pattern: /^\/couriers\/parcels\/?$/,
    crumbs: [{ label: 'Courier', to: '/couriers' }, { label: 'Parcels' }],
  },
  { pattern: /^\/couriers\/?$/, crumbs: [{ label: 'Courier' }] },
  { pattern: /^\/accounts\/?$/, crumbs: [{ label: 'Accounts' }] },
  {
    pattern: /^\/accounts\/cash-bank\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Cash & Bank' }],
  },
  {
    pattern: /^\/accounts\/income\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Income' }],
  },
  {
    pattern: /^\/accounts\/expenses\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Expenses' }],
  },
  {
    pattern: /^\/accounts\/dues\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Dues' }],
  },
  {
    pattern: /^\/accounts\/collections\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Collections' }],
  },
  {
    pattern: /^\/accounts\/daily-closing\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Daily Closing' }],
  },
  {
    pattern: /^\/accounts\/transactions\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Transactions' }],
  },
  {
    pattern: /^\/accounts\/profit-loss\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Profit & Loss' }],
  },
  {
    pattern: /^\/accounts\/reconciliation\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Reconciliation' }],
  },
  {
    pattern: /^\/accounts\/settings\/?$/,
    crumbs: [{ label: 'Accounts', to: '/accounts' }, { label: 'Settings' }],
  },
  { pattern: /^\/hr\/?$/, crumbs: [{ label: 'HR' }] },
  {
    pattern: /^\/hr\/employees\/?$/,
    crumbs: [{ label: 'HR', to: '/hr' }, { label: 'Employees' }],
  },
  {
    pattern: /^\/hr\/attendance\/?$/,
    crumbs: [{ label: 'HR', to: '/hr' }, { label: 'Attendance' }],
  },
  {
    pattern: /^\/hr\/leaves\/?$/,
    crumbs: [{ label: 'HR', to: '/hr' }, { label: 'Leaves' }],
  },
  {
    pattern: /^\/hr\/payroll\/?$/,
    crumbs: [{ label: 'HR', to: '/hr' }, { label: 'Payroll' }],
  },
  {
    pattern: /^\/hr\/commissions\/?$/,
    crumbs: [{ label: 'HR', to: '/hr' }, { label: 'Commissions' }],
  },
  { pattern: /^\/reports\/?$/, crumbs: [{ label: 'Reports' }] },
  {
    pattern: /^\/reports\/sales\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Sales' }],
  },
  {
    pattern: /^\/reports\/purchases\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Purchases' }],
  },
  {
    pattern: /^\/reports\/inventory\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Inventory' }],
  },
  {
    pattern: /^\/reports\/dues\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Dues' }],
  },
  {
    pattern: /^\/reports\/profit\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Profit & Loss' }],
  },
  {
    pattern: /^\/reports\/branch\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Branch' }],
  },
  {
    pattern: /^\/reports\/salesperson\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Salesperson' }],
  },
  {
    pattern: /^\/reports\/product-performance\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Product Performance' }],
  },
  {
    pattern: /^\/reports\/courier-returns\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Courier Returns' }],
  },
  {
    pattern: /^\/reports\/courier\/?$/,
    crumbs: [{ label: 'Reports', to: '/reports' }, { label: 'Courier' }],
  },
  {
    pattern: /^\/settings\/website/,
    crumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Website' }],
  },
  {
    pattern: /^\/settings\/data-reset\/?$/,
    crumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Data Reset' }],
  },
  { pattern: /^\/settings\/?$/, crumbs: [{ label: 'Settings' }] },
  {
    pattern: /^\/activity-logs\/?$/,
    crumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Activity Logs' }],
  },
  { pattern: /^\/stores\/?$/, crumbs: [{ label: 'Settings', to: '/settings' }, { label: 'Stores' }] },
  {
    pattern: /^\/administration\/users\/new\/?$/,
    crumbs: [
      { label: 'Administration', to: '/administration' },
      { label: 'Users', to: '/administration/users' },
      { label: 'Create user' },
    ],
  },
  {
    pattern: /^\/administration\/users\/?$/,
    crumbs: [{ label: 'Administration', to: '/administration' }, { label: 'Users' }],
  },
  {
    pattern: /^\/administration\/roles\/?$/,
    crumbs: [{ label: 'Administration', to: '/administration' }, { label: 'Roles' }],
  },
  {
    pattern: /^\/administration\/permissions\/?$/,
    crumbs: [{ label: 'Administration', to: '/administration' }, { label: 'Permissions' }],
  },
  {
    pattern: /^\/administration\/activity\/?$/,
    crumbs: [{ label: 'Administration', to: '/administration' }, { label: 'Activity' }],
  },
  { pattern: /^\/administration\/?$/, crumbs: [{ label: 'Administration' }] },
]

const DYNAMIC_RESOLVERS: Array<{ pattern: RegExp; resolve: BreadcrumbResolver }> = [
  {
    pattern: /^\/sales\/([^/]+)\/return\/?$/,
    resolve: (p) => [
      { label: 'Sales', to: '/sales' },
      { label: p.id ? `Invoice` : 'Sale', to: `/sales/${p.id}` },
      { label: 'Return' },
    ],
  },
  {
    pattern: /^\/sales\/([^/]+)\/collections\/?$/,
    resolve: (p) => [
      { label: 'Sales', to: '/sales' },
      { label: 'Sale', to: `/sales/${p.id}` },
      { label: 'Collections' },
    ],
  },
  {
    pattern: /^\/sales\/([^/]+)\/edit\/?$/,
    resolve: (p) => [
      { label: 'Sales', to: '/sales' },
      { label: 'Sale', to: `/sales/${p.id}` },
      { label: 'Edit' },
    ],
  },
  {
    pattern: /^\/sales\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Sales', to: '/sales' },
      { label: p.label || p.id || 'Sale details' },
    ],
  },
  {
    pattern: /^\/products\/([^/]+)\/edit\/?$/,
    resolve: (p) => [
      { label: 'Inventory', to: '/products' },
      { label: 'Products', to: '/products' },
      { label: p.label || 'Edit Product' },
    ],
  },
  {
    pattern: /^\/products\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Inventory', to: '/products' },
      { label: p.label || 'Product Details' },
    ],
  },
  {
    pattern: /^\/purchases\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Purchases', to: '/purchases' },
      { label: p.label || 'Purchase' },
    ],
  },
  {
    pattern: /^\/suppliers\/([^/]+)\/ledger\/?$/,
    resolve: (p) => [
      { label: 'Accounts', to: '/accounts' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: p.label || 'Supplier', to: `/suppliers/${p.id}` },
      { label: 'Ledger' },
    ],
  },
  {
    pattern: /^\/suppliers\/([^/]+)\/edit\/?$/,
    resolve: (p) => [
      { label: 'Accounts', to: '/accounts' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: p.label || 'Edit' },
    ],
  },
  {
    pattern: /^\/suppliers\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Accounts', to: '/accounts' },
      { label: 'Suppliers', to: '/suppliers' },
      { label: p.label || 'Supplier' },
    ],
  },
  {
    pattern: /^\/customers\/([^/]+)\/ledger\/?$/,
    resolve: (p) => [
      { label: 'Customers', to: '/customers' },
      { label: p.label || 'Customer', to: `/customers/${p.id}` },
      { label: 'Ledger' },
    ],
  },
  {
    pattern: /^\/customers\/([^/]+)\/edit\/?$/,
    resolve: (p) => [
      { label: 'Customers', to: '/customers' },
      { label: p.label || 'Edit' },
    ],
  },
  {
    pattern: /^\/customers\/([^/]+)\/?$/,
    resolve: (p) => [{ label: 'Customers', to: '/customers' }, { label: p.label || 'Customer' }],
  },
  {
    pattern: /^\/couriers\/([^/]+)\/?$/,
    resolve: (p) => [{ label: 'Courier', to: '/couriers' }, { label: p.label || 'Company' }],
  },
  {
    pattern: /^\/administration\/users\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Administration', to: '/administration' },
      { label: 'Users', to: '/administration/users' },
      { label: p.label || 'User' },
    ],
  },
  {
    pattern: /^\/administration\/roles\/([^/]+)\/?$/,
    resolve: (p) => [
      { label: 'Administration', to: '/administration' },
      { label: 'Roles', to: '/administration/roles' },
      { label: p.label || 'Role' },
    ],
  },
]

function matchParams(pattern: RegExp, pathname: string): Record<string, string> | null {
  const m = pattern.exec(pathname)
  if (!m) return null
  return { id: m[1] ?? '', label: '' }
}

export function resolveBreadcrumbs(
  pathname: string,
  dynamicLabels: Record<string, string> = {},
): BreadcrumbCrumb[] {
  for (const entry of STATIC_TRAILS) {
    if (entry.pattern.test(pathname)) return entry.crumbs
  }
  for (const entry of DYNAMIC_RESOLVERS) {
    const params = matchParams(entry.pattern, pathname)
    if (!params) continue
    if (dynamicLabels[params.id]) params.label = dynamicLabels[params.id]
    const crumbs = entry.resolve(params)
    if (crumbs) return crumbs
  }
  return [{ label: 'Dashboard', to: '/dashboard' }, { label: 'Page' }]
}
