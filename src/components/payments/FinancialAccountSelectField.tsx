import { Label } from '@/components/ui/label'
import { formatBDT } from '@/lib/format'
import type { AccountKind } from '@/features/accounting/repositories/simple-accounting.repository'
import { accountKindLabel, missingPaymentAccountMessage } from '@/lib/payments/resolve-payment-account'
import { Link } from 'react-router-dom'

/** Minimal FA shape — full FinancialAccountRow or lighter list queries. */
export type SelectableFinancialAccount = {
  id: string
  name: string
  account_kind?: AccountKind | string | null
  current_balance?: number | null
  is_active?: boolean | null
  branch_id?: string | null
}

type Props = {
  label?: string
  value: string | null
  onChange: (id: string | null) => void
  accounts: SelectableFinancialAccount[]
  /** Restrict to these kinds; omit for all active accounts. */
  kinds?: AccountKind[]
  required?: boolean
  disabled?: boolean
  emptyPlaceholder?: string
  className?: string
  showBalance?: boolean
}

function asKind(k: string | null | undefined): AccountKind {
  if (k === 'cash' || k === 'bank' || k === 'mobile_money' || k === 'other') return k
  return 'other'
}

export function FinancialAccountSelectField({
  label = 'Financial account',
  value,
  onChange,
  accounts,
  kinds,
  required = true,
  disabled = false,
  emptyPlaceholder = 'Select account…',
  className,
  showBalance = true,
}: Props) {
  const eligible = accounts.filter((a) => {
    if (a.is_active === false) return false
    if (kinds?.length) {
      const kind = asKind(a.account_kind ?? undefined)
      if (!kinds.includes(kind)) return false
    }
    return true
  })

  const kindHint =
    kinds?.length === 1 ? accountKindLabel(kinds[0]!) : kinds?.length ? 'matching kinds' : null

  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label>
        {label}
        {required ? <span className="text-[#E11D48]"> *</span> : null}
      </Label>
      {eligible.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p>
            {kindHint
              ? `No active ${kindHint} account is available for this branch.`
              : missingPaymentAccountMessage(null)}
          </p>
          <Link
            to="/accounts/cash-bank"
            className="mt-1 inline-block font-medium text-amber-950 underline underline-offset-2"
          >
            Open Cash &amp; Bank
          </Link>
        </div>
      ) : (
        <select
          className="flex h-[42px] w-full rounded-md border border-input bg-transparent px-2 text-sm md:h-9"
          value={value ?? ''}
          disabled={disabled}
          required={required}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">{emptyPlaceholder}</option>
          {eligible.map((a) => {
            const kind = asKind(a.account_kind ?? undefined)
            const bal =
              showBalance && a.current_balance != null && Number.isFinite(Number(a.current_balance))
                ? ` (${formatBDT(Number(a.current_balance))})`
                : ''
            return (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.account_kind != null ? ` · ${accountKindLabel(kind)}` : ''}
                {bal}
              </option>
            )
          })}
        </select>
      )}
    </div>
  )
}
