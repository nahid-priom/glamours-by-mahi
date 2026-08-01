import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { resolveBreadcrumbs } from './breadcrumb-registry'
import { cn } from '@/lib/utils'

interface AppBreadcrumbsProps {
  /** Optional entity id → display label overrides for dynamic routes. */
  labels?: Record<string, string>
  className?: string
}

export function AppBreadcrumbs({ labels, className }: AppBreadcrumbsProps) {
  const { pathname } = useLocation()
  const crumbs = resolveBreadcrumbs(pathname, labels)

  if (pathname === '/dashboard' || pathname === '/sales/pos' || pathname === '/sales/new') {
    return null
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('mb-3 flex min-w-0 items-center gap-1 overflow-x-auto text-xs text-text-muted', className)}
    >
      <Link
        to="/dashboard"
        className="inline-flex shrink-0 items-center rounded p-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Dashboard home"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${i}`} className="inline-flex shrink-0 items-center gap-1">
            <ChevronRight className="h-3 w-3 opacity-50" aria-hidden />
            {isLast || !crumb.to ? (
              <span className="font-medium text-foreground" aria-current={isLast ? 'page' : undefined}>
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
