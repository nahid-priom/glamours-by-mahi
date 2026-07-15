import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { PWAProvider } from '@/features/pwa'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { AdminAuthGuard } from '@/app/guards/AdminAuthGuard'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { PrintLayout } from '@/features/print/PrintLayout'
import { StorefrontLayout } from '@/features/storefront/StorefrontLayout'
import { Skeleton } from '@/components/ui/skeleton'

const HomePage = lazy(() => import('@/features/storefront/HomePage').then((m) => ({ default: m.HomePage })))
const ShopPage = lazy(() => import('@/features/storefront/ShopPage').then((m) => ({ default: m.ShopPage })))
const CategoryPage = lazy(() => import('@/features/storefront/CategoryPage').then((m) => ({ default: m.CategoryPage })))
const ProductDetailsPage = lazy(() =>
  import('@/features/storefront/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })),
)
const CartPage = lazy(() => import('@/features/storefront/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('@/features/storefront/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const OrderSuccessPage = lazy(() =>
  import('@/features/storefront/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })),
)
const TrackOrderPage = lazy(() =>
  import('@/features/storefront/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })),
)
const AccountPage = lazy(() => import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountPage })))
const AccountOverviewPage = lazy(() =>
  import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountOverviewPage })),
)
const AccountOrdersPage = lazy(() =>
  import('@/features/storefront/AccountOrdersPage').then((m) => ({ default: m.AccountOrdersPage })),
)
const AccountProfilePage = lazy(() =>
  import('@/features/storefront/AccountProfilePage').then((m) => ({ default: m.AccountProfilePage })),
)
const AccountWishlistPage = lazy(() =>
  import('@/features/storefront/account/AccountWishlistPage').then((m) => ({ default: m.AccountWishlistPage })),
)
const AccountAddressesPage = lazy(() =>
  import('@/features/storefront/account/AccountAddressesPage').then((m) => ({ default: m.AccountAddressesPage })),
)
const SearchPage = lazy(() => import('@/features/storefront/SearchPage').then((m) => ({ default: m.SearchPage })))
const OfflineFallbackPage = lazy(() => import('@/features/pwa').then((m) => ({ default: m.OfflineFallbackPage })))
const NotFoundPage = lazy(() => import('@/features/common/NotFoundPage').then((m) => ({ default: m.NotFoundPage })))
const AdminLoginPage = lazy(() => import('@/features/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })))

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const StoresPage = lazy(() => import('@/features/stores/StoresPage').then((m) => ({ default: m.StoresPage })))
const CustomersAdminPage = lazy(() =>
  import('@/features/customers').then((m) => ({ default: m.CustomersAdminPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)

const PosPage = lazy(() => import('@/features/pos').then((m) => ({ default: m.PosPage })))
const HeldSalesPage = lazy(() => import('@/features/pos').then((m) => ({ default: m.HeldSalesPage })))

const SalesHistoryPage = lazy(() => import('@/features/sales').then((m) => ({ default: m.SalesHistoryPage })))
const SaleDetailPage = lazy(() => import('@/features/sales').then((m) => ({ default: m.SaleDetailPage })))
const DueCollectionPage = lazy(() => import('@/features/sales').then((m) => ({ default: m.DueCollectionPage })))
const SalesReturnsPage = lazy(() => import('@/features/sales').then((m) => ({ default: m.SalesReturnsPage })))

const CategoriesPage = lazy(() => import('@/features/products').then((m) => ({ default: m.CategoriesPage })))
const SubcategoriesPage = lazy(() => import('@/features/products').then((m) => ({ default: m.SubcategoriesPage })))
const BrandsPage = lazy(() => import('@/features/products').then((m) => ({ default: m.BrandsPage })))
const AdminProductsPage = lazy(() => import('@/features/products').then((m) => ({ default: m.AdminProductsPage })))
const VariantsPage = lazy(() => import('@/features/products').then((m) => ({ default: m.VariantsPage })))

const StockOverviewPage = lazy(() => import('@/features/inventory').then((m) => ({ default: m.StockOverviewPage })))
const StockLedgerPage = lazy(() => import('@/features/inventory').then((m) => ({ default: m.StockLedgerPage })))
const StockAdjustmentPage = lazy(() =>
  import('@/features/inventory').then((m) => ({ default: m.StockAdjustmentPage })),
)
const StockTransferPage = lazy(() => import('@/features/inventory').then((m) => ({ default: m.StockTransferPage })))
const TransferFormPage = lazy(() => import('@/features/inventory').then((m) => ({ default: m.TransferFormPage })))
const LowStockPage = lazy(() => import('@/features/inventory').then((m) => ({ default: m.LowStockPage })))

const AccountsDashboardPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.SimpleAccountsDashboardPage })),
)
const CashBankPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.CashBankPage })),
)
const IncomePage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.SimpleIncomePage })),
)
const ExpensesPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.SimpleExpensePage })),
)
const CustomerDuePage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.CustomerDuePage })),
)
const SupplierDuePage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.SupplierDuePage })),
)
const DailyClosingPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.DailyClosingPage })),
)
const TransactionsPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.TransactionsPage })),
)
const ProfitLossPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.SimpleProfitLossPage })),
)
const AccountSettingsPage = lazy(() =>
  import('@/features/accounting').then((m) => ({ default: m.AccountSettingsPage })),
)

const PurchaseNewPage = lazy(() => import('@/features/purchases').then((m) => ({ default: m.PurchaseNewPage })))
const PurchaseHistoryPage = lazy(() =>
  import('@/features/purchases').then((m) => ({ default: m.PurchaseHistoryPage })),
)
const PurchaseReturnsPage = lazy(() =>
  import('@/features/purchases').then((m) => ({ default: m.PurchaseReturnsPage })),
)
const SupplierPaymentsPage = lazy(() =>
  import('@/features/purchases').then((m) => ({ default: m.SupplierPaymentsPage })),
)

const CourierCompaniesPage = lazy(() =>
  import('@/features/couriers').then((m) => ({ default: m.CourierCompaniesPage })),
)
const ParcelBookingPage = lazy(() =>
  import('@/features/couriers').then((m) => ({ default: m.ParcelBookingPage })),
)
const DeliveryTrackingPage = lazy(() =>
  import('@/features/couriers').then((m) => ({ default: m.DeliveryTrackingPage })),
)
const ReturnRequestsPage = lazy(() =>
  import('@/features/couriers').then((m) => ({ default: m.ReturnRequestsPage })),
)
const CourierSettlementsPage = lazy(() =>
  import('@/features/couriers').then((m) => ({ default: m.CourierSettlementsPage })),
)

const ReportsHubPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.ReportsHubPage })))
const SalesReportPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.SalesReportPage })))
const PurchasesReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.PurchasesReportPage })),
)
const InventoryReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.InventoryReportPage })),
)
const CustomerDueReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.CustomerDueReportPage })),
)
const SupplierDueReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.SupplierDueReportPage })),
)
const ProfitReportPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.ProfitReportPage })))
const BranchReportPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.BranchReportPage })))
const SalespersonReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.SalespersonReportPage })),
)
const ProductPerformanceReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.ProductPerformanceReportPage })),
)
const CourierReturnsReportPage = lazy(() =>
  import('@/features/reports').then((m) => ({ default: m.CourierReturnsReportPage })),
)

const SuppliersPage = lazy(() =>
  import('@/features/suppliers').then((m) => ({ default: m.SuppliersPage })),
)
const SupplierDetailPage = lazy(() =>
  import('@/features/suppliers').then((m) => ({ default: m.SupplierDetailPage })),
)
const HrEmployeesPage = lazy(() => import('@/features/hr/HrPages').then((m) => ({ default: m.HrEmployeesPage })))
const HrAttendancePage = lazy(() => import('@/features/hr/HrPages').then((m) => ({ default: m.HrAttendancePage })))
const HrLeavesPage = lazy(() => import('@/features/hr/HrPages').then((m) => ({ default: m.HrLeavesPage })))
const HrPayrollPage = lazy(() => import('@/features/hr/HrPages').then((m) => ({ default: m.HrPayrollPage })))

const PrintSaleA4Page = lazy(() => import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleA4Page })))
const PrintSalePosPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSalePosPage })),
)
const PrintSaleGiftLabelPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleGiftLabelPage })),
)
const PrintReportPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintReportPage })),
)

function PageLoader() {
  return (
    <div className="min-w-0 space-y-4">
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
              {
                element: <PermissionRoute module="dashboard" />,
                children: [{ path: '/dashboard', element: withSuspense(DashboardPage) }],
              },
              {
                element: <PermissionRoute permission="pos.create" />,
                children: [
                  { path: '/sales/pos', element: withSuspense(PosPage) },
                  { path: '/sales/new', element: <Navigate to="/sales/pos" replace /> },
                  { path: '/sales/held', element: withSuspense(HeldSalesPage) },
                ],
              },
              {
                element: <PermissionRoute permission="sales.read" />,
                children: [
                  { path: '/sales', element: withSuspense(SalesHistoryPage) },
                  { path: '/sales/returns', element: withSuspense(SalesReturnsPage) },
                  { path: '/sales/collections', element: withSuspense(DueCollectionPage) },
                  { path: '/sales/:id', element: withSuspense(SaleDetailPage) },
                  { path: '/sales/:id/edit', element: <Navigate to="/sales" replace /> },
                  { path: '/sales/:id/return', element: withSuspense(SalesReturnsPage) },
                  { path: '/sales/:id/collections', element: withSuspense(DueCollectionPage) },
                ],
              },
              { path: '/orders', element: <Navigate to="/sales" replace /> },
              { path: '/orders/new', element: <Navigate to="/sales/pos" replace /> },
              { path: '/orders/*', element: <Navigate to="/sales" replace /> },
              {
                element: <PermissionRoute permission="products.read" />,
                children: [
                  { path: '/products', element: withSuspense(AdminProductsPage) },
                  { path: '/products/categories', element: withSuspense(CategoriesPage) },
                  { path: '/products/subcategories', element: withSuspense(SubcategoriesPage) },
                  { path: '/products/brands', element: withSuspense(BrandsPage) },
                  { path: '/products/variants', element: withSuspense(VariantsPage) },
                  { path: '/products/new', element: withSuspense(AdminProductsPage) },
                  { path: '/products/:id', element: withSuspense(AdminProductsPage) },
                  { path: '/products/:id/edit', element: withSuspense(AdminProductsPage) },
                ],
              },
              {
                element: <PermissionRoute permission="inventory.read" />,
                children: [
                  { path: '/inventory', element: <Navigate to="/inventory/stock" replace /> },
                  { path: '/inventory/stock', element: withSuspense(StockOverviewPage) },
                  { path: '/inventory/branch-stock', element: <Navigate to="/inventory/stock" replace /> },
                  { path: '/inventory/ledger', element: withSuspense(StockLedgerPage) },
                  { path: '/inventory/low-stock', element: withSuspense(LowStockPage) },
                ],
              },
              {
                element: <PermissionRoute permission="inventory.adjust" />,
                children: [
                  { path: '/inventory/adjustments', element: withSuspense(StockAdjustmentPage) },
                ],
              },
              {
                element: <PermissionRoute permission="inventory.transfer" />,
                children: [
                  { path: '/inventory/transfers', element: withSuspense(StockTransferPage) },
                  { path: '/inventory/transfers/new', element: withSuspense(TransferFormPage) },
                ],
              },
              {
                element: <PermissionRoute permission="purchases.read" />,
                children: [
                  { path: '/purchases', element: withSuspense(PurchaseHistoryPage) },
                  { path: '/purchases/returns', element: withSuspense(PurchaseReturnsPage) },
                  { path: '/purchases/payments', element: withSuspense(SupplierPaymentsPage) },
                ],
              },
              {
                element: <PermissionRoute permission="purchases.create" />,
                children: [{ path: '/purchases/new', element: withSuspense(PurchaseNewPage) }],
              },
              {
                element: <PermissionRoute permission="suppliers.read" />,
                children: [
                  { path: '/suppliers', element: withSuspense(SuppliersPage) },
                  { path: '/suppliers/new', element: withSuspense(SuppliersPage) },
                  { path: '/suppliers/:id', element: withSuspense(SupplierDetailPage) },
                  { path: '/suppliers/:id/edit', element: withSuspense(SupplierDetailPage) },
                  { path: '/suppliers/:id/ledger', element: withSuspense(SupplierDetailPage) },
                ],
              },
              {
                element: <PermissionRoute permission="customers.read" />,
                children: [
                  { path: '/customers', element: withSuspense(CustomersAdminPage) },
                  { path: '/customers/new', element: withSuspense(CustomersAdminPage) },
                  { path: '/customers/:id', element: withSuspense(CustomersAdminPage) },
                  { path: '/customers/:id/edit', element: withSuspense(CustomersAdminPage) },
                  { path: '/customers/:id/ledger', element: withSuspense(CustomersAdminPage) },
                ],
              },
              {
                element: <PermissionRoute permission="courier.read" />,
                children: [
                  { path: '/couriers', element: withSuspense(CourierCompaniesPage) },
                  { path: '/couriers/tracking', element: withSuspense(DeliveryTrackingPage) },
                  { path: '/couriers/settlements', element: withSuspense(CourierSettlementsPage) },
                  { path: '/couriers/:id', element: withSuspense(CourierCompaniesPage) },
                ],
              },
              {
                element: <PermissionRoute permission="courier.manage" />,
                children: [{ path: '/couriers/parcels', element: withSuspense(ParcelBookingPage) }],
              },
              {
                element: <PermissionRoute permission="sales.return.review" />,
                children: [{ path: '/couriers/returns', element: withSuspense(ReturnRequestsPage) }],
              },
              {
                element: <PermissionRoute permission="accounts.read" />,
                children: [
                  { path: '/accounts', element: withSuspense(AccountsDashboardPage) },
                  { path: '/accounts/cash-bank', element: withSuspense(CashBankPage) },
                  { path: '/accounts/income', element: withSuspense(IncomePage) },
                  { path: '/accounts/expenses', element: withSuspense(ExpensesPage) },
                  { path: '/accounts/customer-due', element: withSuspense(CustomerDuePage) },
                  { path: '/accounts/supplier-due', element: withSuspense(SupplierDuePage) },
                  { path: '/accounts/collections', element: withSuspense(DueCollectionPage) },
                  { path: '/accounts/supplier-payments', element: withSuspense(SupplierPaymentsPage) },
                  { path: '/accounts/daily-closing', element: withSuspense(DailyClosingPage) },
                  { path: '/accounts/transactions', element: withSuspense(TransactionsPage) },
                  { path: '/accounts/profit-loss', element: withSuspense(ProfitLossPage) },
                  { path: '/accounts/settings', element: withSuspense(AccountSettingsPage) },
                  { path: '/accounts/chart', element: <Navigate to="/accounts/settings" replace /> },
                  { path: '/accounts/journals', element: <Navigate to="/accounts/transactions" replace /> },
                  { path: '/accounts/general-ledger', element: <Navigate to="/accounts/transactions" replace /> },
                  { path: '/accounts/trial-balance', element: <Navigate to="/accounts/profit-loss" replace /> },
                  { path: '/accounts/balance-sheet', element: <Navigate to="/accounts/profit-loss" replace /> },
                  { path: '/accounts/cash-flow', element: <Navigate to="/accounts/transactions" replace /> },
                  { path: '/accounts/setup', element: <Navigate to="/accounts/settings" replace /> },
                  { path: '/accounts/customer-ledger', element: <Navigate to="/accounts/customer-due" replace /> },
                  { path: '/accounts/supplier-ledger', element: <Navigate to="/accounts/supplier-due" replace /> },
                  { path: '/accounts/cashbook', element: <Navigate to="/accounts/cash-bank" replace /> },
                  { path: '/accounts/banks', element: <Navigate to="/accounts/cash-bank" replace /> },
                  { path: '/accounts/mobile-banking', element: <Navigate to="/accounts/cash-bank" replace /> },
                  { path: '/accounts/customer-dues', element: <Navigate to="/accounts/customer-due" replace /> },
                  { path: '/accounts/supplier-dues', element: <Navigate to="/accounts/supplier-due" replace /> },
                ],
              },
              {
                element: <PermissionRoute module="hr" />,
                children: [
                  { path: '/hr', element: <Navigate to="/hr/employees" replace /> },
                  { path: '/hr/employees', element: withSuspense(HrEmployeesPage) },
                  { path: '/hr/employees/new', element: withSuspense(HrEmployeesPage) },
                  { path: '/hr/employees/:id', element: withSuspense(HrEmployeesPage) },
                  { path: '/hr/attendance', element: withSuspense(HrAttendancePage) },
                  { path: '/hr/leaves', element: withSuspense(HrLeavesPage) },
                  { path: '/hr/payroll', element: withSuspense(HrPayrollPage) },
                  { path: '/hr/payroll/:id', element: withSuspense(HrPayrollPage) },
                ],
              },
              {
                element: <PermissionRoute permission="reports.read" />,
                children: [
                  { path: '/reports', element: withSuspense(ReportsHubPage) },
                  { path: '/reports/sales', element: withSuspense(SalesReportPage) },
                  { path: '/reports/purchases', element: withSuspense(PurchasesReportPage) },
                  { path: '/reports/inventory', element: withSuspense(InventoryReportPage) },
                  { path: '/reports/customer-due', element: withSuspense(CustomerDueReportPage) },
                  { path: '/reports/supplier-due', element: withSuspense(SupplierDueReportPage) },
                  { path: '/reports/profit', element: withSuspense(ProfitReportPage) },
                  { path: '/reports/branch', element: withSuspense(BranchReportPage) },
                  { path: '/reports/salesperson', element: withSuspense(SalespersonReportPage) },
                  {
                    path: '/reports/product-performance',
                    element: withSuspense(ProductPerformanceReportPage),
                  },
                  { path: '/reports/courier-returns', element: withSuspense(CourierReturnsReportPage) },
                  { path: '/reports/products', element: <Navigate to="/reports/product-performance" replace /> },
                  { path: '/reports/branches', element: <Navigate to="/reports/branch" replace /> },
                  { path: '/reports/accounts', element: <Navigate to="/accounts/profit-loss" replace /> },
                  { path: '/reports/hr', element: <Navigate to="/hr/payroll" replace /> },
                ],
              },
              {
                element: <PermissionRoute permission="settings.manage" />,
                children: [
                  { path: '/settings', element: withSuspense(SettingsPage) },
                  { path: '/stores', element: withSuspense(StoresPage) },
                ],
              },
            ],
          },
        ],
      },
      {
        path: '/print',
        element: <PrintLayout />,
        children: [
          { path: 'orders/*', element: <Navigate to="/sales" replace /> },
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
