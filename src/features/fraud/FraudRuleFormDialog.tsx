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
import { Checkbox } from '@/components/ui/checkbox'
import type { FraudRule, FraudRuleFormInput } from './fraud.types'

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  rule_key: z.string().min(2, 'Rule key is required'),
  description: z.string().min(5, 'Description is required'),
  points: z.number().min(0).max(100),
  threshold: z.number().min(0).max(100),
  severity: z.enum(['low', 'medium', 'high', 'blocked']),
  is_active: z.boolean(),
})

interface FraudRuleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: FraudRule | null
  onSubmit: (data: FraudRuleFormInput) => Promise<void>
  loading?: boolean
}

export function FraudRuleFormDialog({
  open,
  onOpenChange,
  rule,
  onSubmit,
  loading,
}: FraudRuleFormDialogProps) {
  const form = useForm<FraudRuleFormInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      rule_key: '',
      description: '',
      points: 15,
      threshold: 31,
      severity: 'medium',
      is_active: true,
    },
  })

  useEffect(() => {
    if (rule) {
      form.reset({
        name: rule.name,
        rule_key: rule.rule_key,
        description: rule.description,
        points: rule.points,
        threshold: rule.threshold,
        severity: rule.severity,
        is_active: rule.is_active,
      })
    } else {
      form.reset({
        name: '',
        rule_key: '',
        description: '',
        points: 15,
        threshold: 31,
        severity: 'medium',
        is_active: true,
      })
    }
  }, [rule, open, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSubmit(data)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? 'Edit Fraud Rule' : 'Add Fraud Rule'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rule Name</Label>
            <Input {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-xs text-danger">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Rule Key</Label>
            <Input {...form.register('rule_key')} placeholder="high_return_rate" disabled={!!rule} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input {...form.register('description')} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input type="number" {...form.register('points', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Threshold</Label>
              <Input type="number" {...form.register('threshold', { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select
                value={form.watch('severity')}
                onValueChange={(v) => form.setValue('severity', v as FraudRuleFormInput['severity'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_active"
              checked={form.watch('is_active')}
              onCheckedChange={(v) => form.setValue('is_active', !!v)}
            />
            <Label htmlFor="is_active">Rule is active</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {rule ? 'Save Changes' : 'Add Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
