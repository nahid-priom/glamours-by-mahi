import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatBDT, formatDateTime } from '@/lib/format'
import { maskApiKey } from '@/lib/service-utils'
import { cn } from '@/lib/utils'
import type { Courier } from './couriers.types'
import type { TrackingDemoResult } from './couriers.types'
import { courierApiDemoService } from './courier-api-demo.service'
import { Loader2, Wifi, WifiOff } from 'lucide-react'

interface CourierDetailsDrawerProps {
  courier: Courier | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: (courier: Courier) => void
  onApiSettings: (courier: Courier) => void
}

const connectionVariant = {
  connected: 'success' as const,
  disconnected: 'default' as const,
  testing: 'warning' as const,
  failed: 'danger' as const,
}

export function CourierDetailsDrawer({
  courier,
  open,
  onOpenChange,
  onEdit,
  onApiSettings,
}: CourierDetailsDrawerProps) {
  const [tracking, setTracking] = useState<TrackingDemoResult | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)

  if (!courier) return null

  const handleTrackDemo = async () => {
    if (!courier.id) return
    setTrackingLoading(true)
    try {
      const demoTrackingId = `${courier.code}-DEMO-12345`
      const result = await courierApiDemoService.trackParcelDemo(demoTrackingId, courier.id)
      setTracking(result)
    } finally {
      setTrackingLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {courier.name}
            <Badge variant={connectionVariant[courier.connection_status]} className="capitalize">
              {courier.connection_status}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 px-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Code" value={courier.code} />
            <Stat label="Status" value={courier.status} />
            <Stat label="Success Rate" value={`${courier.success_rate}%`} highlight="text-success" />
            <Stat label="Pending" value={courier.pending_parcels} />
            <Stat label="Delivered" value={courier.delivered_parcels} highlight="text-success" />
            <Stat label="Returned" value={courier.returned_parcels} highlight="text-danger" />
            <Stat label="Collection" value={formatBDT(courier.collection_amount)} className="col-span-2" />
          </div>

          <div className="rounded-xl border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase text-text-muted">API Configuration</p>
            <div className="space-y-1.5">
              <Row label="Base URL" value={courier.api_base_url ?? 'Not configured'} />
              <Row label="API Key" value={maskApiKey(courier.api_key)} />
              <Row label="Service Type" value={courier.default_service_type ?? '—'} />
              <Row
                label="Last Sync"
                value={courier.last_sync_at ? formatDateTime(courier.last_sync_at) : 'Never'}
              />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {courier.api_key ? (
                <Wifi className="h-4 w-4 text-success" />
              ) : (
                <WifiOff className="h-4 w-4 text-text-muted" />
              )}
              <span className="text-xs text-text-muted">
                {courier.api_key ? 'API credentials configured' : 'No API credentials'}
              </span>
            </div>
          </div>

          {tracking && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-text-muted">Tracking Demo</p>
              <p className="font-medium">{tracking.tracking_id}</p>
              <Badge variant="warning" className="mt-1">{tracking.status}</Badge>
              <div className="mt-3 space-y-2">
                {tracking.timeline.map((event, i) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 text-text-muted">
                      {formatDateTime(event.timestamp)}
                    </span>
                    <span>{event.status}{event.location ? ` — ${event.location}` : ''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(courier)}>Edit</Button>
            <Button size="sm" variant="outline" onClick={() => onApiSettings(courier)}>
              API Settings
            </Button>
            <Button size="sm" variant="outline" onClick={handleTrackDemo} disabled={trackingLoading}>
              {trackingLoading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Track Demo
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Stat({
  label,
  value,
  highlight,
  className,
}: {
  label: string
  value: string | number
  highlight?: string
  className?: string
}) {
  return (
    <div className={cn('rounded-lg bg-slate-50 p-2.5 text-center', className)}>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={cn('mt-0.5 font-semibold', highlight)}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{value}</span>
    </div>
  )
}
