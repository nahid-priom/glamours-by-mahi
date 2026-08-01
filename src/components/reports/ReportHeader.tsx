import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'

export function ReportHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
        {subtitle ? <p className="text-sm text-[#6B7280]">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  )
}

export function ExportActions({ onExport, onPrint }: { onExport?: () => void; onPrint?: () => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {onExport ? (
        <Button size="sm" variant="outline" onClick={onExport}>
          Export CSV
        </Button>
      ) : null}
      {onPrint ? (
        <Button size="sm" variant="outline" onClick={onPrint}>
          Print
        </Button>
      ) : null}
    </div>
  )
}
