import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Printer } from 'lucide-react'
import type { ActionItem } from '@/components/common/ActionDropdown'
import { ActionDropdown } from '@/components/common/ActionDropdown'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-session'
import { saveThermalWidth } from '@/features/print/thermal-preference'
import { cn } from '@/lib/utils'
import { PrintFormatDialog } from '@/features/print/PrintFormatDialog'
import { VoidSaleDialog } from './VoidSaleDialog'
import { CollectDueDialog, type CollectDueTarget } from './CollectDueDialog'
import type { SalesHistoryRow } from '../types/sale.types'

function openPrint(path: string) {
  window.open(path, '_blank', 'noopener,noreferrer')
}

export function SalesRowActions({
  sale,
  className,
}: {
  sale: SalesHistoryRow
  className?: string
}) {
  const navigate = useNavigate()
  const { can } = useAuth()
  const [printOpen, setPrintOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [collectOpen, setCollectOpen] = useState(false)

  const isCompleted = sale.status === 'completed'
  const hasDue = sale.due_total > 0 && Boolean(sale.customer_id) && isCompleted

  const items: ActionItem[] = []

  if (can('sales.update') || can('sales.correct')) {
    items.push({
      label: 'Edit Sale',
      onClick: () => navigate(`/sales/${sale.id}/edit`),
      disabled: !isCompleted,
    })
  }

  if (can('sales.print') || can('sales.read')) {
    items.push({ label: 'A4 Invoice', onClick: () => openPrint(`/print/sales/${sale.id}/a4`) })
    items.push({
      label: '58mm Receipt',
      onClick: () => {
        saveThermalWidth('58mm')
        openPrint(`/print/sales/${sale.id}/pos?width=58mm`)
      },
    })
    items.push({
      label: '80mm Receipt',
      onClick: () => {
        saveThermalWidth('80mm')
        openPrint(`/print/sales/${sale.id}/pos?width=80mm`)
      },
    })
  }

  if (hasDue && (can('customer_due.collect') || can('accounts.post'))) {
    items.push({ label: '', onClick: () => undefined, separator: true })
    items.push({ label: 'Payment / Collection', onClick: () => setCollectOpen(true) })
  }

  items.push({ label: 'Activity History', onClick: () => navigate(`/sales/${sale.id}`) })

  if (can('sales.void')) {
    items.push({ label: '', onClick: () => undefined, separator: true })
    items.push({
      label: 'Void Sale',
      onClick: () => setVoidOpen(true),
      variant: 'danger',
      disabled: !isCompleted,
    })
  }

  const collectTarget: CollectDueTarget | null = sale.customer_id
    ? {
        saleId: sale.id,
        customerId: sale.customer_id,
        invoiceNo: sale.invoice_no,
        grandTotal: sale.grand_total,
        paidTotal: sale.paid_total,
        dueTotal: sale.due_total,
        branchId: sale.branch_id,
      }
    : null

  return (
    <div className={cn('flex items-center justify-end gap-1', className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        aria-label="View sale"
        onClick={() => navigate(`/sales/${sale.id}`)}
      >
        <Eye className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        aria-label="Print sale"
        onClick={() => setPrintOpen(true)}
      >
        <Printer className="h-4 w-4" />
      </Button>
      <ActionDropdown items={items} />

      <PrintFormatDialog saleId={sale.id} open={printOpen} onOpenChange={setPrintOpen} />
      <VoidSaleDialog saleId={sale.id} open={voidOpen} onOpenChange={setVoidOpen} />
      <CollectDueDialog target={collectTarget} open={collectOpen} onOpenChange={setCollectOpen} />
    </div>
  )
}
