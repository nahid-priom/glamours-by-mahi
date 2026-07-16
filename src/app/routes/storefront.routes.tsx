import type { RouteObject } from 'react-router-dom'
import { StorefrontLayout } from '@/features/storefront/StorefrontLayout'
import {
  AccountAddressesPage,
  AccountOrdersPage,
  AccountOverviewPage,
  AccountPage,
  AccountProfilePage,
  AccountWishlistPage,
  CartPage,
  CategoryPage,
  CheckoutPage,
  HomePage,
  OfflineFallbackPage,
  OrderSuccessPage,
  ProductDetailsPage,
  SearchPage,
  ShopPage,
  StorefrontLoader,
  TrackOrderPage,
  withSuspense,
} from './lazy'

export const storefrontRoutes: RouteObject = {
  path: '/',
  element: <StorefrontLayout />,
  children: [
    { index: true, element: withSuspense(HomePage, <StorefrontLoader />) },
    { path: 'shop', element: withSuspense(ShopPage, <StorefrontLoader />) },
    { path: 'category/:slug', element: withSuspense(CategoryPage, <StorefrontLoader />) },
    { path: 'product/:slug', element: withSuspense(ProductDetailsPage, <StorefrontLoader />) },
    { path: 'cart', element: withSuspense(CartPage) },
    { path: 'checkout', element: withSuspense(CheckoutPage) },
    { path: 'order-success/:orderId', element: withSuspense(OrderSuccessPage) },
    { path: 'track-order', element: withSuspense(TrackOrderPage) },
    {
      path: 'account',
      element: withSuspense(AccountPage),
      children: [
        { index: true, element: withSuspense(AccountOverviewPage) },
        { path: 'orders', element: withSuspense(AccountOrdersPage) },
        { path: 'profile', element: withSuspense(AccountProfilePage) },
        { path: 'wishlist', element: withSuspense(AccountWishlistPage) },
        { path: 'addresses', element: withSuspense(AccountAddressesPage) },
      ],
    },
    { path: 'search', element: withSuspense(SearchPage, <StorefrontLoader />) },
    { path: 'offline', element: withSuspense(OfflineFallbackPage) },
  ],
}
