import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { EntityCombobox } from '@/components/entity-combobox'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { CustomerSummaryCard } from '@/features/customers/components/CustomerSummaryCard'
import { cn } from '@/lib/utils'
import {
  searchCustomers,
  type QuickCreateCustomerResult,
} from '../repositories/pos.repository'
import { PosQuickAddCustomerDialog } from './PosQuickAddCustomerDialog'

export type PosCustomerSelectProps = {
  value: string | null
  onChange: (id: string | null, label: string | null) => void
  organizationId: string
  branchId?: string | null
  createdBy?: string | null
  canCreate: boolean
  /** Called after a customer is selected/created (e.g. to refocus the scanner). */
  onAfterResolve?: () => void
  className?: string
}

export function PosCustomerSelect({
  value,
  onChange,
  organizationId,
  branchId,
  createdBy,
  canCreate,
  onAfterResolve,
  className,
}: PosCustomerSelectProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleResolved = (result: QuickCreateCustomerResult) => {
    onChange(result.customer.id, result.customer.label)
    void queryClient.invalidateQueries({ queryKey: ['customers-admin'] })
    toast(result.existing ? 'Existing customer selected' : 'Customer created')
    onAfterResolve?.()
  }

  return (
    <div className={cn('shrink-0 space-y-2', className)}>
      <div
        className={cn(
          'grid gap-2',
          canCreate ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-1',
        )}
      >
        <EntityCombobox
          value={value}
          onChange={(id, opt) => {
            onChange(id, opt?.label ?? null)
            onAfterResolve?.()
          }}
          onSearch={searchCustomers}
          placeholder="Search customer by name or mobile…"
          emptyMessage="No customers found"
          aria-label="Customer"
        />
        {canCreate ? (
          <Button
            type="button"
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setDialogOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Customer
          </Button>
        ) : null}
      </div>

      {value ? (
        <CustomerSummaryCard
          customerId={value}
          onClear={() => {
            onChange(null, null)
            onAfterResolve?.()
          }}
        />
      ) : null}

      {canCreate ? (
        <PosQuickAddCustomerDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          organizationId={organizationId}
          branchId={branchId}
          createdBy={createdBy}
          onResolved={handleResolved}
        />
      ) : null}
    </div>
  )
}
