import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  DueCollectionPage,
  HeldSalesPage,
  PosPage,
  SaleDetailPage,
  SalesHistoryPage,
  SalesReturnsPage,
  withSuspense,
} from './lazy'

export const salesRoutes: RouteObject[] = [
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
]
