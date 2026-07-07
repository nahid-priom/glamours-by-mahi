import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Customer } from './customers.types'

const schema = z.object({
  note: z.string().min(1, 'Note is required'),
})

interface CustomerNoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSubmit: (note: string) => Promise<void>
  loading?: boolean
}

export function CustomerNoteDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
  loading,
}: CustomerNoteDialogProps) {
  const form = useForm<{ note: string }>({
    resolver: zodResolver(schema),
    defaultValues: { note: '' },
  })

  useEffect(() => {
    if (open && customer) {
      form.reset({ note: customer.customer_note })
    }
  }, [open, customer, form])

  const handleSubmit = form.handleSubmit(async ({ note }) => {
    await onSubmit(note)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Note — {customer?.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Note</Label>
            <textarea
              rows={4}
              className={cn(
                'flex w-full rounded-xl border border-border bg-white px-3 py-2 text-sm',
                'placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20',
              )}
              {...form.register('note')}
              placeholder="Internal note about this customer..."
            />
            {form.formState.errors.note && (
              <p className="text-xs text-danger">{form.formState.errors.note.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              Save Note
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
