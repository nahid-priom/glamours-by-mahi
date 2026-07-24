import { lazy } from 'react'

export const StorefrontLayout = lazy(() =>
  import('@/features/storefront/StorefrontLayout').then((m) => ({ default: m.StorefrontLayout })),
)

export const DashboardLayout = lazy(() =>
  import('@/layouts/DashboardLayout').then((m) => ({ default: m.DashboardLayout })),
)

export const PrintLayout = lazy(() =>
  import('@/features/print/PrintLayout').then((m) => ({ default: m.PrintLayout })),
)
