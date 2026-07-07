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
import type { Customer } from './customers.types'
import type { CustomerFormInput } from './customers.types'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(11, 'Valid phone number required').max(11, 'Valid phone number required'),
  email: z.string().email('Invalid email').or(z.literal('')),
  address: z.string().min(2, 'Address is required'),
  district: z.string().min(2, 'District is required'),
  status: z.enum(['active', 'blocked', 'archived']),
})

interface CustomerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: Customer | null
  onSubmit: (data: CustomerFormInput) => Promise<void>
  loading?: boolean
}

export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
  loading,
}: CustomerFormDialogProps) {
  const form = useForm<CustomerFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      phone: '',
      email: '',
      address: '',
      district: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (customer) {
      form.reset({
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        district: customer.district,
        status: customer.status,
      })
    } else {
      form.reset({
        name: '',
        phone: '',
        email: '',
        address: '',
        district: '',
        status: 'active',
      })
    }
  }, [customer, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{customer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input {...form.register('phone')} placeholder="01XXXXXXXXX" />
            {form.formState.errors.phone && (
              <p className="text-xs text-danger">{form.formState.errors.phone.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...form.register('email')} placeholder="optional" />
            {form.formState.errors.email && (
              <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...form.register('address')} />
            {form.formState.errors.address && (
              <p className="text-xs text-danger">{form.formState.errors.address.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>District</Label>
            <Input {...form.register('district')} />
            {form.formState.errors.district && (
              <p className="text-xs text-danger">{form.formState.errors.district.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as CustomerFormInput['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {customer ? 'Save Changes' : 'Add Customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
