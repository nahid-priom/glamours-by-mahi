import { Outlet } from 'react-router-dom'
import { createBrowserRouter } from 'react-router-dom'
import { ScrollToTop } from '@/components/common/ScrollToTop'
import { RouteErrorElement } from '@/components/errors/AppErrorPage'
import { PWAProvider } from '@/features/pwa/core'
import { useAppBootstrap } from '@/lib/deployment/use-app-bootstrap'
import { AdminAuthGuard } from '@/app/guards/AdminAuthGuard'
import { DashboardLayout } from './lazy-layouts'
import { accountsRoutes } from './accounts.routes'
import { courierRoutes } from './courier.routes'
import { customersRoutes } from './customers.routes'
import { dashboardRoutes } from './dashboard.routes'
import { hrRoutes } from './hr.routes'
import { inventoryRoutes } from './inventory.routes'
import { AdminLoginPage, NotFoundPage, PageLoader, withSuspense } from './lazy'
import { moderatorRoutes } from './moderator.routes'
import { printRoutes, publicInvoiceRoute } from './print.routes'
import { productsRoutes } from './products.routes'
import { purchasesRoutes } from './purchases.routes'
import { reportsRoutes } from './reports.routes'
import { salesRoutes } from './sales.routes'
import { settingsRoutes } from './settings.routes'
import { storefrontRoutes } from './storefront.routes'
import { suppliersRoutes } from './suppliers.routes'

function RootLayout() {
  useAppBootstrap()

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
    errorElement: <RouteErrorElement />,
    children: [
      storefrontRoutes,
      { path: '/admin/login', element: withSuspense(AdminLoginPage) },
      publicInvoiceRoute,
      {
        element: <AdminAuthGuard />,
        children: [
          {
            element: withSuspense(DashboardLayout, <PageLoader />),
            children: [
              dashboardRoutes,
              ...salesRoutes,
              moderatorRoutes,
              productsRoutes,
              ...inventoryRoutes,
              ...purchasesRoutes,
              suppliersRoutes,
              customersRoutes,
              ...courierRoutes,
              accountsRoutes,
              hrRoutes,
              reportsRoutes,
              ...settingsRoutes,
            ],
          },
        ],
      },
      printRoutes,
      { path: '*', element: withSuspense(NotFoundPage) },
    ],
  },
])
