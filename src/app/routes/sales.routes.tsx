import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  DueCollectionPage,
  ExchangeCreatePage,
  ExchangesPage,
  HeldSalesPage,
  ApproveOnlineOrderPage,
  OnlineOrdersPage,
  PosPage,
  SaleDetailPage,
  SaleEditPage,
  SaleReturnPage,
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
    element: <PermissionRoute permission="orders.read" />,
    children: [
      { path: '/sales/online-orders', element: withSuspense(OnlineOrdersPage) },
      {
        element: <PermissionRoute permission={['orders.approve', 'orders.fulfil']} />,
        children: [
          {
            path: '/sales/online-orders/:id/approve',
            element: withSuspense(ApproveOnlineOrderPage),
          },
        ],
      },
    ],
  },
  {
    element: <PermissionRoute permission={['exchange.read', 'exchange.create']} />,
    children: [
      { path: '/sales/exchanges', element: withSuspense(ExchangesPage) },
      {
        element: <PermissionRoute permission="exchange.create" />,
        children: [{ path: '/sales/exchanges/new', element: withSuspense(ExchangeCreatePage) }],
      },
    ],
  },
  {
    element: <PermissionRoute permission="sales.read" />,
    children: [
      { path: '/sales', element: withSuspense(SalesHistoryPage) },
      { path: '/sales/returns', element: withSuspense(SalesReturnsPage) },
      {
        element: <PermissionRoute permission="sales.commission.read" />,
        children: [
          { path: '/sales/commissions', element: <Navigate to="/hr/commissions" replace /> },
        ],
      },
      {
        element: <PermissionRoute permission="sales.commission.manage" />,
        children: [
          {
            path: '/sales/commission-settings',
            element: <Navigate to="/hr/commission-settings" replace />,
          },
        ],
      },
      { path: '/sales/collections', element: withSuspense(DueCollectionPage) },
      { path: '/sales/:id', element: withSuspense(SaleDetailPage) },
      {
        element: <PermissionRoute permission={['sales.update', 'sales.correct']} />,
        children: [{ path: '/sales/:id/edit', element: withSuspense(SaleEditPage) }],
      },
      {
        element: <PermissionRoute permission={['sales.return', 'sales.return.review']} />,
        children: [{ path: '/sales/:id/return', element: withSuspense(SaleReturnPage) }],
      },
      { path: '/sales/:id/collections', element: withSuspense(DueCollectionPage) },
    ],
  },
  { path: '/orders', element: <Navigate to="/sales" replace /> },
  { path: '/orders/new', element: <Navigate to="/sales/pos" replace /> },
  { path: '/orders/*', element: <Navigate to="/sales" replace /> },
]
