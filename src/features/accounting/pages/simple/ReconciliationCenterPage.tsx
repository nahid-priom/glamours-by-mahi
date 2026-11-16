import { useMemo, useState, type ReactNode } from 'react'
import { formatBDT } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import {
  DateRangeInputs,
  EmptyState,
  ErrorText,
  KpiCard,
  PageHeader,
} from '../../components/AccountingUi'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  useReconciliationDryRun,
  useReconciliationReport,
} from '../../hooks/use-reconciliation'

function toCsv(rows: Array<Record<string, unknown>>, filename: string) {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0]!)
  const lines = [
    keys.join(','),
    ...rows.map((r) =>
      keys
        .map((k) => {
          const v = r[k]
          const s = v == null ? '' : String(v)
          return `"${s.replaceAll('"', '""')}"`
        })
        .join(','),
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReconciliationCenterPage() {
  const { data, isLoading, error, refetch } = useReconciliationReport()
  const stockDry = useReconciliationDryRun('stock')
  const partiesDry = useReconciliationDryRun('parties')
  const financialDry = useReconciliationDryRun('financial')
  const partialDry = useReconciliationDryRun('partial')
  const { toast } = useToast()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [lastDryRun, setLastDryRun] = useState<unknown>(null)

  const customerRows = useMemo(() => data?.customer_due_deltas ?? [], [data])
  const supplierRows = useMemo(() => data?.supplier_due_deltas ?? [], [data])
  const financialRows = useMemo(() => data?.financial_balance_deltas ?? [], [data])

  const runDry = (
    mut: ReturnType<typeof useReconciliationDryRun>,
    label: string,
  ) => {
    mut.mutate(undefined, {
      onSuccess: (result: unknown) => {
        setLastDryRun(result)
        toast(`${label} dry-run complete`, 'success')
      },
      onError: (e: Error) => toastRpcError(toast, e),
    })
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Reconciliation Center"
        subtitle="Read-only diagnostics and dry-run repairs. Apply actions stay disabled for this production rollout."
        actions={
          <div className="flex flex-wrap gap-2">
            <DateRangeInputs from={from} to={to} onChange={(n: { from: string; to: string }) => { setFrom(n.from); setTo(n.to) }} />
            <Button variant="outline" onClick={() => void refetch()}>
              Refresh
            </Button>
          </div>
        }
      />

      <ErrorText error={error} />

      {isLoading ? (
        <EmptyState message="Loading reconciliation report…" />
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Balances w/o ledger"
              value={String(data.inventory_without_ledger_count)}
              hint={`Qty ${data.inventory_without_ledger_qty}`}
            />
            <KpiCard
              label="Customer due deltas"
              value={String(customerRows.length)}
            />
            <KpiCard
              label="Supplier due deltas"
              value={String(supplierRows.length)}
            />
            <KpiCard
              label="Cash-book deltas"
              value={String(financialRows.length)}
              hint={`Neg stock ${data.negative_stock_count} · Reservations ${data.active_reservations}`}
            />
          </div>

          <div className="rounded-xl border border-border bg-white p-4">
            <h2 className="text-sm font-semibold text-[#111827]">Dry-run diagnostics</h2>
            <p className="mt-1 text-xs text-[#6B7280]">
              These write reconciliation batch logs only in dry-run mode. Repair apply is intentionally disabled.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={stockDry.isPending}
                onClick={() => runDry(stockDry, 'Opening stock')}
              >
                Dry-run opening stock
              </Button>
              <Button
                variant="outline"
                disabled={partiesDry.isPending}
                onClick={() => runDry(partiesDry, 'Opening AR/AP')}
              >
                Dry-run opening AR/AP
              </Button>
              <Button
                variant="outline"
                disabled={financialDry.isPending}
                onClick={() => runDry(financialDry, 'Financial balances')}
              >
                Dry-run FT balances
              </Button>
              <Button
                variant="outline"
                disabled={partialDry.isPending}
                onClick={() => runDry(partialDry, 'Partial sales')}
              >
                Dry-run partial sales
              </Button>
              <Button disabled title="Production apply is blocked for this rollout">
                Apply repairs (disabled)
              </Button>
            </div>
            {lastDryRun ? (
              <pre className="mt-3 max-h-48 overflow-auto rounded-md bg-[#F9FAFB] p-3 text-xs">
                {JSON.stringify(lastDryRun, null, 2)}
              </pre>
            ) : null}
          </div>

          <Section
            title="Customer due vs open sales"
            onExport={() => toCsv(customerRows as Array<Record<string, unknown>>, 'customer-due-deltas.csv')}
          >
            {customerRows.length === 0 ? (
              <EmptyState message="No customer due mismatches." />
            ) : (
              <SimpleTable
                headers={['Customer', 'Customer due', 'Open sale due', 'Delta']}
                rows={customerRows.map((r) => [
                  r.name,
                  formatBDT(Number(r.customer_due)),
                  formatBDT(Number(r.open_sale_due)),
                  formatBDT(Number(r.delta)),
                ])}
              />
            )}
          </Section>

          <Section
            title="Supplier due vs open purchases"
            onExport={() => toCsv(supplierRows as Array<Record<string, unknown>>, 'supplier-due-deltas.csv')}
          >
            {supplierRows.length === 0 ? (
              <EmptyState message="No supplier due mismatches." />
            ) : (
              <SimpleTable
                headers={['Supplier', 'Supplier due', 'Open purchase due', 'Delta']}
                rows={supplierRows.map((r) => [
                  r.name,
                  formatBDT(Number(r.supplier_due)),
                  formatBDT(Number(r.open_purchase_due)),
                  formatBDT(Number(r.delta)),
                ])}
              />
            )}
          </Section>

          <Section
            title="Financial account running balances"
            onExport={() => toCsv(financialRows as Array<Record<string, unknown>>, 'financial-deltas.csv')}
          >
            {financialRows.length === 0 ? (
              <EmptyState message="No cash-book running-balance mismatches." />
            ) : (
              <SimpleTable
                headers={['Account', 'Current', 'Last txn after', 'Delta']}
                rows={financialRows.map((r) => [
                  r.name,
                  formatBDT(Number(r.current_balance)),
                  r.last_txn_balance_after == null
                    ? '—'
                    : formatBDT(Number(r.last_txn_balance_after)),
                  formatBDT(Number(r.delta)),
                ])}
              />
            )}
          </Section>

          <Section title="Unbalanced journals">
            {(data.unbalanced_journals?.length ?? 0) === 0 ? (
              <EmptyState message="No unbalanced journals." />
            ) : (
              <SimpleTable
                headers={['Entry', 'Debit', 'Credit', 'Delta']}
                rows={(data.unbalanced_journals ?? []).map((r) => [
                  r.entry_no,
                  formatBDT(Number(r.total_debit)),
                  formatBDT(Number(r.total_credit)),
                  formatBDT(Number(r.delta)),
                ])}
              />
            )}
          </Section>

          <Section title="Recent reconciliation batches">
            {(data.recent_batches?.length ?? 0) === 0 ? (
              <EmptyState message="No batches yet." />
            ) : (
              <SimpleTable
                headers={['Type', 'Mode', 'Status', 'Created']}
                rows={(data.recent_batches ?? []).map((b) => [
                  b.batch_type,
                  b.mode,
                  b.status,
                  new Date(b.created_at).toLocaleString(),
                ])}
              />
            )}
          </Section>
        </>
      ) : (
        <EmptyState message="No reconciliation data." />
      )}
    </div>
  )
}

function Section({
  title,
  children,
  onExport,
}: {
  title: string
  children: ReactNode
  onExport?: () => void
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#111827]">{title}</h2>
        {onExport ? (
          <Button size="sm" variant="outline" onClick={onExport}>
            Export CSV
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
