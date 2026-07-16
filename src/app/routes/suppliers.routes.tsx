import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { SupplierDetailPage, SuppliersPage, withSuspense } from './lazy'

export const suppliersRoutes: RouteObject = {
  element: <PermissionRoute permission="suppliers.read" />,
  children: [
    { path: '/suppliers', element: withSuspense(SuppliersPage) },
    { path: '/suppliers/new', element: withSuspense(SuppliersPage) },
    { path: '/suppliers/:id', element: withSuspense(SupplierDetailPage) },
    { path: '/suppliers/:id/edit', element: withSuspense(SupplierDetailPage) },
    { path: '/suppliers/:id/ledger', element: withSuspense(SupplierDetailPage) },
  ],
}
