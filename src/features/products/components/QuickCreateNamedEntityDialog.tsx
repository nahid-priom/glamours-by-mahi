import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EntityCombobox, type EntityOption } from '@/components/entity-combobox'

export type QuickCreateNamedEntityDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  nameLabel?: string
  namePlaceholder?: string
  submitLabel?: string
  /** Optional parent category picker (subcategory create). */
  parentCategory?: {
    value: string | null
    onSearch: (q: string) => Promise<EntityOption[]>
    initialLabel?: string | null
    required?: boolean
  }
  onSubmit: (input: { name: string; categoryId: string | null }) => Promise<{
    id: string
    label: string
    meta?: Record<string, string | undefined>
  }>
  onCreated: (option: EntityOption) => void
  onError?: (message: string) => void
}

export function QuickCreateNamedEntityDialog({
  open,
  onOpenChange,
  title,
  nameLabel = 'Name',
  namePlaceholder = 'Name',
  submitLabel = 'Create',
  parentCategory,
  onSubmit,
  onCreated,
  onError,
}: QuickCreateNamedEntityDialogProps) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(parentCategory?.value ?? null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setName('')
    setCategoryId(parentCategory?.value ?? null)
    setBusy(false)
  }, [open, parentCategory?.value])

  const handleSubmit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      onError?.(`${nameLabel} is required`)
      return
    }
    if (parentCategory?.required && !categoryId) {
      onError?.('Category is required')
      return
    }
    setBusy(true)
    try {
      const created = await onSubmit({ name: trimmed, categoryId })
      onCreated({
        id: created.id,
        label: created.label,
        meta: created.meta,
      })
      onOpenChange(false)
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Could not create')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {parentCategory ? (
            <div className="space-y-1.5">
              <Label>Category{parentCategory.required ? ' *' : ''}</Label>
              <EntityCombobox
                value={categoryId}
                onChange={(id) => setCategoryId(id)}
                onSearch={parentCategory.onSearch}
                placeholder="Select category"
                initialLabel={parentCategory.initialLabel}
                allowClear={!parentCategory.required}
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="quick-create-name">{nameLabel} *</Label>
            <Input
              id="quick-create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={namePlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSubmit()
                }
              }}
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={busy} onClick={() => void handleSubmit()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
