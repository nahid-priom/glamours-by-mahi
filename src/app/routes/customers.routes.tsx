import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import { CustomersAdminPage, withSuspense } from './lazy'

export const customersRoutes: RouteObject = {
  element: <PermissionRoute permission="customers.read" />,
  children: [
    { path: '/customers', element: withSuspense(CustomersAdminPage) },
    { path: '/customers/new', element: withSuspense(CustomersAdminPage) },
    { path: '/customers/:id', element: withSuspense(CustomersAdminPage) },
    { path: '/customers/:id/edit', element: withSuspense(CustomersAdminPage) },
    { path: '/customers/:id/ledger', element: withSuspense(CustomersAdminPage) },
  ],
}
