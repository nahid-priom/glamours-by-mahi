import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Printer, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatBDT } from '@/lib/format'
import { printService } from '@/features/print/print.service'
import {
  getSavedThermalWidth,
  saveThermalWidth,
} from '@/features/print/thermal-preference'
import type { ThermalWidth } from '@/features/print/print.types'

export type CompletedSalePreview = {
  saleId: string
  invoiceNo?: string | null
}

export function PosPostSalePreviewDialog({
  preview,
  open,
  onClose,
  onNewSale,
}: {
  preview: CompletedSalePreview | null
  open: boolean
  onClose: () => void
  onNewSale: () => void
}) {
  const saleId = preview?.saleId ?? ''
  const width = getSavedThermalWidth()

  const saleQuery = useQuery({
    queryKey: ['print', 'sale-pos-preview', saleId],
    queryFn: () => printService.getSaleForPrint(saleId),
    enabled: open && Boolean(saleId),
  })

  const openThermal = (nextWidth: ThermalWidth) => {
    saveThermalWidth(nextWidth)
    window.open(`/print/sales/${saleId}/pos?width=${nextWidth}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sale completed</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-text-muted">
            Invoice{' '}
            <strong className="text-text-primary">
              {preview?.invoiceNo ?? saleQuery.data?.saleNo ?? '…'}
            </strong>{' '}
            is already committed. Print actions reload this sale and never create another invoice.
          </p>

          {saleQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
            </div>
          ) : null}

          {saleQuery.data ? (
            <div className="rounded-xl border border-border bg-slate-50 p-3 text-sm">
              <div className="flex justify-between">
                <span>{saleQuery.data.customerName}</span>
                <span className="font-semibold">{formatBDT(saleQuery.data.total)}</span>
              </div>
              <div className="mt-1 flex justify-between text-text-muted">
                <span>{saleQuery.data.items.length} lines</span>
                <span>Paid {formatBDT(saleQuery.data.paidAmount)}</span>
              </div>
              <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
                {saleQuery.data.items.map((item) => (
                  <li key={`${item.productId}-${item.name}`} className="flex justify-between gap-2">
                    <span className="truncate">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="tabular-nums">{formatBDT(item.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openThermal(width)}
              disabled={!saleId}
            >
              <Printer className="h-4 w-4" />
              POS Invoice
            </Button>
            <Button type="button" variant="outline" asChild disabled={!saleId}>
              <Link to={`/print/sales/${saleId}/a4`} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                A4 Invoice
              </Link>
            </Button>
            <Button type="button" onClick={onNewSale}>
              New Sale
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
