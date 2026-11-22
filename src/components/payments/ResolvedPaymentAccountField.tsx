import { Link } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import { formatBDT } from '@/lib/format'
import {
  missingPaymentAccountMessage,
  type ResolvedPaymentAccount,
} from '@/lib/payments/resolve-payment-account'

type Props = {
  label?: string
  resolved: ResolvedPaymentAccount | null
  methodCode?: string | null
  /** Active branch id — used to label This branch vs Org-wide. */
  branchId?: string | null
  className?: string
}

export function ResolvedPaymentAccountField({
  label = 'Payment account',
  resolved,
  methodCode,
  branchId,
  className,
}: Props) {
  const scopeHint =
    resolved == null
      ? null
      : branchId && resolved.account.branch_id === branchId
        ? 'This branch'
        : resolved.account.branch_id == null
          ? 'Org-wide'
          : null

  return (
    <div className={className ?? 'space-y-1.5'}>
      <Label>{label}</Label>
      {resolved ? (
        <div className="flex h-9 items-center justify-between gap-2 rounded-md border border-border bg-[#F9FAFB] px-3 text-sm font-medium text-[#111827]">
          <span className="min-w-0 truncate">
            {resolved.account.name} ({formatBDT(Number(resolved.account.current_balance))})
          </span>
          {scopeHint ? (
            <span className="shrink-0 text-[11px] font-normal text-[#6B7280]">{scopeHint}</span>
          ) : null}
        </div>
      ) : (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p>{missingPaymentAccountMessage(methodCode)}</p>
          <Link
            to="/accounts/cash-bank"
            className="mt-1 inline-block font-medium text-amber-950 underline underline-offset-2"
          >
            Open Cash &amp; Bank
          </Link>
        </div>
      )}
    </div>
  )
}

/** Shared empty-state for account-first pickers (e.g. POS). */
export function MissingBranchAccountsNotice({ className }: { className?: string }) {
  return (
    <div
      className={
        className ??
        'rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900'
      }
    >
      <p>{missingPaymentAccountMessage(null)}</p>
      <Link
        to="/accounts/cash-bank"
        className="mt-1 inline-block font-medium text-amber-950 underline underline-offset-2"
      >
        Open Cash &amp; Bank
      </Link>
    </div>
  )
}
