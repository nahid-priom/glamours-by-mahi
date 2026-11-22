import { Label } from '@/components/ui/label'
import { formatBDT } from '@/lib/format'
import type { AccountKind, FinancialAccountRow } from '@/features/accounting/repositories/simple-accounting.repository'
import { accountKindLabel, missingPaymentAccountMessage } from '@/lib/payments/resolve-payment-account'
import { Link } from 'react-router-dom'

type Props = {
  label?: string
  value: string | null
  onChange: (id: string | null) => void
  accounts: FinancialAccountRow[]
  /** Restrict to these kinds; omit for all active accounts. */
  kinds?: AccountKind[]
  required?: boolean
  disabled?: boolean
  emptyPlaceholder?: string
  className?: string
  showBalance?: boolean
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
    if (!a.is_active) return false
    if (kinds?.length && !kinds.includes(a.account_kind)) return false
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
          {eligible.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} · {accountKindLabel(a.account_kind)}
              {showBalance ? ` (${formatBDT(Number(a.current_balance))})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
