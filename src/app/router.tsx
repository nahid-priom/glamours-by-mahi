import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { PWAProvider } from '@/features/pwa'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PrintLayout } from '@/features/print/PrintLayout'
import { StorefrontLayout } from '@/features/storefront/StorefrontLayout'
import { Skeleton } from '@/components/ui/skeleton'

const HomePage = lazy(() =>
  import('@/features/storefront/HomePage').then((m) => ({ default: m.HomePage })),
)
const ShopPage = lazy(() =>
  import('@/features/storefront/ShopPage').then((m) => ({ default: m.ShopPage })),
)
const CategoryPage = lazy(() =>
  import('@/features/storefront/CategoryPage').then((m) => ({ default: m.CategoryPage })),
)
const ProductDetailsPage = lazy(() =>
  import('@/features/storefront/ProductDetailsPage').then((m) => ({ default: m.ProductDetailsPage })),
)
const CartPage = lazy(() =>
  import('@/features/storefront/CartPage').then((m) => ({ default: m.CartPage })),
)
const CheckoutPage = lazy(() =>
  import('@/features/storefront/CheckoutPage').then((m) => ({ default: m.CheckoutPage })),
)
const OrderSuccessPage = lazy(() =>
  import('@/features/storefront/OrderSuccessPage').then((m) => ({ default: m.OrderSuccessPage })),
)
const TrackOrderPage = lazy(() =>
  import('@/features/storefront/TrackOrderPage').then((m) => ({ default: m.TrackOrderPage })),
)
const AccountPage = lazy(() =>
  import('@/features/storefront/AccountPage').then((m) => ({ default: m.AccountPage })),
)
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
const SearchPage = lazy(() =>
  import('@/features/storefront/SearchPage').then((m) => ({ default: m.SearchPage })),
)
const OfflineFallbackPage = lazy(() =>
  import('@/features/pwa').then((m) => ({ default: m.OfflineFallbackPage })),
)

const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const OrdersPage = lazy(() =>
  import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })),
)
const OrderFormPage = lazy(() =>
  import('@/features/orders/OrderFormPage').then((m) => ({ default: m.OrderFormPage })),
)
const StoresPage = lazy(() =>
  import('@/features/stores/StoresPage').then((m) => ({ default: m.StoresPage })),
)
const CouriersPage = lazy(() =>
  import('@/features/couriers/CouriersPage').then((m) => ({ default: m.CouriersPage })),
)
const CustomersPage = lazy(() =>
  import('@/features/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })),
)
const ProductsPage = lazy(() =>
  import('@/features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })),
)
const FraudPage = lazy(() =>
  import('@/features/fraud/FraudPage').then((m) => ({ default: m.FraudPage })),
)
const InvoicesPage = lazy(() =>
  import('@/features/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const PrintInvoicePage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintInvoicePage })),
)
const PrintShippingLabelPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintShippingLabelPage })),
)
const PrintGiftLabelPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintGiftLabelPage })),
)
const PrintBulkInvoicesPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkInvoicesPage })),
)
const PrintBulkShippingLabelsPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkShippingLabelsPage })),
)
const PrintBulkGiftLabelsPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintBulkGiftLabelsPage })),
)
const PrintReportPage = lazy(() =>
  import('@/features/print/PrintPages').then((m) => ({ default: m.PrintReportPage })),
)

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
  {
    element: <DashboardLayout />,
    children: [
      { path: '/dashboard', element: withSuspense(DashboardPage) },
      { path: '/orders', element: withSuspense(OrdersPage) },
      { path: '/orders/new', element: withSuspense(OrderFormPage) },
      { path: '/orders/:id/edit', element: withSuspense(OrderFormPage) },
      { path: '/stores', element: withSuspense(StoresPage) },
      { path: '/couriers', element: withSuspense(CouriersPage) },
      { path: '/customers', element: withSuspense(CustomersPage) },
      { path: '/products', element: withSuspense(ProductsPage) },
      { path: '/fraud', element: withSuspense(FraudPage) },
      { path: '/invoices', element: withSuspense(InvoicesPage) },
      { path: '/reports', element: withSuspense(ReportsPage) },
      { path: '/settings', element: withSuspense(SettingsPage) },
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
      { path: 'reports/:reportType', element: withSuspense(PrintReportPage) },
    ],
  },
    ],
  },
])
