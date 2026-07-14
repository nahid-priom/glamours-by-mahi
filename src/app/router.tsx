import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { PWAProvider } from '@/features/pwa'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { AdminAuthGuard } from '@/features/auth/AdminAuthGuard'
import { PrintLayout } from '@/features/print/PrintLayout'
import { StorefrontLayout } from '@/features/storefront/StorefrontLayout'
import { Skeleton } from '@/components/ui/skeleton'
import { getDatabase } from '@/database/local-database'

// Ensure ERP demo DB exists on boot
getDatabase()

const HomePage = lazy(() => import('@/features/storefront/HomePage').then((m) => ({ default: m.HomePage })))
const ShopPage = lazy(() => import('@/features/storefront/ShopPage').then((m) => ({ default: m.ShopPage })))
const CategoryPage = lazy(() => import('@/features/storefront/CategoryPage').then((m) => ({ default: m.CategoryPage })))
const ProductDetailsPage = lazy(() => import('@/features/storefront/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })))
const CartPage = lazy(() => import('@/features/storefront/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('@/features/storefront/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrderSuccessPage = lazy(() => import('@/features/storefront/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })))
const TrackOrderPage = lazy(() => import('@/features/storefront/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })))
const AccountPage = lazy(() => import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountPage })))
const AccountOverviewPage = lazy(() => import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountOverviewPage })))
const AccountOrdersPage = lazy(() => import('@/features/storefront/AccountOrdersPage').then((m) => ({ default: m.AccountOrdersPage })))
const AccountProfilePage = lazy(() => import('@/features/storefront/AccountProfilePage').then((m) => ({ default: m.AccountProfilePage })))
const AccountWishlistPage = lazy(() => import('@/features/storefront/account/AccountWishlistPage').then((m) => ({ default: m.AccountWishlistPage })))
const AccountAddressesPage = lazy(() => import('@/features/storefront/account/AccountAddressesPage').then((m) => ({ default: m.AccountAddressesPage })))
const SearchPage = lazy(() => import('@/features/storefront/SearchPage').then((m) => ({ default: m.SearchPage })))
const OfflineFallbackPage = lazy(() => import('@/features/pwa').then((m) => ({ default: m.OfflineFallbackPage })))
const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const AdminLoginPage = lazy(() => import('@/features/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })))

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const OrderFormPage = lazy(() => import('@/features/orders/OrderFormPage').then((m) => ({ default: m.OrderFormPage })))
const StoresPage = lazy(() => import('@/features/stores/StoresPage').then((m) => ({ default: m.StoresPage })))
const CouriersPage = lazy(() => import('@/features/couriers/CouriersPage').then((m) => ({ default: m.CouriersPage })))
const CustomersPage = lazy(() => import('@/features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })))
const ProductsPage = lazy(() => import('@/features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })))
const FraudPage = lazy(() => import('@/features/fraud/FraudPage').then((m) => ({ default: m.FraudPage })))
const InvoicesPage = lazy(() => import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })))
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const SalesPosPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesPosPage })))
const SalesListPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesListPage })))
const SaleDetailsRoute = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SaleDetailsRoute })))
const SaleEditRoute = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SaleEditRoute })))
const SaleReturnRoute = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SaleReturnRoute })))
const SaleCollectionRoute = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SaleCollectionRoute })))
const SalesReturnsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReturnsPage })))
const SalesCollectionsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesCollectionsPage })))
const SalesCommissionsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesCommissionsPage })))
const InventoryBranchStockPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.InventoryBranchStockPage })))
const InventoryLowStockPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.InventoryLowStockPage })))
const InventoryLedgerPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.InventoryLedgerPage })))
const TransfersListPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.TransfersListPage })))
const TransferNewPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.TransferNewPage })))
const SuppliersListPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SuppliersListPage })))
const SupplierDetailsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SupplierDetailsPage })))
const PurchasesListPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.PurchasesListPage })))
const PurchaseDetailsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.PurchaseDetailsPage })))
const PurchasePlaceholderPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.PurchasePlaceholderPage })))
const AccountsOverviewPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.AccountsOverviewPage })))
const AccountsSubPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.AccountsSubPage })))
const HrEmployeesPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.HrEmployeesPage })))
const HrAttendancePage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.HrAttendancePage })))
const HrLeavesPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.HrLeavesPage })))
const HrPayrollPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.HrPayrollPage })))
const ReportsSalesPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportsHubPage })))
const SalesReportChannelsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportChannelsPage })))
const SalesReportProductsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportProductsPage })))
const SalesReportCustomersPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportCustomersPage })))
const SalesReportCollectionsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportCollectionsPage })))
const SalesReportProfitPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportProfitPage })))
const SalesReportReturnsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportReturnsPage })))
const SalesReportSalespersonPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.SalesReportSalespersonPage })))
const CourierSettlementsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.CourierSettlementsPage })))
const CourierReturnsPage = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.CourierReturnsPage })))
const DemoControlPanel = lazy(() => import('@/features/erp/ErpRoutes').then((m) => ({ default: m.DemoControlPanel })))

const PrintInvoicePage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintInvoicePage })))
const PrintShippingLabelPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintShippingLabelPage })))
const PrintGiftLabelPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintGiftLabelPage })))
const PrintSaleA4Page = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleA4Page })))
const PrintSalePosPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSalePosPage })))
const PrintSaleGiftLabelPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleGiftLabelPage })))
const PrintBulkInvoicesPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkInvoicesPage })))
const PrintBulkShippingLabelsPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkShippingLabelsPage })))
const PrintBulkGiftLabelsPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkGiftLabelsPage })))
const PrintReportPage = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintReportPage })))

function PageLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

function StorefrontLoader() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Skeleton className="h-64 w-full rounded-xl" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function withSuspense(Component: ComponentType, fallback?: React.ReactNode) {
  return (
    <Suspense fallback={fallback ?? <PageLoader />}>
      <Component />
    </Suspense>
  )
}

function RootLayout() {
  return (
    <PWAProvider>
      <ScrollToTop />
      <Outlet />
    </PWAProvider>
  )
}

function PurchaseNewPage() {
  return <PurchasePlaceholderPage title="New Purchase" />
}
function PurchaseReturnsPage() {
  return <PurchasePlaceholderPage title="Purchase Returns" />
}
function AccountsCashbookPage() {
  return <AccountsSubPage title="Cashbook" filter="Cash" />
}
function AccountsBanksPage() {
  return <AccountsSubPage title="Bank Accounts" filter="Bank" />
}
function AccountsMobilePage() {
  return <AccountsSubPage title="Mobile Banking" filter="Mobile" />
}
function AccountsIncomePage() {
  return <AccountsSubPage title="Income" filter="Income" />
}
function AccountsExpensesPage() {
  return <AccountsSubPage title="Expenses" filter="Expense" />
}
function AccountsCustomerDuesPage() {
  return <AccountsSubPage title="Customer Due" />
}
function AccountsSupplierDuesPage() {
  return <AccountsSubPage title="Supplier Due" />
}
function AccountsProfitLossPage() {
  return <ReportsSalesPage />
}
function AccountsDailyClosingPage() {
  return <AccountsOverviewPage />
}
function InventoryAdjustmentsPage() {
  return <InventoryLedgerPage />
}
function TransfersNewPage() {
  return <TransferNewPage />
}
function SupplierNewPage() {
  return <SuppliersListPage />
}
function ReportsProductsPage() {
  return <ReportsSalesPage />
}
function ReportsBranchesPage() {
  return <ReportsSalesPage />
}
function ReportsInventoryPage() {
  return <InventoryLowStockPage />
}
function ReportsAccountsPage() {
  return <AccountsOverviewPage />
}
function ReportsHrPage() {
  return <HrPayrollPage />
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/',
        element: <StorefrontLayout />,
        children: [
          { index: true, element: withSuspense(HomePage, <StorefrontLoader />) },
          { path: 'shop', element: withSuspense(ShopPage, <StorefrontLoader />) },
          { path: 'category/:slug', element: withSuspense(CategoryPage, <StorefrontLoader />) },
          { path: 'product/:slug', element: withSuspense(ProductDetailsPage, <StorefrontLoader />) },
          { path: 'cart', element: withSuspense(CartPage) },
          { path: 'checkout', element: withSuspense(CheckoutPage) },
          { path: 'order-success/:orderId', element: withSuspense(OrderSuccessPage) },
          { path: 'track-order', element: withSuspense(TrackOrderPage) },
          {
            path: 'account',
            element: withSuspense(AccountPage),
            children: [
              { index: true, element: withSuspense(AccountOverviewPage) },
              { path: 'orders', element: withSuspense(AccountOrdersPage) },
              { path: 'profile', element: withSuspense(AccountProfilePage) },
              { path: 'wishlist', element: withSuspense(AccountWishlistPage) },
              { path: 'addresses', element: withSuspense(AccountAddressesPage) },
            ],
          },
          { path: 'search', element: withSuspense(SearchPage, <StorefrontLoader />) },
          { path: 'offline', element: withSuspense(OfflineFallbackPage) },
        ],
      },
      { path: '/admin/login', element: withSuspense(AdminLoginPage) },
      {
        element: <AdminAuthGuard />,
        children: [
          {
            element: <DashboardLayout />,
            children: [
          { path: '/dashboard', element: withSuspense(DashboardPage) },
          { path: '/sales', element: withSuspense(SalesListPage) },
          { path: '/sales/new', element: withSuspense(SalesPosPage) },
          { path: '/sales/returns', element: withSuspense(SalesReturnsPage) },
          { path: '/sales/collections', element: withSuspense(SalesCollectionsPage) },
          { path: '/sales/commissions', element: withSuspense(SalesCommissionsPage) },
          { path: '/sales/:id', element: withSuspense(SaleDetailsRoute) },
          { path: '/sales/:id/edit', element: withSuspense(SaleEditRoute) },
          { path: '/sales/:id/return', element: withSuspense(SaleReturnRoute) },
          { path: '/sales/:id/collections', element: withSuspense(SaleCollectionRoute) },
          { path: '/orders', element: withSuspense(OrdersPage) },
          { path: '/orders/new', element: withSuspense(OrderFormPage) },
          { path: '/orders/:id', element: withSuspense(OrderFormPage) },
          { path: '/orders/:id/edit', element: withSuspense(OrderFormPage) },
          { path: '/products', element: withSuspense(ProductsPage) },
          { path: '/products/new', element: withSuspense(ProductsPage) },
          { path: '/products/:id', element: withSuspense(ProductsPage) },
          { path: '/products/:id/edit', element: withSuspense(ProductsPage) },
          { path: '/inventory', element: <Navigate to="/inventory/branch-stock" replace /> },
          { path: '/inventory/branch-stock', element: withSuspense(InventoryBranchStockPage) },
          { path: '/inventory/transfers', element: withSuspense(TransfersListPage) },
          { path: '/inventory/transfers/new', element: withSuspense(TransfersNewPage) },
          { path: '/inventory/adjustments', element: withSuspense(InventoryAdjustmentsPage) },
          { path: '/inventory/low-stock', element: withSuspense(InventoryLowStockPage) },
          { path: '/inventory/ledger', element: withSuspense(InventoryLedgerPage) },
          { path: '/purchases', element: withSuspense(PurchasesListPage) },
          { path: '/purchases/new', element: withSuspense(PurchaseNewPage) },
          { path: '/purchases/:id', element: withSuspense(PurchaseDetailsPage) },
          { path: '/purchases/:id/edit', element: withSuspense(PurchaseDetailsPage) },
          { path: '/purchases/returns', element: withSuspense(PurchaseReturnsPage) },
          { path: '/suppliers', element: withSuspense(SuppliersListPage) },
          { path: '/suppliers/new', element: withSuspense(SupplierNewPage) },
          { path: '/suppliers/:id', element: withSuspense(SupplierDetailsPage) },
          { path: '/suppliers/:id/edit', element: withSuspense(SupplierDetailsPage) },
          { path: '/suppliers/:id/ledger', element: withSuspense(SupplierDetailsPage) },
          { path: '/customers', element: withSuspense(CustomersPage) },
          { path: '/customers/new', element: withSuspense(CustomersPage) },
          { path: '/customers/:id', element: withSuspense(CustomersPage) },
          { path: '/customers/:id/edit', element: withSuspense(CustomersPage) },
          { path: '/customers/:id/ledger', element: withSuspense(CustomersPage) },
          { path: '/couriers', element: withSuspense(CouriersPage) },
          { path: '/couriers/:id', element: withSuspense(CouriersPage) },
          { path: '/couriers/settlements', element: withSuspense(CourierSettlementsPage) },
          { path: '/couriers/returns', element: withSuspense(CourierReturnsPage) },
          { path: '/accounts', element: withSuspense(AccountsOverviewPage) },
          { path: '/accounts/cashbook', element: withSuspense(AccountsCashbookPage) },
          { path: '/accounts/banks', element: withSuspense(AccountsBanksPage) },
          { path: '/accounts/mobile-banking', element: withSuspense(AccountsMobilePage) },
          { path: '/accounts/income', element: withSuspense(AccountsIncomePage) },
          { path: '/accounts/expenses', element: withSuspense(AccountsExpensesPage) },
          { path: '/accounts/customer-dues', element: withSuspense(AccountsCustomerDuesPage) },
          { path: '/accounts/supplier-dues', element: withSuspense(AccountsSupplierDuesPage) },
          { path: '/accounts/profit-loss', element: withSuspense(AccountsProfitLossPage) },
          { path: '/accounts/daily-closing', element: withSuspense(AccountsDailyClosingPage) },
          { path: '/hr', element: <Navigate to="/hr/employees" replace /> },
          { path: '/hr/employees', element: withSuspense(HrEmployeesPage) },
          { path: '/hr/employees/new', element: withSuspense(HrEmployeesPage) },
          { path: '/hr/employees/:id', element: withSuspense(HrEmployeesPage) },
          { path: '/hr/attendance', element: withSuspense(HrAttendancePage) },
          { path: '/hr/leaves', element: withSuspense(HrLeavesPage) },
          { path: '/hr/payroll', element: withSuspense(HrPayrollPage) },
          { path: '/hr/payroll/:id', element: withSuspense(HrPayrollPage) },
          { path: '/reports', element: withSuspense(ReportsPage) },
          { path: '/reports/sales', element: withSuspense(ReportsSalesPage) },
          { path: '/reports/sales/channels', element: withSuspense(SalesReportChannelsPage) },
          { path: '/reports/sales/products', element: withSuspense(SalesReportProductsPage) },
          { path: '/reports/sales/customers', element: withSuspense(SalesReportCustomersPage) },
          { path: '/reports/sales/collections', element: withSuspense(SalesReportCollectionsPage) },
          { path: '/reports/sales/profit', element: withSuspense(SalesReportProfitPage) },
          { path: '/reports/sales/returns', element: withSuspense(SalesReportReturnsPage) },
          { path: '/reports/sales/salesperson', element: withSuspense(SalesReportSalespersonPage) },
          { path: '/reports/products', element: withSuspense(ReportsProductsPage) },
          { path: '/reports/branches', element: withSuspense(ReportsBranchesPage) },
          { path: '/reports/suppliers', element: withSuspense(SuppliersListPage) },
          { path: '/reports/customers', element: withSuspense(CustomersPage) },
          { path: '/reports/inventory', element: withSuspense(ReportsInventoryPage) },
          { path: '/reports/couriers', element: withSuspense(CourierSettlementsPage) },
          { path: '/reports/accounts', element: withSuspense(ReportsAccountsPage) },
          { path: '/reports/hr', element: withSuspense(ReportsHrPage) },
          { path: '/stores', element: withSuspense(StoresPage) },
          { path: '/fraud', element: withSuspense(FraudPage) },
          { path: '/invoices', element: withSuspense(InvoicesPage) },
          { path: '/settings', element: withSuspense(SettingsPage) },
          { path: '/settings/demo', element: withSuspense(DemoControlPanel) },
            ],
          },
        ],
      },
      {
        path: '/print',
        element: <PrintLayout />,
        children: [
          { path: 'orders/:id/invoice', element: withSuspense(PrintInvoicePage) },
          { path: 'orders/:id/shipping-label', element: withSuspense(PrintShippingLabelPage) },
          { path: 'orders/:id/gift-label', element: withSuspense(PrintGiftLabelPage) },
          { path: 'orders/bulk/invoices', element: withSuspense(PrintBulkInvoicesPage) },
          { path: 'orders/bulk/shipping-labels', element: withSuspense(PrintBulkShippingLabelsPage) },
          { path: 'orders/bulk/gift-labels', element: withSuspense(PrintBulkGiftLabelsPage) },
          { path: 'sales/:id/a4', element: withSuspense(PrintSaleA4Page) },
          { path: 'sales/:id/pos', element: withSuspense(PrintSalePosPage) },
          { path: 'sales/:id/gift-label', element: withSuspense(PrintSaleGiftLabelPage) },
          { path: 'reports/:reportType', element: withSuspense(PrintReportPage) },
        ],
      },
      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },
])
