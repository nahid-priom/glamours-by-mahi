import { FinancialAccountSelectField } from '@/components/payments/FinancialAccountSelectField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatBDT } from '@/lib/format'
import { cn } from '@/lib/utils'
import { differenceLabel } from './ExchangeSummaryRail'

type Account = { id: string; name: string; account_kind?: string | null; current_balance?: number | null }

type Props = {
  returnTotal: number
  replacementTotal: number
  difference: number
  hasCustomer: boolean
  chargeAsDue: boolean
  creditAsAdvance: boolean
  paymentAccountId: string
  refundAccountId: string
  note: string
  accounts: Account[]
  pending: boolean
  onChargeAsDueChange: (v: boolean) => void
  onCreditAsAdvanceChange: (v: boolean) => void
  onPaymentAccountChange: (id: string) => void
  onRefundAccountChange: (id: string) => void
  onNoteChange: (note: string) => void
  onBack: () => void
  onConfirm: () => void
}

export function ExchangeConfirmStep({
  returnTotal,
  replacementTotal,
  difference,
  hasCustomer,
  chargeAsDue,
  creditAsAdvance,
  paymentAccountId,
  refundAccountId,
  note,
  accounts,
  pending,
  onChargeAsDueChange,
  onCreditAsAdvanceChange,
  onPaymentAccountChange,
  onRefundAccountChange,
  onNoteChange,
  onBack,
  onConfirm,
}: Props) {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-4 rounded-2xl border border-border bg-white p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">Confirm & settle</h2>
        <p className="text-xs text-text-muted">
          Review totals, choose how to settle the difference, then post the exchange.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-text-muted">Returns</p>
          <p className="text-base font-semibold tabular-nums">{formatBDT(returnTotal)}</p>
        </div>
        <div className="rounded-xl border border-border bg-slate-50 px-3 py-2.5">
          <p className="text-xs text-text-muted">Replacements</p>
          <p className="text-base font-semibold tabular-nums">{formatBDT(replacementTotal)}</p>
        </div>
      </div>

      <div
        className={cn(
          'rounded-2xl border px-4 py-4',
          difference > 0 && 'border-primary/30 bg-primary/5',
          difference < 0 && 'border-success/30 bg-success/5',
          difference === 0 && 'border-border bg-slate-50',
        )}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
          {differenceLabel(difference)}
        </p>
        <p
          className={cn(
            'mt-1 text-3xl font-bold tabular-nums',
            difference > 0 && 'text-primary',
            difference < 0 && 'text-success',
            difference === 0 && 'text-text-primary',
          )}
        >
          {formatBDT(Math.abs(difference))}
        </p>
      </div>

      {difference > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!hasCustomer}
              onClick={() => onChargeAsDueChange(true)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                chargeAsDue
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white hover:bg-slate-50',
                !hasCustomer && 'opacity-50',
              )}
            >
              Charge as due
            </button>
            <button
              type="button"
              onClick={() => onChargeAsDueChange(false)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                !chargeAsDue
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white hover:bg-slate-50',
              )}
            >
              Collect now
            </button>
          </div>
          {!chargeAsDue ? (
            <FinancialAccountSelectField
              label="Payment account"
              value={paymentAccountId || null}
              onChange={(id) => onPaymentAccountChange(id ?? '')}
              accounts={accounts}
            />
          ) : null}
        </div>
      ) : null}

      {difference < 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!hasCustomer}
              onClick={() => onCreditAsAdvanceChange(true)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                creditAsAdvance
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white hover:bg-slate-50',
                !hasCustomer && 'opacity-50',
              )}
            >
              Credit as advance
            </button>
            <button
              type="button"
              onClick={() => onCreditAsAdvanceChange(false)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                !creditAsAdvance
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white hover:bg-slate-50',
              )}
            >
              Refund now
            </button>
          </div>
          {!creditAsAdvance ? (
            <FinancialAccountSelectField
              label="Refund account"
              value={refundAccountId || null}
              onChange={(id) => onRefundAccountChange(id ?? '')}
              accounts={accounts}
            />
          ) : null}
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="exchange-note">Note</Label>
        <Input
          id="exchange-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder="Optional note"
          className="rounded-xl"
        />
      </div>

      {pending ? (
        <p className="text-xs text-text-muted">Do not close — exchange is being posted…</p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" className="rounded-xl" disabled={pending} onClick={onBack}>
          Back
        </Button>
        <Button className="rounded-xl sm:min-w-[14rem]" disabled={pending} onClick={onConfirm}>
          {pending
            ? 'Processing…'
            : `Confirm exchange · ${formatBDT(Math.abs(difference))}`}
        </Button>
      </div>
    </section>
  )
}
