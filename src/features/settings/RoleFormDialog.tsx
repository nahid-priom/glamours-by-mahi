import { useEffect, useMemo, useState } from 'react'
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
import { PERMISSIONS } from '@/lib/permissions'
import type { RoleEntry, RoleFormInput } from './settings.types'

const schema = z.object({
  name: z.string().min(2, 'Role name is required'),
  description: z.string().min(2, 'Description is required'),
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
  const [selected, setSelected] = useState<string[]>([])
  const form = useForm<{ name: string; description: string; is_active: boolean }>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      description: '',
      is_active: true,
    },
  })

  const permissionGroups = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const key of PERMISSIONS) {
      const module = key.split('.')[0] ?? 'other'
      const list = groups.get(module) ?? []
      list.push(key)
      groups.set(module, list)
    }
    return Array.from(groups.entries())
  }, [])

  useEffect(() => {
    if (role) {
      form.reset({
        name: role.name,
        description: role.description,
        is_active: role.is_active,
      })
      setSelected(role.permissions.filter((p) => p !== '*'))
    } else {
      form.reset({ name: '', description: '', is_active: true })
      setSelected([])
    }
  }, [role, open, form])

  const toggle = (key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const handleSubmit = form.handleSubmit(async (data) => {
    if (!selected.length) return
    await onSubmit({
      name: data.name,
      description: data.description,
      permissions: selected,
      is_active: data.is_active,
    })
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
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
          <div className="space-y-2">
            <Label>Permissions ({selected.length} selected)</Label>
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
              {permissionGroups.map(([module, keys]) => (
                <div key={module}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    {module}
                  </p>
                  <div className="space-y-1">
                    {keys.map((key) => (
                      <label key={key} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={selected.includes(key)}
                          onCheckedChange={() => toggle(key)}
                        />
                        <span className="font-mono">{key}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!selected.length ? (
              <p className="text-xs text-danger">Select at least one permission</p>
            ) : null}
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
            <Button type="submit" disabled={loading || !selected.length}>
              {role ? 'Save Changes' : 'Add Role'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
