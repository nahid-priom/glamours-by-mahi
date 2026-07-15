import { Link } from 'react-router-dom'
import {
  ArrowRightLeft,
  Banknote,
  Bolt,
  PackagePlus,
  ShoppingBag,
  Truck,
  Wallet,
  History,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ACTIONS = [
  { to: '/sales/pos', label: 'Open POS', icon: ShoppingBag },
  { to: '/sales', label: 'Sales History', icon: History },
  { to: '/purchases/new', label: 'Add Purchase', icon: PackagePlus },
  { to: '/sales/collections', label: 'Due Collection', icon: Banknote },
  { to: '/purchases/payments', label: 'Supplier Payment', icon: Wallet },
  { to: '/inventory/transfers/new', label: 'Stock Transfer', icon: ArrowRightLeft },
  { to: '/accounts/expenses', label: 'Add Expense', icon: Wallet },
  { to: '/couriers/parcels', label: 'Book Parcel', icon: Truck },
] as const

export function QuickActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="rounded-full bg-[#111111] hover:bg-[#E11D48]">
          <Bolt className="h-3.5 w-3.5" />
          Quick Actions
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ACTIONS.map(({ to, label, icon: Icon }) => (
          <DropdownMenuItem key={to} asChild>
            <Link to={to} className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-[#6B7280]" />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
