import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery } from '@tanstack/react-query'
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
import { courierRepository } from '@/features/couriers'
import type { Store } from './stores.types'
import type { StoreFormInput } from './stores.types'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  type: z.enum(['facebook', 'shopify', 'woocommerce', 'instagram', 'manual']),
  logo_url: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  invoice_prefix: z.string().min(1, 'Invoice prefix is required').max(6),
  default_courier_id: z.string().optional(),
  status: z.enum(['active', 'inactive', 'archived']),
  api_status: z.enum(['connected', 'not_connected', 'error']),
})

interface StoreFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  store?: Store | null
  onSubmit: (data: StoreFormInput) => Promise<void>
  loading?: boolean
}

const defaultValues: StoreFormInput = {
  name: '',
  type: 'manual',
  logo_url: '',
  phone: '',
  email: '',
  address: '',
  invoice_prefix: '',
  default_courier_id: '',
  status: 'active',
  api_status: 'not_connected',
}

export function StoreFormDialog({
  open,
  onOpenChange,
  store,
  onSubmit,
  loading,
}: StoreFormDialogProps) {
  const form = useForm<StoreFormInput>({
    resolver: zodResolver(schema),
    defaultValues,
  })

  const { data: couriers = [] } = useQuery({
    queryKey: ['courier-companies', 'store-form'],
    queryFn: () => courierRepository.listCompanies(),
  })

  useEffect(() => {
    if (store) {
      form.reset({
        name: store.name,
        type: store.type,
        logo_url: store.logo_url ?? '',
        phone: store.phone ?? '',
        email: store.email ?? '',
        address: store.address ?? '',
        invoice_prefix: store.invoice_prefix,
        default_courier_id: store.default_courier_id ?? '',
        status: store.status,
        api_status: store.api_status,
      })
    } else {
      form.reset(defaultValues)
    }
  }, [store, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{store ? 'Edit Store' : 'Add Store'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Store Name</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Store Type</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(v) => form.setValue('type', v as StoreFormInput['type'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="shopify">Shopify</SelectItem>
                <SelectItem value="woocommerce">WooCommerce</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Invoice Prefix</Label>
              <Input {...form.register('invoice_prefix')} className="uppercase" />
              {form.formState.errors.invoice_prefix && (
                <p className="text-xs text-danger">{form.formState.errors.invoice_prefix.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Default Courier</Label>
              <Select
                value={form.watch('default_courier_id') || 'none'}
                onValueChange={(v) =>
                  form.setValue('default_courier_id', v === 'none' ? '' : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Logo URL</Label>
            <Input {...form.register('logo_url')} placeholder="https://..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input {...form.register('phone')} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...form.register('email')} />
              {form.formState.errors.email && (
                <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Input {...form.register('address')} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as StoreFormInput['status'])}
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
              <Label>API Status</Label>
              <Select
                value={form.watch('api_status')}
                onValueChange={(v) =>
                  form.setValue('api_status', v as StoreFormInput['api_status'])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="connected">Connected</SelectItem>
                  <SelectItem value="not_connected">Not Connected</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {store ? 'Save Changes' : 'Add Store'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
