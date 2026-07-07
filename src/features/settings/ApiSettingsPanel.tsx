import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import type { ApiSettings } from './settings.types'

const COURIER_PROVIDERS = ['Steadfast', 'Pathao', 'RedX', 'eCourier', 'Paperfly', 'Sundarban']
const FRAUD_PROVIDERS = ['BD Courier', 'FraudBD', 'FraudPeek', 'Custom API']

interface ApiSettingsPanelProps {
  settings: ApiSettings
  onSave: (data: Partial<ApiSettings>) => Promise<void>
  loading?: boolean
}

export function ApiSettingsPanel({ settings, onSave, loading }: ApiSettingsPanelProps) {
  const form = useForm<ApiSettings>({
    defaultValues: settings,
  })

  useEffect(() => {
    form.reset(settings)
  }, [settings, form])

  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(data)
  })

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Default Courier API Provider</Label>
        <Select
          value={form.watch('courier_provider_default')}
          onValueChange={(v) => form.setValue('courier_provider_default', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COURIER_PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Default Fraud API Provider</Label>
        <Select
          value={form.watch('fraud_provider_default')}
          onValueChange={(v) => form.setValue('fraud_provider_default', v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FRAUD_PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>SMS API (placeholder)</Label>
        <Input {...form.register('sms_api_placeholder')} placeholder="Not configured" />
        <p className="text-xs text-text-muted">Demo placeholder — connect via Supabase Edge Function later.</p>
      </div>
      <Button type="submit" disabled={loading}>
        Save API Preferences
      </Button>
    </form>
  )
}
