import type { ReactNode } from 'react'
import { AppDateRangeField } from '@/components/date-picker'
import { formatBDT } from '@/lib/format'

export function PageHeader({
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
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-[#111827]">{title}</h1>
        {subtitle ? <p className="text-sm text-[#6B7280]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function DateRangeInputs({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (next: { from: string; to: string }) => void
}) {
  return (
    <AppDateRangeField
      label="Date range"
      from={from}
      to={to}
      onChange={({ from: f, to: t }) => onChange({ from: f, to: t })}
      className="min-w-[14rem]"
    />
  )
}

export function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-lg font-bold text-[#111827]">{value}</p>
      {hint ? <p className="text-xs text-[#6B7280]">{hint}</p> : null}
    </div>
  )
}

export function Money({ value }: { value: number }) {
  return <span>{formatBDT(value)}</span>
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white p-8 text-center text-sm text-[#6B7280]">
      {message}
    </div>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  if (!error) return null
  const msg = error instanceof Error ? error.message : 'Something went wrong'
  return <p className="text-sm text-[#E11D48]">{msg}</p>
}

export function LoadingText({ label = 'Loading…' }: { label?: string }) {
  return <p className="text-sm text-[#6B7280]">{label}</p>
}

export function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: ReactNode[][]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-white">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b bg-[#F9FAFB] text-xs uppercase tracking-wide text-[#6B7280]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
