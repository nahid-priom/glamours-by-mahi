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
  /** When false, parent owns the summary card (default true). */
  showSummary?: boolean
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
  showSummary = true,
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

  const clearCustomer = () => {
    onChange(null, null)
    onAfterResolve?.()
  }

  return (
    <div className={cn('relative z-20 shrink-0 space-y-2', className)}>
      {/* Search + Add only — suggestions open on click via EntityCombobox */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <div className="min-w-0">
          <EntityCombobox
            value={value}
            onChange={(id, opt) => {
              onChange(id, opt?.label ?? null)
              onAfterResolve?.()
            }}
            onSearch={searchCustomers}
            placeholder="Search customer…"
            emptyMessage="No customers found"
            aria-label="Customer"
            allowClear={false}
            className="w-full min-w-0"
          />
        </div>

        {canCreate ? (
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 gap-1 border-[#E11D48]/45 px-2.5 text-[#E11D48] hover:bg-[#FFF1F2]"
            onClick={() => setDialogOpen(true)}
            aria-label="Add Customer"
          >
            <UserPlus className="h-4 w-4" />
            <span className="text-xs font-semibold">+ Add</span>
          </Button>
        ) : null}
      </div>

      {showSummary && value ? (
        <CustomerSummaryCard customerId={value} onClear={clearCustomer} variant="chip" />
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
