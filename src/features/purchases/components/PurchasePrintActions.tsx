import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { openPurchasePrint } from '@/features/print/print.service'
import { cn } from '@/lib/utils'

export function PurchasePrintActions({
  purchaseId,
  className,
}: {
  purchaseId: string
  className?: string
}) {
  return (
    <PermissionGate permission="purchases.read">
      <div className={cn('flex items-center gap-1', className)} onClick={(e) => e.stopPropagation()}>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Print purchase"
          onClick={() => openPurchasePrint(purchaseId)}
        >
          <Printer className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Download purchase invoice"
          onClick={() => openPurchasePrint(purchaseId)}
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </PermissionGate>
  )
}
