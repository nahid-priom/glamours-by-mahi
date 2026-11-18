import { Link } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Pencil, ShoppingCart, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { CustomerRatingStars } from '@/features/customer-rating'
import type { Customer } from '../repositories/customers.repository'
import { customerInitials } from '../utils/customer-display'

type Props = {
  customer: Customer
  rating?: { score: number | null; rating_status: 'unrated' | 'provisional' | 'rated' } | null
  onEdit: () => void
  onSoftDelete?: () => void
}

export function CustomerProfileHeader({ customer, rating, onEdit, onSoftDelete }: Props) {
  const contactLine = [customer.phone, customer.email, customer.district].filter(Boolean).join(' · ')
  const statusVariant =
    customer.status === 'active' ? 'success' : customer.status === 'blocked' ? 'danger' : 'default'

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-8">
        <Link to="/customers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Customers
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-base font-semibold text-[#2563EB]"
            aria-hidden
          >
            {customerInitials(customer.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{customer.name}</h1>
              <Badge variant={statusVariant}>{customer.status}</Badge>
            </div>
            {rating ? (
              <div className="mt-1">
                <CustomerRatingStars
                  score={rating.score}
                  status={rating.rating_status}
                  size="md"
                />
              </div>
            ) : null}
            {contactLine ? <p className="mt-1 text-sm text-muted-foreground">{contactLine}</p> : null}
            {customer.address ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{customer.address}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="customer_due.collect">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/accounts/dues?tab=customers&customerId=${customer.id}`}>
                <Wallet className="mr-1.5 h-4 w-4" />
                Collect due
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="pos.create">
            <Button size="sm" asChild>
              <Link to={`/sales/pos?customerId=${customer.id}`}>
                <ShoppingCart className="mr-1.5 h-4 w-4" />
                New sale
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="customers.manage">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to={`/sales?customerId=${customer.id}`}>View all sales</Link>
              </DropdownMenuItem>
              {onSoftDelete ? (
                <PermissionGate permission="customers.manage">
                  <DropdownMenuItem
                    className="text-[#E11D48]"
                    onClick={() => {
                      if (window.confirm('Archive this customer?')) onSoftDelete()
                    }}
                  >
                    Archive customer
                  </DropdownMenuItem>
                </PermissionGate>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
