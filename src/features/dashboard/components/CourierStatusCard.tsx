import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock,
  Package,
  RotateCcw,
  Truck,
  Warehouse,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DashboardSectionCard } from './DashboardSectionCard'

interface CourierStatusCardProps {
  statuses: {
    pending: number
    readyToShip: number
    courierBooked: number
    inTransit: number
    deliveredToday: number
    returnedToday: number
  }
}

const ROWS = [
  { key: 'pending', label: 'Pending Parcels', icon: Clock, tone: 'amber', to: '/couriers/parcels' },
  { key: 'readyToShip', label: 'Ready to Ship', icon: Package, tone: 'blue', to: '/couriers/parcels' },
  { key: 'courierBooked', label: 'Booked', icon: Warehouse, tone: 'slate', to: '/couriers/tracking' },
  { key: 'inTransit', label: 'In Transit', icon: Truck, tone: 'blue', to: '/couriers/tracking' },
  { key: 'deliveredToday', label: 'Delivered Today', icon: CheckCircle2, tone: 'green', to: '/couriers/tracking' },
  { key: 'returnedToday', label: 'Return Requests', icon: RotateCcw, tone: 'rose', to: '/couriers/returns' },
] as const

const tones = {
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  slate: 'bg-slate-50 text-slate-700',
  green: 'bg-emerald-50 text-emerald-700',
  rose: 'bg-rose-50 text-rose-700',
}

export function CourierStatusCard({ statuses }: CourierStatusCardProps) {
  return (
    <DashboardSectionCard title="Courier Status" action={{ label: 'View all', to: '/couriers/tracking' }}>
      <ul className="space-y-2">
        {ROWS.map(({ key, label, icon: Icon, tone, to }) => (
          <li key={key}>
            <Link
              to={to}
              className="flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-[#F8F6F2]"
            >
              <span className="flex items-center gap-2.5 text-sm text-[#111111]">
                <span className={cn('inline-flex rounded-lg p-1.5', tones[tone])}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {label}
              </span>
              <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-semibold">
                {statuses[key]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </DashboardSectionCard>
  )
}
