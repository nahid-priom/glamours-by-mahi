import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { AdminAuthGuard } from '@/app/guards/AdminAuthGuard'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { PrintLayout } from '@/features/print/PrintLayout'
import {
  PrintReportPage,
  PrintSaleA4Page,
  PrintSaleGiftLabelPage,
  PrintSalePosPage,
  PublicInvoicePage,
  withSuspense,
} from './lazy'

/** Authenticated print routes — require session + sales/reports read. */
export const printRoutes: RouteObject = {
  path: '/print',
  element: <AdminAuthGuard />,
  children: [
    {
      element: <PrintLayout />,
      children: [
        { path: 'orders/*', element: <Navigate to="/sales" replace /> },
        {
          element: <PermissionRoute permission="sales.read" />,
          children: [
            { path: 'sales/:id/a4', element: withSuspense(PrintSaleA4Page) },
            { path: 'sales/:id/pos', element: withSuspense(PrintSalePosPage) },
            { path: 'sales/:id/gift-label', element: withSuspense(PrintSaleGiftLabelPage) },
          ],
        },
        {
          element: <PermissionRoute permission="reports.read" />,
          children: [{ path: 'reports/:reportType', element: withSuspense(PrintReportPage) }],
        },
      ],
    },
  ],
}

/** Tokenized public invoice — no staff session required. */
export const publicInvoiceRoute: RouteObject = {
  path: '/public/invoice/:secureToken',
  element: withSuspense(PublicInvoicePage),
}
