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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Courier } from './couriers.types'
import type { CourierFormInput } from './couriers.types'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(2, 'Code is required').max(6, 'Max 6 characters'),
  contact_phone: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  default_service_type: z.string().optional(),
})

interface CourierFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courier?: Courier | null
  onSubmit: (data: CourierFormInput) => Promise<void>
  loading?: boolean
}

export function CourierFormDialog({
  open,
  onOpenChange,
  courier,
  onSubmit,
  loading,
}: CourierFormDialogProps) {
  const form = useForm<CourierFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      contact_phone: '',
      status: 'active',
      default_service_type: 'standard',
    },
  })

  useEffect(() => {
    if (courier) {
      form.reset({
        name: courier.name,
        code: courier.code,
        contact_phone: courier.contact_phone ?? '',
        status: courier.status,
        default_service_type: courier.default_service_type ?? 'standard',
      })
    } else {
      form.reset({
        name: '',
        code: '',
        contact_phone: '',
        status: 'active',
        default_service_type: 'standard',
      })
    }
  }, [courier, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{courier ? 'Edit Courier' : 'Add Courier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Courier Name</Label>
            <Input {...form.register('name')} placeholder="e.g. Steadfast" />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input {...form.register('code')} placeholder="STF" className="uppercase" />
              {form.formState.errors.code && (
                <p className="text-xs text-danger">{form.formState.errors.code.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Contact Phone</Label>
              <Input {...form.register('contact_phone')} placeholder="09610000777" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as CourierFormInput['status'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Default Service</Label>
              <Select
                value={form.watch('default_service_type') ?? 'standard'}
                onValueChange={(v) => form.setValue('default_service_type', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="same_day">Same Day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {courier ? 'Save Changes' : 'Add Courier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
