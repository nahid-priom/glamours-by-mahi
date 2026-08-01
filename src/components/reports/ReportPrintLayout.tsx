import type { ReactNode } from 'react'

export function ReportPrintLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <div className="report-print-root space-y-4 bg-white p-4 print:p-0">
      <header className="border-b pb-3 print:border-black">
        <h1 className="text-lg font-bold">{title}</h1>
        {subtitle ? <p className="text-sm text-[#6B7280]">{subtitle}</p> : null}
      </header>
      {children}
    </div>
  )
}
