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
import { maskApiKey } from '@/lib/service-utils'
import { Loader2 } from 'lucide-react'
import type { Courier, CourierApiConfigInput } from './couriers.types'
import { courierApiDemoService } from './courier-api-demo.service'

interface CourierApiConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  courier: Courier | null
  onSave: (id: string, config: CourierApiConfigInput) => Promise<void>
  onTestComplete?: (message: string, success: boolean) => void
  loading?: boolean
}

export function CourierApiConfigDialog({
  open,
  onOpenChange,
  courier,
  onSave,
  onTestComplete,
  loading,
}: CourierApiConfigDialogProps) {
  const [config, setConfig] = useState<CourierApiConfigInput>({})
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (courier && open) {
      setConfig({
        api_base_url: courier.api_base_url ?? '',
        api_key: courier.api_key ?? '',
        api_secret: courier.api_secret ?? '',
        webhook_url: courier.webhook_url ?? '',
        default_service_type: courier.default_service_type ?? 'standard',
      })
    }
  }, [courier, open])

  if (!courier) return null

  const handleSave = async () => {
    await onSave(courier.id, config)
    onOpenChange(false)
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const result = await courierApiDemoService.testCourierConnection(courier.id)
      onTestComplete?.(result.message, result.success)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>API Settings — {courier.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {courier.api_key && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-text-muted">
              Current key: <span className="font-mono">{maskApiKey(courier.api_key)}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <Label>API Base URL</Label>
            <Input
              value={config.api_base_url ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, api_base_url: e.target.value }))}
              placeholder="https://api.courier.com/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Key</Label>
            <Input
              type="password"
              value={config.api_key ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, api_key: e.target.value }))}
              placeholder="sk_live_..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>API Secret</Label>
            <Input
              type="password"
              value={config.api_secret ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, api_secret: e.target.value }))}
              placeholder="secret_..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input
              value={config.webhook_url ?? ''}
              onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))}
              placeholder="https://your-app.com/webhooks/courier"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default Service Type</Label>
            <Select
              value={config.default_service_type ?? 'standard'}
              onValueChange={(v) => setConfig((c) => ({ ...c, default_service_type: v }))}
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
