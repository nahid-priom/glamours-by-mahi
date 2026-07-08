import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Banknote,
  Heart,
  MapPin,
  Package,
  PackageCheck,
  RotateCcw,
  Search,
  Truck,
} from 'lucide-react'
import { formatBDT, formatDateShort } from '@/lib/format'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useCart } from '../cart.context'
import { useAccount } from './account.context'
import { AccountStatCard } from './AccountStatCard'
import { computeStats, getDefaultAddress, getOrdersForPhone } from './account.service'
import { ProductCard } from '../components/ProductCard'
import { storefrontService } from '../storefront.service'
import { Skeleton } from '@/components/ui/skeleton'

export function AccountOverviewPage() {
  const { session } = useAccount()
  const { wishlistIds } = useCart()
  const phone = session?.phone ?? ''

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['account', 'orders', phone],
    queryFn: () => getOrdersForPhone(phone),
    enabled: phone.length >= 11,
  })

  const wishlistSlugs = [...wishlistIds]
  const { data: wishlistProducts = [] } = useQuery({
    queryKey: ['account', 'wishlist-preview', wishlistSlugs],
    queryFn: async () => {
      const all = await storefrontService.getShopProducts({ pageSize: 200 })
      return all.products.filter((p) => wishlistIds.has(p.id)).slice(0, 4)
    },
    enabled: wishlistIds.size > 0,
  })

  const stats = computeStats(orders, wishlistIds.size)
  const defaultAddress = phone ? getDefaultAddress(phone) : null
  const recentOrders = orders.slice(0, 3)
  const firstName = session?.name?.split(' ')[0] ?? 'there'

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-3xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-[#111111]/8 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#E11D48]">Dashboard</p>
        <h2 className="mt-2 font-serif text-2xl text-[#111111] sm:text-3xl">
          Welcome back, {firstName} 👋
        </h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Track deliveries, manage your profile, and shop your saved favourites.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <AccountStatCard icon={Package} value={stats.totalOrders} label="Total Orders" />
        <AccountStatCard icon={PackageCheck} value={stats.delivered} label="Delivered" tone="green" />
        <AccountStatCard icon={Truck} value={stats.inProgress} label="In Progress" tone="blue" />
        <AccountStatCard icon={RotateCcw} value={stats.returned} label="Returned" tone="amber" />
        <AccountStatCard icon={Banknote} value={formatBDT(stats.totalSpent)} label="Total Spent" tone="rose" />
        <AccountStatCard icon={Heart} value={stats.wishlistCount} label="Wishlist Items" tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#111111]">Recent Orders</h3>
            <Link to="/account/orders" className="text-xs font-semibold uppercase tracking-[0.15em] text-[#E11D48]">
              View all
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-[#6B7280]">No orders yet. Start shopping to see them here.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recentOrders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border border-[#111111]/6 bg-[#F8F6F2]/50 p-3"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-semibold text-[#111111]">{order.order_id}</p>
                    <p className="mt-0.5 truncate text-sm text-[#6B7280]">{order.product_name}</p>
                    <p className="mt-1 text-[10px] text-[#6B7280]">{formatDateShort(order.created_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={order.status} />
                    <p className="mt-1 text-sm font-semibold">{formatBDT(order.cod_amount)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#111111]">Saved Address</h3>
            <Link to="/account/addresses" className="text-xs font-semibold uppercase tracking-[0.15em] text-[#E11D48]">
              Manage
            </Link>
          </div>
          {defaultAddress ? (
            <div className="mt-4 rounded-2xl border border-[#111111]/6 bg-[#F8F6F2]/50 p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#E11D48]" />
                <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#6B7280]">
                  {defaultAddress.label}
                  {defaultAddress.isDefault && ' · Default'}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-[#111111]">{defaultAddress.fullName}</p>
              <p className="mt-1 text-sm text-[#6B7280]">{defaultAddress.address}</p>
              <p className="text-sm text-[#6B7280]">
                {defaultAddress.area}, {defaultAddress.district}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[#6B7280]">
              No saved address yet.{' '}
              <Link to="/account/addresses" className="font-medium text-[#E11D48] hover:underline">
                Add one
              </Link>
            </p>
          )}

          <Link
            to="/track-order"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-[#111111]/8 p-4 transition hover:border-[#111111]/20 hover:shadow-sm"
          >
            <div className="rounded-xl bg-[#111111]/5 p-2.5">
              <Search className="h-4 w-4 text-[#111111]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[#111111]">Track Order</p>
              <p className="text-xs text-[#6B7280]">Search by order ID or phone</p>
            </div>
          </Link>
        </section>
      </div>

      {wishlistProducts.length > 0 && (
        <section className="rounded-3xl border border-[#111111]/8 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-serif text-xl text-[#111111]">Wishlist Preview</h3>
            <Link to="/account/wishlist" className="text-xs font-semibold uppercase tracking-[0.15em] text-[#E11D48]">
              View all
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {wishlistProducts.map((p) => (
              <ProductCard key={p.id} product={p} variant="compact" />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
