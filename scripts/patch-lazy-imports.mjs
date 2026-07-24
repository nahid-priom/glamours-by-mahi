import { readFileSync, writeFileSync } from 'node:fs'

const path = 'src/app/routes/lazy.tsx'
let s = readFileSync(path, 'utf8')

const maps = [
  ['customers', 'pages', ['CustomersAdminPage', 'CustomerDetailPage']],
  ['pos', 'pages', ['PosPage', 'HeldSalesPage']],
  [
    'sales',
    'pages',
    [
      'SalesHistoryPage',
      'SaleDetailPage',
      'SaleEditPage',
      'DueCollectionPage',
      'SalesReturnsPage',
      'SalesCommissionsPage',
      'CommissionSettingsPage',
      'OnlineOrdersPage',
    ],
  ],
  [
    'products',
    'pages',
    ['CategoriesPage', 'SubcategoriesPage', 'BrandsPage', 'AdminProductsPage', 'VariantsPage', 'ProductImportPage'],
  ],
  [
    'inventory',
    'pages',
    [
      'StockOverviewPage',
      'StockLedgerPage',
      'StockAdjustmentPage',
      'StockTransferPage',
      'TransferFormPage',
      'LowStockPage',
    ],
  ],
  [
    'accounting',
    'pages/simple',
    [
      'SimpleAccountsDashboardPage',
      'CashBankPage',
      'SimpleIncomePage',
      'SimpleExpensePage',
      'CustomerDuePage',
      'SupplierDuePage',
      'DailyClosingPage',
      'TransactionsPage',
      'SimpleProfitLossPage',
      'AccountSettingsPage',
      'ReconciliationCenterPage',
    ],
  ],
  [
    'purchases',
    'pages',
    ['PurchaseNewPage', 'PurchaseHistoryPage', 'PurchaseReturnsPage', 'SupplierPaymentsPage'],
  ],
  [
    'couriers',
    'pages',
    [
      'CourierCompaniesPage',
      'ParcelBookingPage',
      'DeliveryTrackingPage',
      'ReturnRequestsPage',
      'CourierSettlementsPage',
    ],
  ],
  [
    'reports',
    'pages',
    [
      'ReportsHubPage',
      'SalesReportPage',
      'PurchasesReportPage',
      'InventoryReportPage',
      'CustomerDueReportPage',
      'SupplierDueReportPage',
      'ProfitReportPage',
      'BranchReportPage',
      'SalespersonReportPage',
      'ProductPerformanceReportPage',
      'CourierReturnsReportPage',
    ],
  ],
  ['suppliers', 'pages', ['SuppliersPage', 'SupplierDetailPage']],
]

for (const [feat, sub, pages] of maps) {
  for (const page of pages) {
    const from = `import('@/features/${feat}').then((m) => ({ default: m.${page} }))`
    const to = `import('@/features/${feat}/${sub}/${page}').then((m) => ({ default: m.${page} }))`
    s = s.split(from).join(to)
  }
}

const ws = [
  ['WebsiteHomepageTabPage', 'pages/WebsiteSettingsPage'],
  ['WebsiteSeoTabPage', 'pages/WebsiteSettingsPage'],
  ['WebsiteSocialTabPage', 'pages/WebsiteSettingsPage'],
  ['WebsiteContactTabPage', 'pages/WebsiteSettingsPage'],
  ['HeroSlideEditorPage', 'pages/HeroSlideEditorPage'],
  ['HeroSlidePreviewPage', 'pages/HeroSlidePreviewPage'],
]

const reportOps = [
  'PurchasesReportPage',
  'InventoryReportPage',
  'CustomerDueReportPage',
  'SupplierDueReportPage',
]
const reportAnalytics = [
  'ProfitReportPage',
  'BranchReportPage',
  'SalespersonReportPage',
  'ProductPerformanceReportPage',
  'CourierReturnsReportPage',
]

for (const [page, p] of ws) {
  const from = `import('@/features/website-settings').then((m) => ({ default: m.${page} }))`
  const to = `import('@/features/website-settings/${p}').then((m) => ({ default: m.${page} }))`
  s = s.split(from).join(to)
}

writeFileSync(path, s)
console.log('patched lazy imports')
