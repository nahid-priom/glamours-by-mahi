import { Link } from 'react-router-dom'
import { STOREFRONT_BRAND } from '@/lib/constants'
import { brandConfig } from '@/config/brand'
import { PoweredByCodeBondhu } from '@/components/brand/PoweredByCodeBondhu'
import { CreditCard, RotateCcw, Shield, Truck } from 'lucide-react'

const trust = [
  { icon: Truck, title: 'Free Delivery', desc: 'On orders over ৳3,000' },
  { icon: Shield, title: 'Authentic Products', desc: 'Verified beauty & fashion' },
  { icon: RotateCcw, title: 'Easy Return', desc: '3-day exchange policy' },
  { icon: CreditCard, title: 'Secure Payment', desc: 'COD & online checkout' },
]

export function Footer() {
  return (
    <footer className="bg-[var(--sf-ink)] text-white">
      <div className="border-b border-white/10">
        <div className="sf-container grid max-w-[1440px] gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" aria-hidden />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs text-white/50">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="sf-container grid max-w-[1440px] gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <p className="font-serif text-2xl tracking-[0.08em]">
            <span className="brand-gradient-text">{brandConfig.displayLine1}</span>
            <span className="text-white"> {brandConfig.displayLine2}</span>
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/55">
            {brandConfig.tagline}. Authentic cosmetics, trendy fashion and premium lifestyle products —
            delivered nationwide.
          </p>
          <p className="mt-4 text-xs text-white/40">
            {brandConfig.address}
            <br />
            {brandConfig.phone} · {brandConfig.email}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">Shop</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li>
              <Link to="/shop" className="transition hover:text-[var(--sf-primary)]">
                All products
              </Link>
            </li>
            <li>
              <Link to="/category/new-arrival" className="transition hover:text-[var(--sf-primary)]">
                New arrivals
              </Link>
            </li>
            <li>
              <Link to="/category/dress" className="transition hover:text-[var(--sf-primary)]">
                Dress
              </Link>
            </li>
            <li>
              <Link to="/category/sale" className="transition hover:text-[var(--sf-primary)]">
                Offers
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            Customer care
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li>
              <Link to="/track-order" className="transition hover:text-[var(--sf-primary)]">
                Track order
              </Link>
            </li>
            <li>
              <Link to="/account/orders" className="transition hover:text-[var(--sf-primary)]">
                My orders
              </Link>
            </li>
            <li>
              <Link to="/account/wishlist" className="transition hover:text-[var(--sf-primary)]">
                Wishlist
              </Link>
            </li>
            <li>
              <a href={`tel:${brandConfig.phone}`} className="transition hover:text-[var(--sf-primary)]">
                Call support
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">
            My account
          </p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li>
              <Link to="/account" className="transition hover:text-[var(--sf-primary)]">
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/account/profile" className="transition hover:text-[var(--sf-primary)]">
                Profile
              </Link>
            </li>
            <li>
              <Link to="/account/addresses" className="transition hover:text-[var(--sf-primary)]">
                Addresses
              </Link>
            </li>
            <li>
              <Link to="/admin/login" className="transition hover:text-[var(--sf-primary)]">
                Admin
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="sf-container flex max-w-[1440px] flex-col items-center justify-between gap-2 py-5 text-center text-xs text-white/40 sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} {STOREFRONT_BRAND}. All rights reserved.
          </p>
          <PoweredByCodeBondhu align="right" className="text-white/50" prefixClassName="text-white/50" />
        </div>
      </div>
    </footer>
  )
}
