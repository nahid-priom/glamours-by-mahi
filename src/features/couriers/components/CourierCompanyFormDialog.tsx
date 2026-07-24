import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { CourierCompanyListItem } from '../repositories/courier.repository'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  code: z.string().min(1, 'Code is required').max(12, 'Max 12 characters'),
  contact_phone: z.string().optional(),
  api_base_url: z.union([z.literal(''), z.string().url('Enter a valid URL')]).optional(),
  status: z.enum(['active', 'inactive', 'archived']),
})

export type CourierCompanyFormValues = z.infer<typeof schema>

interface CourierCompanyFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  company?: CourierCompanyListItem | null
  onSubmit: (data: CourierCompanyFormValues) => Promise<void>
  loading?: boolean
}

export function CourierCompanyFormDialog({
  open,
  onOpenChange,
  company,
  onSubmit,
  loading,
}: CourierCompanyFormDialogProps) {
  const form = useForm<CourierCompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      code: '',
      contact_phone: '',
      api_base_url: '',
      status: 'active',
    },
  })

  useEffect(() => {
    if (company) {
      form.reset({
        name: company.name,
        code: company.code ?? '',
        contact_phone: company.contact_phone ?? '',
        api_base_url: company.api_base_url ?? '',
        status: (company.status as CourierCompanyFormValues['status']) || 'active',
      })
    } else {
      form.reset({
        name: '',
        code: '',
        contact_phone: '',
        api_base_url: '',
        status: 'active',
      })
    }
  }, [company, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{company ? 'Edit Courier' : 'Add Courier'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="courier_name">Courier name</Label>
            <Input id="courier_name" {...form.register('name')} placeholder="e.g. Steadfast" />
            {form.formState.errors.name ? (
              <p className="text-xs text-[#E11D48]">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="courier_code">Code</Label>
              <Input
                id="courier_code"
                {...form.register('code')}
                placeholder="STF"
                className="uppercase"
              />
              {form.formState.errors.code ? (
                <p className="text-xs text-[#E11D48]">{form.formState.errors.code.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="courier_phone">Contact phone</Label>
              <Input id="courier_phone" {...form.register('contact_phone')} placeholder="09610000777" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="courier_api">API base URL (optional)</Label>
            <Input
              id="courier_api"
              {...form.register('api_base_url')}
              placeholder="https://api.courier.com"
            />
            {form.formState.errors.api_base_url ? (
              <p className="text-xs text-[#E11D48]">{form.formState.errors.api_base_url.message}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as CourierCompanyFormValues['status'])}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : company ? 'Save changes' : 'Add courier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
