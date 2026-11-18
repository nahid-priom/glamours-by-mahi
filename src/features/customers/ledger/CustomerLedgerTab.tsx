import { Fragment, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { enterpriseReadable } from '@/components/enterprise-readable'
import { cn } from '@/lib/utils'
import { downloadCsv, formatBDT } from '@/lib/format'
import { partyLedgerEntryLabel } from '@/lib/party-ledger'
import { queryKeys } from '@/lib/query/keys'
import {
  CUSTOMER_COLLECTION_ENTRY_TYPES,
  CUSTOMER_SALE_ENTRY_TYPES,
  getCustomerLedgerStatement,
} from '../repositories/customers.repository'

type DatePreset = '7d' | '30d' | 'month' | 'all' | 'custom'

type Props = {
  customerId: string
}

function presetRange(preset: DatePreset): { from: string | null; to: string | null } {
  const to = new Date()
  const toIso = to.toISOString()
  if (preset === 'all') return { from: null, to: null }
  if (preset === 'month') {
    const from = new Date(to.getFullYear(), to.getMonth(), 1)
    return { from: from.toISOString(), to: toIso }
  }
  const days = preset === '7d' ? 7 : 30
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: toIso }
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

export function CustomerLedgerTab({ customerId }: Props) {
  const [preset, setPreset] = useState<DatePreset>('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [entryFilter, setEntryFilter] = useState<'all' | 'sales' | 'collections'>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const pageSize = 25

  const range = useMemo(() => {
    if (preset === 'custom') {
      return {
        from: customFrom ? new Date(customFrom).toISOString() : null,
        to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : null,
      }
    }
    return presetRange(preset)
  }, [preset, customFrom, customTo])

  const entryTypes = useMemo(() => {
    if (entryFilter === 'sales') return [...CUSTOMER_SALE_ENTRY_TYPES]
    if (entryFilter === 'collections') return [...CUSTOMER_COLLECTION_ENTRY_TYPES]
    return null
  }, [entryFilter])

  const filters = useMemo(
    () => ({
      customerId,
      from: range.from,
      to: range.to,
      entryTypes,
      search,
      page,
      pageSize,
    }),
    [customerId, range.from, range.to, entryTypes, search, page],
  )

  const { data: statement, isLoading, error } = useQuery({
    queryKey: queryKeys.customerLedgerStatement(filters),
    queryFn: () =>
      getCustomerLedgerStatement({
        customerId,
        from: range.from,
        to: range.to,
        entryTypes,
        search,
        page,
        pageSize,
      }),
    enabled: Boolean(customerId),
  })

  const totalPages = Math.max(1, Math.ceil((statement?.total_count ?? 0) / pageSize))

  function exportCsv() {
    const lines = statement?.lines ?? []
    downloadCsv(
      `customer-ledger-${customerId.slice(0, 8)}.csv`,
      ['Date', 'Type', 'Reference', 'Due increase', 'Due decrease', 'Running balance', 'Notes'],
      lines.map((row) => [
        row.occurred_at,
        partyLedgerEntryLabel(row.entry_type),
        row.reference_id ?? '',
        row.due_increase,
        row.due_decrease,
        row.running_balance,
        row.notes ?? '',
      ]),
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Opening" value={formatBDT(statement?.opening_balance ?? 0)} />
        <Kpi label="Total sales" value={formatBDT(statement?.total_sales ?? 0)} />
        <Kpi label="Total collections" value={formatBDT(statement?.total_collections ?? 0)} />
        <Kpi label="Closing due" value={formatBDT(statement?.closing_due ?? 0)} accent />
      </div>

      {(statement?.total_returns ?? 0) > 0 || (statement?.total_adjustments ?? 0) !== 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Returns / credits" value={formatBDT(statement?.total_returns ?? 0)} />
          <Kpi label="Adjustments (net)" value={formatBDT(statement?.total_adjustments ?? 0)} />
        </div>
      ) : null}

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
          <>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">From</label>
              <Input
                type="date"
                className="h-9 w-auto"
                value={customFrom}
                onChange={(e) => {
                  setCustomFrom(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">To</label>
              <Input
                type="date"
                className="h-9 w-auto"
                value={customTo}
                onChange={(e) => {
                  setCustomTo(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </>
        ) : null}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Type</label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
            value={entryFilter}
            onChange={(e) => {
              setEntryFilter(e.target.value as 'all' | 'sales' | 'collections')
              setPage(1)
            }}
          >
            <option value="all">All</option>
            <option value="sales">Sales / opening</option>
            <option value="collections">Collections / payments</option>
          </select>
        </div>
        <div className="min-w-[10rem] flex-1">
          <label className="mb-1 block text-xs text-muted-foreground">Search</label>
          <Input
            className="h-9"
            placeholder="Notes, type, reference…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={exportCsv} disabled={!statement}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">
          Could not load ledger statement. Apply migration 00156 or check customers.read /
          accounts.read.
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-white">
        {isLoading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading statement…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead className={enterpriseReadable.tableHeader}>Date &amp; time</TableHead>
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
                const open = expanded === row.id
                const saleRef =
                  row.reference_type === 'sale' || row.reference_type === 'sale_invoice'
                    ? row.reference_id
                    : null
                return (
                  <Fragment key={row.id}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted"
                          aria-expanded={open}
                          aria-label={open ? 'Collapse row' : 'Expand row'}
                          onClick={() => setExpanded(open ? null : row.id)}
                        >
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      </TableCell>
                      <TableCell className={cn(enterpriseReadable.metadata, 'whitespace-nowrap')}>
                        {new Date(row.occurred_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="info">{partyLedgerEntryLabel(row.entry_type)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {saleRef ? (
                          <Link
                            to={`/sales/${saleRef}`}
                            className="text-[#2563EB] hover:underline"
                          >
                            View sale
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">
                            {row.reference_type ?? '—'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(enterpriseReadable.ledgerPrimary, 'text-right tabular-nums')}
                      >
                        {row.due_increase > 0 ? formatBDT(row.due_increase) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(enterpriseReadable.ledgerPrimary, 'text-right tabular-nums')}
                      >
                        {row.due_decrease > 0 ? formatBDT(row.due_decrease) : '—'}
                      </TableCell>
                      <TableCell
                        className={cn(enterpriseReadable.ledgerBalance, 'text-right tabular-nums')}
                      >
                        {formatBDT(row.running_balance)}
                      </TableCell>
                    </TableRow>
                    {open ? (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-[#F9FAFB] text-sm text-muted-foreground">
                          <div className="space-y-1 px-2 py-1">
                            <p>
                              <span className="font-medium text-foreground">Notes:</span>{' '}
                              {row.notes || '—'}
                            </p>
                            <p>
                              Reference: {row.reference_type ?? '—'}{' '}
                              {row.reference_id ? `· ${row.reference_id}` : ''}
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
        {!isLoading && (statement?.lines?.length ?? 0) === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No ledger movements for this filter.
          </p>
        ) : null}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {totalPages} · {statement?.total_count ?? 0} rows
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
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
      ) : null}
    </div>
  )
}
