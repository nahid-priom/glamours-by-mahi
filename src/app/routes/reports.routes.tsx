import type { RouteObject } from 'react-router-dom'
import { Navigate, useLocation } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  BranchReportPage,
  CourierReportPage,
  CourierReturnsReportPage,
  CustomerDueReportPage,
  InventoryReportPage,
  ProductPerformanceReportPage,
  ProfitReportPage,
  PurchasesReportPage,
  ReportsHubPage,
  SalespersonReportPage,
  SalesReportPage,
  SupplierDueReportPage,
  TopCustomersReportPage,
  withSuspense,
} from './lazy'

function RedirectPreserveQuery({ to }: { to: string }) {
  const location = useLocation()
  return <Navigate to={`${to}${location.search || ''}`} replace />
}

export const reportsRoutes: RouteObject = {
  element: <PermissionRoute permission="reports.read" />,
  children: [
    { path: '/reports', element: withSuspense(ReportsHubPage) },
    { path: '/reports/sales', element: withSuspense(SalesReportPage) },
    { path: '/reports/purchases', element: withSuspense(PurchasesReportPage) },
    { path: '/reports/inventory', element: withSuspense(InventoryReportPage) },
    { path: '/reports/customer-due', element: withSuspense(CustomerDueReportPage) },
    { path: '/reports/top-customers', element: withSuspense(TopCustomersReportPage) },
    { path: '/reports/supplier-due', element: withSuspense(SupplierDueReportPage) },
    {
      element: (
        <PermissionRoute
          permission={['accounts.read', 'profit_loss.read']}
          fallback="/reports"
        />
      ),
      children: [{ path: '/reports/profit', element: withSuspense(ProfitReportPage) }],
    },
    { path: '/reports/branch', element: withSuspense(BranchReportPage) },
    { path: '/reports/salesperson', element: withSuspense(SalespersonReportPage) },
    { path: '/reports/product-performance', element: withSuspense(ProductPerformanceReportPage) },
    { path: '/reports/courier', element: withSuspense(CourierReportPage) },
    { path: '/reports/courier-returns', element: withSuspense(CourierReturnsReportPage) },
    { path: '/reports/products', element: <Navigate to="/reports/product-performance" replace /> },
    { path: '/reports/branches', element: <Navigate to="/reports/branch" replace /> },
    { path: '/reports/accounts', element: <RedirectPreserveQuery to="/accounts/profit-loss" /> },
    { path: '/reports/hr', element: <RedirectPreserveQuery to="/hr/payroll/reports" /> },
    { path: '/reports/dues', element: <RedirectPreserveQuery to="/accounts/dues" /> },
    { path: '/reports/cash-book', element: <RedirectPreserveQuery to="/accounts/transactions" /> },
  ],
}
