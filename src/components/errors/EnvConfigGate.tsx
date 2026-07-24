import type { ReactNode } from 'react'
import { getPublicEnvIssues } from '@/lib/env/config'
import { AppErrorPage } from '@/components/errors/AppErrorPage'

export function EnvConfigGate({ children }: { children: ReactNode }) {
  const issues = getPublicEnvIssues()
  if (issues.length === 0) return <>{children}</>

  if (import.meta.env.DEV) {
    console.error('[env-config]', issues.map((issue) => issue.message).join(' '))
  }

  return (
    <AppErrorPage
      variant="config"
      message={issues.map((issue) => issue.message).join(' ')}
    />
  )
}
