import {
  FileSpreadsheet,
  FileText,
  Gift,
  MessageCircle,
  Printer,
  Tag,
  Trash2,
  Truck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SalesBulkActionsProps {
  count: number
  onClear: () => void
  onPrintInvoices: () => void
  onPrintPos: () => void
  onPrintGift: () => void
  onExportExcel: () => void
  onExportPdf: () => void
  onWhatsApp: () => void
  onDelete: () => void
}

export function SalesBulkActions({
  count,
  onClear,
  onPrintInvoices,
  onPrintPos,
  onPrintGift,
  onExportExcel,
  onExportPdf,
  onWhatsApp,
  onDelete,
}: SalesBulkActionsProps) {
  if (count === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#E11D48]/20 bg-[#E11D48]/5 px-3 py-2.5">
      <span className="text-sm font-semibold text-[#E11D48]">{count} selected</span>
      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onClear}>
        Clear
      </Button>
      <div className="mx-1 h-4 w-px bg-[#E5E7EB]" />
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onPrintInvoices}>
        <Printer className="h-3.5 w-3.5" /> Print Invoice
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onPrintPos}>
        <Tag className="h-3.5 w-3.5" /> POS Labels
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onPrintGift}>
        <Gift className="h-3.5 w-3.5" /> Gift Labels
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onExportExcel}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onExportPdf}>
        <FileText className="h-3.5 w-3.5" /> PDF
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" onClick={onWhatsApp}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>
      <Button size="sm" variant="outline" className="h-8 gap-1 rounded-full text-xs" disabled>
        <Truck className="h-3.5 w-3.5" /> Assign Courier
      </Button>
      <Button size="sm" variant="danger" className="h-8 gap-1 rounded-full text-xs" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>
    </div>
  )
}
