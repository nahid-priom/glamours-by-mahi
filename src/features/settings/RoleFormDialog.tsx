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
import { Checkbox } from '@/components/ui/checkbox'
import type { RoleEntry, RoleFormInput } from './settings.types'

const schema = z.object({
  name: z.string().min(2, 'Role name is required'),
  description: z.string().min(2, 'Description is required'),
  permissions: z.string().min(1, 'At least one permission'),
  is_active: z.boolean(),
})

interface RoleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: RoleEntry | null
  onSubmit: (data: RoleFormInput) => Promise<void>
  loading?: boolean
}

export function RoleFormDialog({
  open,
  onOpenChange,
  role,
  onSubmit,
  loading,
}: RoleFormDialogProps) {
  const form = useForm<{ name: string; description: string; permissions: string; is_active: boolean }>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      permissions: 'read, write',
      is_active: true,
    },
  })

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description,
        permissions: role.permissions.join(', '),
        is_active: role.is_active,
      })
    } else {
      form.reset({ name: '', description: '', permissions: 'read, write', is_active: true })
    }
  }, [role, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit({
      name: data.name,
      description: data.description,
      permissions: data.permissions.split(',').map((p) => p.trim()).filter(Boolean),
      is_active: data.is_active,
    })
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{role ? 'Edit Role' : 'Add Role'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Role Name</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...form.register('description')} />
          </div>
          <div className="space-y-1.5">
            <Label>Permissions (comma-separated)</Label>
            <Input {...form.register('permissions')} placeholder="read, write, delete" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.watch('is_active')}
              onCheckedChange={(v) => form.setValue('is_active', !!v)}
            />
            Active role
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {role ? 'Save Changes' : 'Add Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
