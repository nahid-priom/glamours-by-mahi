import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ExternalLink, Printer } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { invoicesService } from './invoices.service'
import { formatBDT, formatDateShort } from '@/lib/format'
import type { Invoice, InvoiceStatus } from './invoices.types'

const statusVariant: Record<InvoiceStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  draft: 'default',
  issued: 'info',
  paid: 'success',
  void: 'danger',
}

interface InvoiceDetailsDrawerProps {
  invoice: Invoice | null
  onClose: () => void
  onMarkPaid?: (id: string) => void
  onVoid?: (id: string) => void
}

export function InvoiceDetailsDrawer({
  invoice,
  onClose,
  onMarkPaid,
  onVoid,
}: InvoiceDetailsDrawerProps) {
  const { data: live } = useQuery({
    queryKey: ['invoices', invoice?.id],
    queryFn: () => invoicesService.getInvoiceById(invoice!.id),
    enabled: !!invoice?.id,
    initialData: invoice ?? undefined,
  })

  const display = live ?? invoice
  if (!display) return null

  const printUrl = `/print/orders/${display.order_id}/invoice`

  return (
    <Sheet open={!!invoice} onOpenChange={onClose}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{display.invoice_no}</SheetTitle>
          <SheetDescription>{formatDateShort(display.invoice_date)}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-5 text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[display.status]}>{display.status}</Badge>
            {display.deleted_at && <Badge variant="default">Archived</Badge>}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-slate-50 p-3">
            <p><span className="text-text-muted">Customer:</span> {display.customer_name}</p>
            <p><span className="text-text-muted">Order:</span> {display.order_number}</p>
            <p><span className="text-text-muted">Store:</span> {display.store_name}</p>
            <p><span className="text-text-muted">Amount:</span> {formatBDT(display.amount)}</p>
            <p><span className="text-text-muted">Print count:</span> {display.print_count}</p>
            {display.last_printed_at && (
              <p>
                <span className="text-text-muted">Last printed:</span>{' '}
                {formatDateShort(display.last_printed_at)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="purple" size="sm" asChild>
              <Link to={printUrl} target="_blank" rel="noopener noreferrer">
                <Printer className="h-3.5 w-3.5" />
                Print Invoice
                <ExternalLink className="h-3 w-3 opacity-60" />
              </Link>
            </Button>
            {display.status === 'issued' && onMarkPaid && (
              <Button variant="success" size="sm" onClick={() => onMarkPaid(display.id)}>
                Mark Paid
              </Button>
            )}
            {display.status !== 'void' && display.status !== 'paid' && onVoid && (
              <Button variant="outline" size="sm" onClick={() => onVoid(display.id)}>
                Void
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
