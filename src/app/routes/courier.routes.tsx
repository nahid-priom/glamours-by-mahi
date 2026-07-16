import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  CourierCompaniesPage,
  CourierSettlementsPage,
  DeliveryTrackingPage,
  ParcelBookingPage,
  ReturnRequestsPage,
  withSuspense,
} from './lazy'

export const courierRoutes: RouteObject[] = [
  {
    element: <PermissionRoute permission="courier.read" />,
    children: [
      { path: '/couriers', element: withSuspense(CourierCompaniesPage) },
      { path: '/couriers/tracking', element: withSuspense(DeliveryTrackingPage) },
      { path: '/couriers/settlements', element: withSuspense(CourierSettlementsPage) },
      { path: '/couriers/:id', element: withSuspense(CourierCompaniesPage) },
    ],
  },
  {
    element: <PermissionRoute permission={['courier.manage', 'courier.book']} />,
    children: [{ path: '/couriers/parcels', element: withSuspense(ParcelBookingPage) }],
  },
  {
    element: <PermissionRoute permission="sales.return.review" />,
    children: [{ path: '/couriers/returns', element: withSuspense(ReturnRequestsPage) }],
  },
]
