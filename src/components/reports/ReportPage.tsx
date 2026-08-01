import type { ReactNode } from 'react'

export function ReportPage({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl space-y-4 ${className}`}>{children}</div>
  )
}
