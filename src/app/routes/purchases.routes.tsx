import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  PurchaseHistoryPage,
  PurchaseNewPage,
  PurchaseReturnsPage,
  SupplierPaymentsPage,
  withSuspense,
} from './lazy'

export const purchasesRoutes: RouteObject[] = [
  {
    element: <PermissionRoute permission="purchases.read" />,
    children: [
      { path: '/purchases', element: withSuspense(PurchaseHistoryPage) },
      { path: '/purchases/returns', element: withSuspense(PurchaseReturnsPage) },
      { path: '/purchases/payments', element: withSuspense(SupplierPaymentsPage) },
    ],
  },
  {
    element: <PermissionRoute permission="purchases.create" />,
    children: [{ path: '/purchases/new', element: withSuspense(PurchaseNewPage) }],
  },
]
