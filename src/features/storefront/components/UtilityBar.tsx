import { Link } from 'react-router-dom'
import { MapPin, Phone, Truck } from 'lucide-react'
import { brandConfig } from '@/config/brand'

export function UtilityBar() {
  return (
    <div className="hidden border-b border-[var(--sf-border)] bg-[var(--sf-ink)] text-white sm:block">
      <div className="sf-container flex h-9 max-w-[1440px] items-center justify-between text-[11px] font-medium tracking-wide">
        <p className="flex items-center gap-1.5 text-white/80">
          <Truck className="h-3.5 w-3.5 text-[var(--sf-primary)]" aria-hidden />
          Nationwide COD · Free delivery over ৳3,000
        </p>
        <div className="flex items-center gap-4 text-white/70">
          <Link to="/track-order" className="transition hover:text-white">
            Track order
          </Link>
          <a href={`tel:${brandConfig.phone}`} className="flex items-center gap-1 transition hover:text-white">
            <Phone className="h-3 w-3" aria-hidden />
            {brandConfig.phone}
          </a>
          <span className="hidden items-center gap-1 lg:flex">
            <MapPin className="h-3 w-3" aria-hidden />
            {brandConfig.primaryLocation}
          </span>
        </div>
      </div>
    </div>
  )
}
