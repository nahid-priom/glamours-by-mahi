import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  BranchReportPage,
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
    { path: '/reports/profit', element: withSuspense(ProfitReportPage) },
    { path: '/reports/branch', element: withSuspense(BranchReportPage) },
    { path: '/reports/salesperson', element: withSuspense(SalespersonReportPage) },
    { path: '/reports/product-performance', element: withSuspense(ProductPerformanceReportPage) },
    { path: '/reports/courier-returns', element: withSuspense(CourierReturnsReportPage) },
    { path: '/reports/products', element: <Navigate to="/reports/product-performance" replace /> },
    { path: '/reports/branches', element: <Navigate to="/reports/branch" replace /> },
    { path: '/reports/accounts', element: <Navigate to="/accounts/profit-loss" replace /> },
    { path: '/reports/hr', element: <Navigate to="/hr/payroll" replace /> },
  ],
}
