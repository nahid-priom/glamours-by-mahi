import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function PageLoader() {
  return (
    <div className="min-w-0 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function StorefrontLoader() {
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

export function withSuspense(Component: ComponentType, fallback?: ReactNode) {
  return (
    <Suspense fallback={fallback ?? <PageLoader />}>
      <Component />
    </Suspense>
  )
}

export const HomePage = lazy(() =>
  import('@/features/storefront/HomePage').then((m) => ({ default: m.HomePage })),
)
export const ShopPage = lazy(() =>
  import('@/features/storefront/ShopPage').then((m) => ({ default: m.ShopPage })),
)
export const CategoryPage = lazy(() =>
  import('@/features/storefront/CategoryPage').then((m) => ({ default: m.CategoryPage })),
)
export const ProductDetailsPage = lazy(() =>
  import('@/features/storefront/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })),
)
export const CartPage = lazy(() =>
  import('@/features/storefront/CartPage').then((m) => ({ default: m.CartPage })),
)
export const CheckoutPage = lazy(() =>
  import('@/features/storefront/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
)
export const OrderSuccessPage = lazy(() =>
  import('@/features/storefront/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })),
)
export const TrackOrderPage = lazy(() =>
  import('@/features/storefront/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })),
)
export const AccountPage = lazy(() =>
  import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountPage })),
)
export const AccountOverviewPage = lazy(() =>
  import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountOverviewPage })),
)
export const AccountOrdersPage = lazy(() =>
  import('@/features/storefront/AccountOrdersPage').then((m) => ({ default: m.AccountOrdersPage })),
)
export const AccountProfilePage = lazy(() =>
  import('@/features/storefront/AccountProfilePage').then((m) => ({ default: m.AccountProfilePage })),
)
export const AccountWishlistPage = lazy(() =>
  import('@/features/storefront/account/AccountWishlistPage').then((m) => ({
    default: m.AccountWishlistPage,
  })),
)
export const AccountAddressesPage = lazy(() =>
  import('@/features/storefront/account/AccountAddressesPage').then((m) => ({
    default: m.AccountAddressesPage,
  })),
)
export const SearchPage = lazy(() =>
  import('@/features/storefront/SearchPage').then((m) => ({ default: m.SearchPage })),
)
export const OfflineFallbackPage = lazy(() =>
  import('@/features/pwa/pages/OfflineFallbackPage').then((m) => ({ default: m.OfflineFallbackPage })),
)
export const NotFoundPage = lazy(() =>
  import('@/features/common/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)
export const AdminLoginPage = lazy(() =>
  import('@/features/auth/AdminLoginPage').then((m) => ({ default: m.AdminLoginPage })),
)

export const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
export const StoresPage = lazy(() =>
  import('@/features/stores/StoresPage').then((m) => ({ default: m.StoresPage })),
)
export const CustomersAdminPage = lazy(() =>
  import('@/features/customers/pages/CustomersAdminPage').then((m) => ({ default: m.CustomersAdminPage })),
)
export const CustomerDetailPage = lazy(() =>
  import('@/features/customers/pages/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })),
)
export const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
export const WebsiteSettingsPage = lazy(() =>
  import('@/features/website-settings/pages/WebsiteSettingsPage').then((m) => ({ default: m.WebsiteSettingsPage })),
)
export const WebsiteHomepageTabPage = lazy(() =>
  import('@/features/website-settings/pages/WebsiteSettingsPage').then((m) => ({
    default: m.WebsiteHomepageTabPage,
  })),
)
export const WebsiteSeoTabPage = lazy(() =>
  import('@/features/website-settings/pages/WebsiteSettingsPage').then((m) => ({
    default: m.WebsiteSeoTabPage,
  })),
)
export const WebsiteSocialTabPage = lazy(() =>
  import('@/features/website-settings/pages/WebsiteSettingsPage').then((m) => ({
    default: m.WebsiteSocialTabPage,
  })),
)
export const WebsiteContactTabPage = lazy(() =>
  import('@/features/website-settings/pages/WebsiteSettingsPage').then((m) => ({
    default: m.WebsiteContactTabPage,
  })),
)
export const HeroSlideEditorPage = lazy(() =>
  import('@/features/website-settings/pages/HeroSlideEditorPage').then((m) => ({ default: m.HeroSlideEditorPage })),
)
export const HeroSlidePreviewPage = lazy(() =>
  import('@/features/website-settings/pages/HeroSlidePreviewPage').then((m) => ({ default: m.HeroSlidePreviewPage })),
)

export const PosPage = lazy(() => import('@/features/pos/pages/PosPage').then((m) => ({ default: m.PosPage })))
export const HeldSalesPage = lazy(() =>
  import('@/features/pos/pages/HeldSalesPage').then((m) => ({ default: m.HeldSalesPage })),
)

export const SalesHistoryPage = lazy(() =>
  import('@/features/sales/pages/SalesHistoryPage').then((m) => ({ default: m.SalesHistoryPage })),
)
export const SaleDetailPage = lazy(() =>
  import('@/features/sales/pages/SaleDetailPage').then((m) => ({ default: m.SaleDetailPage })),
)
export const SaleEditPage = lazy(() =>
  import('@/features/sales/pages/SaleEditPage').then((m) => ({ default: m.SaleEditPage })),
)
export const DueCollectionPage = lazy(() =>
  import('@/features/sales/pages/DueCollectionPage').then((m) => ({ default: m.DueCollectionPage })),
)
export const SalesReturnsPage = lazy(() =>
  import('@/features/sales/pages/SalesReturnsPage').then((m) => ({ default: m.SalesReturnsPage })),
)
export const SalesCommissionsPage = lazy(() =>
  import('@/features/sales/pages/SalesCommissionsPage').then((m) => ({ default: m.SalesCommissionsPage })),
)
export const CommissionSettingsPage = lazy(() =>
  import('@/features/sales/pages/CommissionSettingsPage').then((m) => ({ default: m.CommissionSettingsPage })),
)
export const OnlineOrdersPage = lazy(() =>
  import('@/features/sales/pages/OnlineOrdersPage').then((m) => ({ default: m.OnlineOrdersPage })),
)

export const CategoriesPage = lazy(() =>
  import('@/features/products/pages/CategoriesPage').then((m) => ({ default: m.CategoriesPage })),
)
export const SubcategoriesPage = lazy(() =>
  import('@/features/products/pages/SubcategoriesPage').then((m) => ({ default: m.SubcategoriesPage })),
)
export const BrandsPage = lazy(() =>
  import('@/features/products/pages/BrandsPage').then((m) => ({ default: m.BrandsPage })),
)
export const AdminProductsPage = lazy(() =>
  import('@/features/products/pages/AdminProductsPage').then((m) => ({ default: m.AdminProductsPage })),
)
export const VariantsPage = lazy(() =>
  import('@/features/products/pages/VariantsPage').then((m) => ({ default: m.VariantsPage })),
)
export const ProductImportPage = lazy(() =>
  import('@/features/products/pages/ProductImportPage').then((m) => ({ default: m.ProductImportPage })),
)

export const StockOverviewPage = lazy(() =>
  import('@/features/inventory/pages/StockOverviewPage').then((m) => ({ default: m.StockOverviewPage })),
)
export const StockLedgerPage = lazy(() =>
  import('@/features/inventory/pages/StockLedgerPage').then((m) => ({ default: m.StockLedgerPage })),
)
export const StockAdjustmentPage = lazy(() =>
  import('@/features/inventory/pages/StockAdjustmentPage').then((m) => ({ default: m.StockAdjustmentPage })),
)
export const StockTransferPage = lazy(() =>
  import('@/features/inventory/pages/StockTransferPage').then((m) => ({ default: m.StockTransferPage })),
)
export const TransferFormPage = lazy(() =>
  import('@/features/inventory/pages/TransferFormPage').then((m) => ({ default: m.TransferFormPage })),
)
export const LowStockPage = lazy(() =>
  import('@/features/inventory/pages/LowStockPage').then((m) => ({ default: m.LowStockPage })),
)

export const AccountsDashboardPage = lazy(() =>
  import('@/features/accounting/pages/simple/SimpleAccountsDashboardPage').then((m) => ({ default: m.SimpleAccountsDashboardPage })),
)
export const CashBankPage = lazy(() =>
  import('@/features/accounting/pages/simple/CashBankPage').then((m) => ({ default: m.CashBankPage })),
)
export const IncomePage = lazy(() =>
  import('@/features/accounting/pages/simple/SimpleIncomePage').then((m) => ({ default: m.SimpleIncomePage })),
)
export const ExpensesPage = lazy(() =>
  import('@/features/accounting/pages/simple/SimpleExpensePage').then((m) => ({ default: m.SimpleExpensePage })),
)
export const CustomerDuePage = lazy(() =>
  import('@/features/accounting/pages/simple/CustomerDuePage').then((m) => ({ default: m.CustomerDuePage })),
)
export const SupplierDuePage = lazy(() =>
  import('@/features/accounting/pages/simple/SupplierDuePage').then((m) => ({ default: m.SupplierDuePage })),
)
export const DailyClosingPage = lazy(() =>
  import('@/features/accounting/pages/simple/DailyClosingPage').then((m) => ({ default: m.DailyClosingPage })),
)
export const TransactionsPage = lazy(() =>
  import('@/features/accounting/pages/simple/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
)
export const ProfitLossPage = lazy(() =>
  import('@/features/accounting/pages/simple/SimpleProfitLossPage').then((m) => ({ default: m.SimpleProfitLossPage })),
)
export const AccountSettingsPage = lazy(() =>
  import('@/features/accounting/pages/simple/AccountSettingsPage').then((m) => ({ default: m.AccountSettingsPage })),
)
export const ReconciliationCenterPage = lazy(() =>
  import('@/features/accounting/pages/simple/ReconciliationCenterPage').then((m) => ({ default: m.ReconciliationCenterPage })),
)

export const PurchaseNewPage = lazy(() =>
  import('@/features/purchases/pages/PurchaseNewPage').then((m) => ({ default: m.PurchaseNewPage })),
)
export const PurchaseHistoryPage = lazy(() =>
  import('@/features/purchases/pages/PurchaseHistoryPage').then((m) => ({ default: m.PurchaseHistoryPage })),
)
export const PurchaseReturnsPage = lazy(() =>
  import('@/features/purchases/pages/PurchaseReturnsPage').then((m) => ({ default: m.PurchaseReturnsPage })),
)
export const SupplierPaymentsPage = lazy(() =>
  import('@/features/purchases/pages/SupplierPaymentsPage').then((m) => ({ default: m.SupplierPaymentsPage })),
)

export const CourierCompaniesPage = lazy(() =>
  import('@/features/couriers/pages/CourierCompaniesPage').then((m) => ({ default: m.CourierCompaniesPage })),
)
export const ParcelBookingPage = lazy(() =>
  import('@/features/couriers/pages/ParcelBookingPage').then((m) => ({ default: m.ParcelBookingPage })),
)
export const DeliveryTrackingPage = lazy(() =>
  import('@/features/couriers/pages/DeliveryTrackingPage').then((m) => ({ default: m.DeliveryTrackingPage })),
)
export const ReturnRequestsPage = lazy(() =>
  import('@/features/couriers/pages/ReturnRequestsPage').then((m) => ({ default: m.ReturnRequestsPage })),
)
export const CourierSettlementsPage = lazy(() =>
  import('@/features/couriers/pages/CourierSettlementsPage').then((m) => ({ default: m.CourierSettlementsPage })),
)

export const ReportsHubPage = lazy(() =>
  import('@/features/reports/pages/ReportsHubPage').then((m) => ({ default: m.ReportsHubPage })),
)
export const SalesReportPage = lazy(() =>
  import('@/features/reports/pages/SalesReportPage').then((m) => ({ default: m.SalesReportPage })),
)
export const PurchasesReportPage = lazy(() =>
  import('@/features/reports/pages/OperationsReportsPages').then((m) => ({
    default: m.PurchasesReportPage,
  })),
)
export const InventoryReportPage = lazy(() =>
  import('@/features/reports/pages/OperationsReportsPages').then((m) => ({
    default: m.InventoryReportPage,
  })),
)
export const CustomerDueReportPage = lazy(() =>
  import('@/features/reports/pages/OperationsReportsPages').then((m) => ({
    default: m.CustomerDueReportPage,
  })),
)
export const SupplierDueReportPage = lazy(() =>
  import('@/features/reports/pages/OperationsReportsPages').then((m) => ({
    default: m.SupplierDueReportPage,
  })),
)
export const ProfitReportPage = lazy(() =>
  import('@/features/reports/pages/AnalyticsReportsPages').then((m) => ({
    default: m.ProfitReportPage,
  })),
)
export const BranchReportPage = lazy(() =>
  import('@/features/reports/pages/AnalyticsReportsPages').then((m) => ({
    default: m.BranchReportPage,
  })),
)
export const SalespersonReportPage = lazy(() =>
  import('@/features/reports/pages/AnalyticsReportsPages').then((m) => ({
    default: m.SalespersonReportPage,
  })),
)
export const ProductPerformanceReportPage = lazy(() =>
  import('@/features/reports/pages/AnalyticsReportsPages').then((m) => ({
    default: m.ProductPerformanceReportPage,
  })),
)
export const CourierReturnsReportPage = lazy(() =>
  import('@/features/reports/pages/AnalyticsReportsPages').then((m) => ({
    default: m.CourierReturnsReportPage,
  })),
)

export const SuppliersPage = lazy(() =>
  import('@/features/suppliers/pages/SuppliersPage').then((m) => ({ default: m.SuppliersPage })),
)
export const SupplierDetailPage = lazy(() =>
  import('@/features/suppliers/pages/SupplierDetailPage').then((m) => ({ default: m.SupplierDetailPage })),
)

export const HrEmployeesPage = lazy(() =>
  import('@/features/hr/HrPages').then((m) => ({ default: m.HrEmployeesPage })),
)
export const HrAttendancePage = lazy(() =>
  import('@/features/hr/HrPages').then((m) => ({ default: m.HrAttendancePage })),
)
export const HrLeavesPage = lazy(() =>
  import('@/features/hr/HrPages').then((m) => ({ default: m.HrLeavesPage })),
)
export const HrPayrollPage = lazy(() =>
  import('@/features/hr/HrPages').then((m) => ({ default: m.HrPayrollPage })),
)

export const PrintSaleA4Page = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleA4Page })),
)
export const PrintSalePosPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSalePosPage })),
)
export const PrintSaleGiftLabelPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSaleGiftLabelPage })),
)
export const PrintSalesReportPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintSalesReportPage })),
)
export const PrintReportPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintReportPage })),
)
export const PublicInvoicePage = lazy(() =>
  import('@/features/print/PublicInvoicePage').then((m) => ({ default: m.PublicInvoicePage })),
)
