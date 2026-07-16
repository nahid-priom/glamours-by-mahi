import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  LowStockPage,
  StockAdjustmentPage,
  StockLedgerPage,
  StockOverviewPage,
  StockTransferPage,
  TransferFormPage,
  withSuspense,
} from './lazy'

export const inventoryRoutes: RouteObject[] = [
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
    children: [{ path: '/inventory/adjustments', element: withSuspense(StockAdjustmentPage) }],
  },
  {
    element: <PermissionRoute permission="inventory.transfer" />,
    children: [
      { path: '/inventory/transfers', element: withSuspense(StockTransferPage) },
      { path: '/inventory/transfers/new', element: withSuspense(TransferFormPage) },
    ],
  },
]
