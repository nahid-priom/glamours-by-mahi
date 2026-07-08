import { Link } from 'react-router-dom'
import { STOREFRONT_BRAND } from '@/lib/constants'
import { Truck, Shield, RotateCcw, CreditCard } from 'lucide-react'

export function Footer() {
  return (
    <footer className="bg-[#111111] text-white">
      <div className="border-b border-white/10 px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Truck, title: 'Nationwide Delivery', desc: '2–5 business days' },
            { icon: CreditCard, title: 'Cash on Delivery', desc: 'Pay when you receive' },
            { icon: Shield, title: 'Quality Assured', desc: 'Premium curated pieces' },
            { icon: RotateCcw, title: 'Easy Exchange', desc: '3-day return policy' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <Icon className="h-5 w-5 shrink-0 text-[#E11D48]" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-white/50">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-5 sm:px-6">
        <div className="lg:col-span-2">
          <p className="font-serif text-2xl tracking-[0.15em]">{STOREFRONT_BRAND}</p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/50">
            Minimal luxury fashion for the modern woman. Curated collections with nationwide COD delivery across Bangladesh.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Shop</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li><Link to="/shop" className="hover:text-white">All Products</Link></li>
            <li><Link to="/category/new-arrival" className="hover:text-white">New Arrivals</Link></li>
            <li><Link to="/category/dress" className="hover:text-white">Dresses</Link></li>
            <li><Link to="/category/sale" className="hover:text-white">Sale</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Support</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li><Link to="/track-order" className="hover:text-white">Track Order</Link></li>
            <li><Link to="/account/orders" className="hover:text-white">My Orders</Link></li>
            <li><Link to="/account" className="hover:text-white">Account</Link></li>
            <li><Link to="/dashboard" className="hover:text-white">Admin OMS</Link></li>
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Company</p>
          <ul className="mt-4 space-y-2.5 text-sm text-white/70">
            <li><a href="#" className="hover:text-white">About Us</a></li>
            <li><a href="#" className="hover:text-white">Contact</a></li>
            <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 px-4 py-5 text-center text-xs text-white/40 sm:px-6">
        © {new Date().getFullYear()} {STOREFRONT_BRAND}. Powered by{' '}
        <span className="text-[#E11D48]">Code Bondhu IT</span>
      </div>
    </footer>
  )
}
