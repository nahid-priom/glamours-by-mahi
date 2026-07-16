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
import { useAuth } from '@/features/auth/auth-session'
import { hasPermission, type Permission } from '@/lib/permissions'

const ACTIONS: Array<{
  to: string
  label: string
  icon: typeof ShoppingBag
  permission: Permission | Permission[]
}> = [
  { to: '/sales/pos', label: 'Open POS', icon: ShoppingBag, permission: 'pos.create' },
  { to: '/sales', label: 'Sales History', icon: History, permission: 'sales.read' },
  { to: '/purchases/new', label: 'Add Purchase', icon: PackagePlus, permission: 'purchases.create' },
  {
    to: '/sales/collections',
    label: 'Due Collection',
    icon: Banknote,
    permission: ['sales.read', 'customer_due.collect'],
  },
  {
    to: '/purchases/payments',
    label: 'Supplier Payment',
    icon: Wallet,
    permission: ['purchases.read', 'supplier_due.pay'],
  },
  {
    to: '/inventory/transfers/new',
    label: 'Stock Transfer',
    icon: ArrowRightLeft,
    permission: 'inventory.transfer',
  },
  {
    to: '/accounts/expenses',
    label: 'Add Expense',
    icon: Wallet,
    permission: ['accounts.read', 'expense.create'],
  },
  {
    to: '/couriers/parcels',
    label: 'Book Parcel',
    icon: Truck,
    permission: ['courier.manage', 'courier.book'],
  },
]

export function QuickActionsMenu() {
  const { permissions } = useAuth()
  const visible = ACTIONS.filter((a) => hasPermission(permissions, a.permission))

  if (!visible.length) return null

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
        {visible.map(({ to, label, icon: Icon }) => (
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
