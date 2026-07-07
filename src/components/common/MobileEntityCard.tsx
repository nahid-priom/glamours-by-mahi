import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ActionDropdown, type ActionItem } from './ActionDropdown'

interface MobileEntityCardProps {
  title: string
  subtitle?: string
  badges?: ReactNode
  rows: { label: string; value: ReactNode }[]
  actions?: ActionItem[]
  onClick?: () => void
  muted?: boolean
}

export function MobileEntityCard({
  title,
  subtitle,
  badges,
  rows,
  actions,
  onClick,
  muted,
}: MobileEntityCardProps) {
  return (
    <Card className={muted ? 'opacity-60' : undefined}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onClick}>
            <p className="font-semibold">{title}</p>
            {subtitle && <p className="text-xs text-text-muted">{subtitle}</p>}
            {badges && <div className="mt-2 flex flex-wrap gap-1">{badges}</div>}
          </button>
          {actions && actions.length > 0 && <ActionDropdown items={actions} />}
        </div>
        <div className="mt-3 space-y-1.5">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between text-xs">
              <span className="text-text-muted">{row.label}</span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export { Badge }
