import { Link } from 'react-router-dom'
import {
  ArrowRightLeft,
  Banknote,
  Bolt,
  PackagePlus,
  ShoppingBag,
  Truck,
  Wallet,
  FilePlus2,
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
  { to: '/sales/new', label: 'New Sale', icon: ShoppingBag },
  { to: '/orders/new', label: 'New Order', icon: FilePlus2 },
  { to: '/purchases/new', label: 'Add Purchase', icon: PackagePlus },
  { to: '/sales/collections', label: 'Customer Collection', icon: Banknote },
  { to: '/suppliers', label: 'Supplier Payment', icon: Wallet },
  { to: '/inventory/transfers/new', label: 'Stock Transfer', icon: ArrowRightLeft },
  { to: '/accounts/expenses', label: 'Add Expense', icon: Wallet },
  { to: '/couriers', label: 'Book Courier', icon: Truck },
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
