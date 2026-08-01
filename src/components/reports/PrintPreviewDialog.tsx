import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ReportPrintLayout } from './ReportPrintLayout'

export function PrintPreviewDialog({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Print preview</DialogTitle>
        </DialogHeader>
        <ReportPrintLayout title={title} subtitle={subtitle}>
          {children}
        </ReportPrintLayout>
      </DialogContent>
    </Dialog>
  )
}
