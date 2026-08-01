import type { ReactNode } from 'react'

export function CardField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-xs">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">{value}</span>
    </div>
  )
}
