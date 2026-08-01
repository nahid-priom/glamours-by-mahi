import { useEffect, useRef } from 'react'
import { AlertTriangle, Home, LayoutDashboard, RefreshCw, WifiOff } from 'lucide-react'
import { Link, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { brandConfig } from '@/config/brand'
import { isChunkLoadError } from '@/lib/deployment/chunk-recovery'
import { isDevMode } from '@/lib/env/config'

export type AppErrorVariant = 'public' | 'erp' | 'offline' | 'config'

export interface AppErrorPageProps {
  variant?: AppErrorVariant
  title?: string
  message?: string
  technicalDetails?: string
  onRetry?: () => void
}

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/admin')) return false
  if (pathname.startsWith('/print/')) return false
  return true
}

function resolveVariant(pathname: string, offline = false): AppErrorVariant {
  if (offline) return 'offline'
  return isPublicPath(pathname) ? 'public' : 'erp'
}

export function AppErrorPage({
  variant,
  title,
  message,
  technicalDetails,
  onRetry,
}: AppErrorPageProps) {
  const navigate = useNavigate()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const resolvedVariant = variant ?? resolveVariant(window.location.pathname, offline)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const resolvedTitle =
    title ??
    (resolvedVariant === 'offline'
      ? "You're offline"
      : resolvedVariant === 'config'
        ? 'Configuration required'
        : 'Something went wrong')

  const resolvedMessage =
    message ??
    (resolvedVariant === 'offline'
      ? 'Check your internet connection and try again.'
      : resolvedVariant === 'config'
        ? 'This deployment is missing required environment settings. Please contact support.'
        : 'The latest version could not be loaded. Please retry.')

  const homeHref = resolvedVariant === 'erp' ? '/dashboard' : '/'
  const homeLabel = resolvedVariant === 'erp' ? 'Go to Dashboard' : 'Go to Home'
  const HomeIcon = resolvedVariant === 'erp' ? LayoutDashboard : Home

  const handleRetry = () => {
    if (onRetry) {
      onRetry()
      return
    }
    navigate(0)
  }

  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--sf-bg,#FFF9FB)] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--sf-border,#F1DCE4)] bg-white p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sf-accent-soft,#FFF1F6)]">
          {resolvedVariant === 'offline' ? (
            <WifiOff className="h-7 w-7 text-[var(--sf-primary,#FF3F7F)]" aria-hidden />
          ) : (
            <AlertTriangle className="h-7 w-7 text-[var(--sf-primary,#FF3F7F)]" aria-hidden />
          )}
        </div>

        <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sf-muted,#6F6268)]">
          {brandConfig.shortName}
        </p>

        <h1
          ref={headingRef}
          tabIndex={-1}
          className="mt-2 text-center font-serif text-2xl font-semibold text-[var(--sf-text,#22171C)] outline-none sm:text-3xl"
        >
          {resolvedTitle}
        </h1>

        <p className="mt-3 text-center text-sm leading-6 text-[var(--sf-muted,#6F6268)] sm:text-base">
          {resolvedMessage}
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={handleRetry}
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Retry
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-full sm:w-auto"
            asChild
          >
            <Link to={homeHref}>
              <HomeIcon className="h-4 w-4" aria-hidden />
              {homeLabel}
            </Link>
          </Button>
          {resolvedVariant !== 'offline' ? (
            <Button
              type="button"
              variant="secondary"
              className="min-h-11 w-full sm:w-auto"
              onClick={handleReload}
            >
              Reload Application
            </Button>
          ) : null}
        </div>

        {isDevMode() && technicalDetails ? (
          <pre className="mt-6 max-h-40 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
            {technicalDetails}
          </pre>
        ) : null}
      </div>
    </div>
  )
}

function getTechnicalDetails(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  if (typeof error === 'string') return error
  return 'Unknown error'
}

export function RouteErrorElement() {
  const error = useRouteError()
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false
  const chunkError = isChunkLoadError(error)

  if (isDevMode()) {
    console.error('[route-error]', error)
  } else if (chunkError || error instanceof Error) {
    console.error('[route-error]', error instanceof Error ? error.message : 'chunk load failure')
  }

  return (
    <AppErrorPage
      variant={offline ? 'offline' : undefined}
      technicalDetails={getTechnicalDetails(error)}
    />
  )
}
