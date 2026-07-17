import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { saveThermalWidth } from './thermal-preference'

export function PrintFormatDialog({
  saleId,
  open,
  onOpenChange,
}: {
  saleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const openPrint = (path: string) => {
    window.open(path, '_blank', 'noopener,noreferrer')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose Print Format</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2">
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => openPrint(`/print/sales/${saleId}/a4`)}
          >
            A4 Invoice
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => {
              saveThermalWidth('58mm')
              openPrint(`/print/sales/${saleId}/pos?width=58mm`)
            }}
          >
            58mm Thermal
          </Button>
          <Button
            type="button"
            variant="outline"
            className="justify-start"
            onClick={() => {
              saveThermalWidth('80mm')
              openPrint(`/print/sales/${saleId}/pos?width=80mm`)
            }}
          >
            80mm Thermal
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
