import { Link } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, Pencil, Plus, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { SupplierRatingStars } from '@/features/supplier-rating'
import type { Supplier } from '../repositories/suppliers.repository'
import { supplierInitials } from '../utils/supplier-display'

type Rating = {
  score: number | null
  rating_status: 'unrated' | 'provisional' | 'rated'
}

type Props = {
  supplier: Supplier
  rating?: Rating | null
  onEdit: () => void
  onStatusChange?: () => void
}

export function SupplierProfileHeader({ supplier, rating, onEdit, onStatusChange }: Props) {
  const contactLine = [supplier.phone, supplier.email].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-8">
        <Link to="/suppliers">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Supplier directory
        </Link>
      </Button>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#EFF6FF] text-base font-semibold text-[#2563EB]"
            aria-hidden
          >
            {supplierInitials(supplier.name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{supplier.name}</h1>
              <Badge variant={supplier.status === 'active' ? 'success' : 'default'}>
                {supplier.status}
              </Badge>
            </div>
            {rating ? (
              <div className="mt-1">
                <SupplierRatingStars score={rating.score} status={rating.rating_status} />
              </div>
            ) : null}
            {contactLine ? <p className="mt-1 text-sm text-muted-foreground">{contactLine}</p> : null}
            {supplier.address ? (
              <p className="mt-0.5 text-sm text-muted-foreground">{supplier.address}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <PermissionGate permission="purchases.pay">
            <Button size="sm" variant="outline" asChild>
              <Link to={`/purchases/payments?supplierId=${supplier.id}`}>
                <Wallet className="mr-1.5 h-4 w-4" />
                Pay supplier
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="purchases.create">
            <Button size="sm" asChild>
              <Link to={`/purchases/new?supplierId=${supplier.id}`}>
                <Plus className="mr-1.5 h-4 w-4" />
                New purchase
              </Link>
            </Button>
          </PermissionGate>
          <PermissionGate permission="suppliers.manage">
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          </PermissionGate>
          {onStatusChange ? (
            <PermissionGate permission="suppliers.manage">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className={supplier.status === 'active' ? 'text-[#E11D48]' : undefined}
                    onClick={onStatusChange}
                  >
                    {supplier.status === 'active' ? 'Deactivate supplier' : 'Reactivate supplier'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGate>
          ) : null}
        </div>
      </div>
    </div>
  )
}
