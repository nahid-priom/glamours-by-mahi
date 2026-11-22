import { formatBDT } from '@/lib/format'
import { accountKindLabel } from '@/lib/payments/resolve-payment-account'
import type { AccountKind } from '@/features/accounting/repositories/simple-accounting.repository'

type Props = {
  transactionType: string
  amount: number
  paymentMethod?: string | null
  accountName: string
  accountKind: AccountKind
  branchLabel?: string | null
  sourceReference?: string | null
  partyLabel?: string | null
  className?: string
}

/** Compact confirmation card — displayed account must match the submitted FA id. */
export function PaymentAccountSummary({
  transactionType,
  amount,
  paymentMethod,
  accountName,
  accountKind,
  branchLabel,
  sourceReference,
  partyLabel,
  className,
}: Props) {
  return (
    <div
      className={
        className ??
        'space-y-1.5 rounded-xl border border-border bg-[#F9FAFB] px-3 py-3 text-sm text-[#111827]'
      }
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-[#6B7280]">
        Payment confirmation
      </p>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[#6B7280]">Type</dt>
          <dd className="font-medium">{transactionType}</dd>
        </div>
        <div>
          <dt className="text-xs text-[#6B7280]">Amount</dt>
          <dd className="font-medium tabular-nums">{formatBDT(amount)}</dd>
        </div>
        {paymentMethod ? (
          <div>
            <dt className="text-xs text-[#6B7280]">Method</dt>
            <dd className="font-medium">{paymentMethod}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-[#6B7280]">Account</dt>
          <dd className="font-medium">
            {accountName}{' '}
            <span className="font-normal text-[#6B7280]">({accountKindLabel(accountKind)})</span>
          </dd>
        </div>
        {partyLabel ? (
          <div>
            <dt className="text-xs text-[#6B7280]">Party</dt>
            <dd className="font-medium">{partyLabel}</dd>
          </div>
        ) : null}
        {branchLabel ? (
          <div>
            <dt className="text-xs text-[#6B7280]">Branch</dt>
            <dd className="font-medium">{branchLabel}</dd>
          </div>
        ) : null}
        {sourceReference ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-[#6B7280]">Reference</dt>
            <dd className="font-mono text-xs">{sourceReference}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}
