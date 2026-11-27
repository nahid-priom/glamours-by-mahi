import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AppDateRangeField } from '@/components/date-picker'
import { addDaysYmd, startOfMonthYmd, todayYmd, toQueryBounds } from '@/lib/datetime/bd'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { enterpriseReadable } from '@/components/enterprise-readable'
import { cn } from '@/lib/utils'
import { downloadCsv, formatBDT } from '@/lib/format'
import { partyLedgerEntryLabel } from '@/lib/party-ledger'
import { queryKeys } from '@/lib/query/keys'
import {
  SUPPLIER_PAYMENT_ENTRY_TYPES,
  SUPPLIER_PURCHASE_ENTRY_TYPES,
  getSupplierLedgerStatement,
} from '../repositories/suppliers.repository'

type DatePreset = '7d' | '30d' | 'month' | 'all' | 'custom'

type Props = {
  supplierId: string
}

function presetRange(preset: DatePreset): { from: string | null; to: string | null } {
  if (preset === 'all') return { from: null, to: null }
  const today = todayYmd()
  const from = preset === 'month' ? startOfMonthYmd(today) : addDaysYmd(today, preset === '7d' ? -6 : -29)
  const bounds = toQueryBounds(from, today)
  return { from: bounds.fromIso, to: bounds.toIso }
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 text-lg font-semibold tabular-nums',
          accent ? 'text-[#E11D48]' : 'text-foreground',
        )}
      >
        {value}
      </p>
    </div>
  )
}

const paymentTypes = new Set<string>(SUPPLIER_PAYMENT_ENTRY_TYPES)

export function SupplierLedgerTab({ supplierId }: Props) {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [entryFilter, setEntryFilter] = useState<'all' | 'purchases' | 'payments'>('all')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pageSize = 25

  const range = useMemo(() => {
    if (preset === 'custom') {
      const bounds = toQueryBounds(customFrom || null, customTo || null)
      return { from: bounds.fromIso, to: bounds.toIso }
    }
    return presetRange(preset)
  }, [preset, customFrom, customTo])

  const entryTypes = useMemo(() => {
    if (entryFilter === 'purchases') return [...SUPPLIER_PURCHASE_ENTRY_TYPES]
    if (entryFilter === 'payments') return [...SUPPLIER_PAYMENT_ENTRY_TYPES]
    return null
  }, [entryFilter])

  const filters = useMemo(
    () => ({
      supplierId,
      from: range.from,
      to: range.to,
      entryTypes,
      page,
      pageSize,
    }),
    [supplierId, range.from, range.to, entryTypes, page],
  )

  const { data: statement, isLoading, error } = useQuery({
    queryKey: queryKeys.supplierLedgerStatement(filters),
    queryFn: () =>
      getSupplierLedgerStatement({
        supplierId,
        from: range.from,
        to: range.to,
        entryTypes,
        page,
        pageSize,
      }),
    enabled: Boolean(supplierId),
  })

  const totalPages = Math.max(1, Math.ceil((statement?.total_count ?? 0) / pageSize))

  function exportCsv() {
    const lines = statement?.lines ?? []
    const headers = [
      'Date',
      'Type',
      'Reference',
      'Due increase',
      'Due decrease',
      'Running balance',
    ]
    const rows = lines.map((row) => [
      row.occurred_at,
      partyLedgerEntryLabel(row.entry_type),
      row.reference_id ?? '',
      row.due_increase,
      row.due_decrease,
      row.running_balance,
    ])
    downloadCsv(`supplier-ledger-filtered-${supplierId.slice(0, 8)}.csv`, headers, rows)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Opening" value={formatBDT(statement?.opening_balance ?? 0)} />
        <Kpi label="Total purchases" value={formatBDT(statement?.total_purchases ?? 0)} />
        <Kpi label="Total payments" value={formatBDT(statement?.total_payments ?? 0)} />
        <Kpi label="Closing due" value={formatBDT(statement?.closing_due ?? 0)} accent />
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Period</label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={preset}
            onChange={(e) => {
              setPreset(e.target.value as DatePreset)
              setPage(1)
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="month">This month</option>
            <option value="all">All time</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {preset === 'custom' ? (
          <AppDateRangeField
            label="From – To"
            from={customFrom}
            to={customTo}
            onChange={({ from, to }) => {
              setCustomFrom(from)
              setCustomTo(to)
              setPage(1)
            }}
          />
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Entry type</label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={entryFilter}
            onChange={(e) => {
              setEntryFilter(e.target.value as typeof entryFilter)
              setPage(1)
            }}
          >
            <option value="all">All entries</option>
            <option value="purchases">Purchases / opening</option>
            <option value="payments">Payments</option>
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="sm:ml-auto"
          disabled={!statement?.lines.length}
          onClick={exportCsv}
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV (filtered)
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
        </div>
      ) : null}
      {error ? <p className="text-sm text-[#E11D48]">Could not load supplier ledger.</p> : null}

      <div className="rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className={enterpriseReadable.tableHeader}>Date</TableHead>
              <TableHead className={enterpriseReadable.tableHeader}>Type</TableHead>
              <TableHead className={enterpriseReadable.tableHeader}>Reference</TableHead>
              <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                Due increase
              </TableHead>
              <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                Due decrease
              </TableHead>
              <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                Running balance
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(statement?.lines ?? []).map((row) => {
              const isOpen = expanded === row.id
              const isPurchase = row.reference_type === 'purchase' && row.reference_id
              const isPayment = paymentTypes.has(row.entry_type)
              const canExpand = Boolean(isPurchase || (isPayment && row.notes))
              return (
                <Fragment key={row.id}>
                  <TableRow>
                    <TableCell>
                      {canExpand ? (
                        <button
                          type="button"
                          className="rounded p-1 hover:bg-muted"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : row.id)}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{partyLedgerEntryLabel(row.entry_type)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.reference_id ? row.reference_id.slice(0, 8) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.due_increase > 0 ? formatBDT(row.due_increase) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.due_decrease > 0 ? formatBDT(row.due_decrease) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatBDT(row.running_balance)}
                    </TableCell>
                  </TableRow>
                  {isOpen ? (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/30 text-sm">
                        {isPurchase && row.reference_id ? (
                          <Link
                            to={`/purchases/${row.reference_id}`}
                            className="font-medium text-[#2563EB] hover:underline"
                          >
                            View purchase {row.reference_id.slice(0, 8)}
                          </Link>
                        ) : null}
                        {isPayment && row.notes ? (
                          <p className="text-muted-foreground">Notes: {row.notes}</p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
        {!isLoading && (statement?.lines.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No ledger entries in this period.</p>
        ) : null}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Prev
        </Button>
        <span className="self-center text-sm text-muted-foreground">
          Page {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
