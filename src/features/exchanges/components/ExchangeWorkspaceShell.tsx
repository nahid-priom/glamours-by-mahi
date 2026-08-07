import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EXCHANGE_STEP_LABELS, type ExchangeStep } from '../types'

type Props = {
  step: ExchangeStep
  invoiceNo?: string | null
  canGoToStep: (n: ExchangeStep) => boolean
  onStepChange: (n: ExchangeStep) => void
  children: React.ReactNode
  summary?: React.ReactNode
  className?: string
}

export function ExchangeWorkspaceShell({
  step,
  invoiceNo,
  canGoToStep,
  onStepChange,
  children,
  summary,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col gap-2',
        className,
      )}
    >
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            Exchange
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-text-primary sm:text-xl">
              New product exchange
            </h1>
            {invoiceNo ? (
              <span className="rounded-full border border-border bg-white px-2.5 py-0.5 text-xs font-medium tabular-nums text-text-primary">
                {invoiceNo}
              </span>
            ) : null}
          </div>
        </div>
        <Button variant="outline" size="sm" asChild className="rounded-xl">
          <Link to="/sales/exchanges">
            <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
            Back to list
          </Link>
        </Button>
      </header>

      <nav className="flex shrink-0 flex-wrap gap-1.5" aria-label="Exchange steps">
        {([1, 2, 3, 4] as ExchangeStep[]).map((n) => {
          const active = n === step
          const allowed = canGoToStep(n)
          return (
            <button
              key={n}
              type="button"
              disabled={!allowed && !active}
              onClick={() => allowed && onStepChange(n)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                active && 'bg-primary text-white',
                !active && allowed && 'bg-primary/10 text-primary hover:bg-primary/15',
                !active && !allowed && 'border border-border bg-white text-text-muted opacity-60',
              )}
            >
              {EXCHANGE_STEP_LABELS[n]}
            </button>
          )
        })}
      </nav>

      <div
        className={cn(
          'grid min-h-0 flex-1 gap-2',
          summary
            ? 'lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px]'
            : 'grid-cols-1',
        )}
      >
        <div
          className={cn(
            'min-h-0',
            step === 3
              ? 'overflow-hidden pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0'
              : 'overflow-y-auto overscroll-contain pb-2',
          )}
        >
          {step === 3 ? <div className="flex h-full min-h-0 flex-col">{children}</div> : children}
        </div>
        {summary ? (
          <aside className="hidden min-h-0 lg:flex lg:flex-col">{summary}</aside>
        ) : null}
      </div>
    </div>
  )
}
