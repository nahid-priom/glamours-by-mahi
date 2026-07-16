import type { RouteObject } from 'react-router-dom'
import { PermissionRoute } from '@/app/guards/PermissionRoute'
import {
  AdminProductsPage,
  BrandsPage,
  CategoriesPage,
  ProductImportPage,
  SubcategoriesPage,
  VariantsPage,
  withSuspense,
} from './lazy'

export const productsRoutes: RouteObject = {
  element: <PermissionRoute permission="products.read" />,
  children: [
    { path: '/products', element: withSuspense(AdminProductsPage) },
    { path: '/products/categories', element: withSuspense(CategoriesPage) },
    { path: '/products/subcategories', element: withSuspense(SubcategoriesPage) },
    { path: '/products/brands', element: withSuspense(BrandsPage) },
    { path: '/products/variants', element: withSuspense(VariantsPage) },
    { path: '/products/import', element: withSuspense(ProductImportPage) },
    { path: '/products/new', element: withSuspense(AdminProductsPage) },
    { path: '/products/:id', element: withSuspense(AdminProductsPage) },
    { path: '/products/:id/edit', element: withSuspense(AdminProductsPage) },
  ],
}
