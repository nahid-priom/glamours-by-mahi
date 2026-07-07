import { lazy, Suspense, type ComponentType } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { PrintLayout } from '@/features/print/PrintLayout'
import { Skeleton } from '@/components/ui/skeleton'

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

function withSuspense(Component: ComponentType) {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      { index: true, element: withSuspense(DashboardPage) },
      { path: 'orders', element: withSuspense(OrdersPage) },
      { path: 'orders/new', element: withSuspense(OrderFormPage) },
      { path: 'orders/:id/edit', element: withSuspense(OrderFormPage) },
      { path: 'stores', element: withSuspense(StoresPage) },
      { path: 'couriers', element: withSuspense(CouriersPage) },
      { path: 'customers', element: withSuspense(CustomersPage) },
      { path: 'products', element: withSuspense(ProductsPage) },
      { path: 'fraud', element: withSuspense(FraudPage) },
      { path: 'invoices', element: withSuspense(InvoicesPage) },
      { path: 'reports', element: withSuspense(ReportsPage) },
      { path: 'settings', element: withSuspense(SettingsPage) },
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
])
