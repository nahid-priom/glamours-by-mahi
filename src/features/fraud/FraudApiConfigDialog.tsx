import { useEffect, useState } from 'react'
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
import { Badge } from '@/components/ui/badge'
import { maskApiKey } from '@/lib/service-utils'
import { Loader2 } from 'lucide-react'
import type { FraudApiConfig, FraudProvider } from './fraud.types'

const PROVIDERS: FraudProvider[] = ['BD Courier', 'FraudBD', 'FraudPeek', 'Custom API']

interface FraudApiConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: FraudApiConfig | null
  onSave: (config: Partial<FraudApiConfig>) => Promise<void>
  onTest: (provider: FraudProvider) => Promise<{ success: boolean; message: string }>
  loading?: boolean
}

export function FraudApiConfigDialog({
  open,
  onOpenChange,
  config,
  onSave,
  onTest,
  loading,
}: FraudApiConfigDialogProps) {
  const [form, setForm] = useState<Partial<FraudApiConfig>>({})
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (config && open) {
      setForm({
        provider_name: config.provider_name,
        api_base_url: config.api_base_url ?? '',
        api_key: config.api_key ?? '',
        monthly_limit: config.monthly_limit,
      })
    }
  }, [config, open])

  const handleSave = async () => {
    await onSave(form)
    onOpenChange(false)
  }

  const handleTest = async () => {
    if (!form.provider_name) return
    setTesting(true)
    try {
      await onTest(form.provider_name)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fraud API Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {config && (
            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
              <span className="text-text-muted">Status</span>
              <Badge variant={config.status === 'connected' ? 'success' : 'default'}>
                {config.status}
              </Badge>
            </div>
          )}
          {config?.api_key && (
            <p className="text-xs text-text-muted">
              Current key: <span className="font-mono">{maskApiKey(config.api_key)}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select
              value={form.provider_name ?? 'BD Courier'}
              onValueChange={(v) => setForm((f) => ({ ...f, provider_name: v as FraudProvider }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>API Base URL</Label>
            <Input
              value={form.api_base_url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, api_base_url: e.target.value }))}
              placeholder="https://api.fraud-provider.com/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input
              type="password"
              value={form.api_key ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Limit</Label>
            <Input
              type="number"
              value={form.monthly_limit ?? 1000}
              onChange={(e) => setForm((f) => ({ ...f, monthly_limit: Number(e.target.value) }))}
            />
          </div>
          {config && (
            <p className="text-xs text-text-muted">
              Used checks: {config.used_checks} / {config.monthly_limit}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleTest} disabled={testing || loading}>
            {testing && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
            Test Connection
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
