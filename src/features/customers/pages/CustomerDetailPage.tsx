import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatBDT } from '@/lib/format'
import { partyLedgerEntryLabel } from '@/lib/party-ledger'
import { queryKeys } from '@/lib/query/keys'
import {
  getCustomer,
  listCustomerCollections,
  listCustomerLedger,
} from '../repositories/customers.repository'

export function CustomerDetailPage() {
  const { id = '' } = useParams()

  const { data: customer, isLoading, error } = useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () => getCustomer(id),
    enabled: Boolean(id),
  })

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    error: ledgerError,
  } = useQuery({
    queryKey: queryKeys.customersLedger(id),
    queryFn: () => listCustomerLedger(id),
    enabled: Boolean(id),
  })

  const { data: collections = [] } = useQuery({
    queryKey: [...queryKeys.customer(id), 'collections'],
    queryFn: () => listCustomerCollections(id),
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading customer…
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#E11D48]">Customer not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/customers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
    )
  }

  const collectionTotal = collections.reduce((s, row) => s + Number(row.credit), 0)
  const invoicedTotal = ledger
    .filter((row) => row.entry_type === 'sale_invoice' || row.entry_type === 'sale_due' || row.entry_type === 'opening')
    .reduce((s, row) => s + Number(row.debit), 0)
  const paidLedgerTotal = ledger
    .filter((row) =>
      ['sale_payment', 'collection', 'return_credit', 'reversal'].includes(row.entry_type),
    )
    .reduce((s, row) => s + Number(row.credit), 0)

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/customers">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Customers
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-[#111827]">{customer.name}</h1>
          <p className="text-sm text-[#6B7280]">
            {[customer.phone, customer.email, customer.district, customer.address]
              .filter(Boolean)
              .join(' · ') || 'No contact details'}
          </p>
        </div>
        <Badge
          variant={
            customer.status === 'active'
              ? 'success'
              : customer.status === 'blocked'
                ? 'danger'
                : 'default'
          }
        >
          {customer.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Current due" value={formatBDT(Number(customer.current_due))} accent />
        <Kpi label="Ledger entries" value={String(ledger.length)} />
        <Kpi label="Collections" value={String(collections.length)} />
        <Kpi label="Collected total" value={formatBDT(collectionTotal)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Total spent" value={formatBDT(Number(customer.total_spent))} />
        <Kpi label="Invoiced (ledger)" value={formatBDT(invoicedTotal)} />
        <Kpi label="Credits (ledger)" value={formatBDT(paidLedgerTotal)} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">Customer ledger</h2>
          {ledgerLoading ? (
            <span className="text-xs text-[#6B7280]">Loading ledger…</span>
          ) : null}
        </div>
        {ledgerError ? (
          <p className="mb-2 text-sm text-[#E11D48]">
            Could not load ledger. Check customers.read or accounts.read permission.
          </p>
        ) : null}
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-[#6B7280]">
                    {new Date(row.occurred_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{partyLedgerEntryLabel(row.entry_type)}</Badge>
                    {row.notes ? (
                      <p className="mt-0.5 text-xs text-[#9CA3AF]">{row.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{formatBDT(Number(row.debit))}</TableCell>
                  <TableCell className="text-right">{formatBDT(Number(row.credit))}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatBDT(Number(row.balance_after))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!ledgerLoading && ledger.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#6B7280]">
              No ledger movements yet. If due shows above, run party ledger backfill migration.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[#6B7280]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${accent ? 'text-[#E11D48]' : 'text-[#111827]'}`}>
        {value}
      </p>
    </div>
  )
}
