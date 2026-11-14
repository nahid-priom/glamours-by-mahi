import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { enterpriseReadable } from '@/components/enterprise-readable'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatBDT } from '@/lib/format'
import { partyLedgerEntryLabel } from '@/lib/party-ledger'
import { queryKeys } from '@/lib/query/keys'
import { SupplierRatingStars, getSupplierRating, refreshSupplierRating } from '@/features/supplier-rating'
import {
  getSupplier,
  listSupplierLedger,
  listSupplierPayments,
} from '../repositories/suppliers.repository'

export function SupplierDetailPage() {
  const { id = '' } = useParams()

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: queryKeys.supplier(id),
    queryFn: () => getSupplier(id),
    enabled: Boolean(id),
  })

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    error: ledgerError,
  } = useQuery({
    queryKey: queryKeys.suppliersLedger(id),
    queryFn: () => listSupplierLedger(id),
    enabled: Boolean(id),
  })

  const { data: payments = [] } = useQuery({
    queryKey: [...queryKeys.supplier(id), 'payments'],
    queryFn: () => listSupplierPayments(id),
    enabled: Boolean(id),
  })

  const { data: rating } = useQuery({
    queryKey: [...queryKeys.supplier(id), 'rating'],
    queryFn: async () => {
      const existing = await getSupplierRating(id)
      if (existing) return existing
      return refreshSupplierRating(id)
    },
    enabled: Boolean(id),
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading supplier…
      </div>
    )
  }

  if (error || !supplier) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#E11D48]">Supplier not found.</p>
        <Button asChild variant="outline" size="sm">
          <Link to="/suppliers">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>
    )
  }

  const paymentTotal = payments.reduce((s, p) => s + Number(p.credit), 0)
  const purchaseDueTotal = ledger.reduce((sum, row) => {
    if (row.entry_type === 'purchase_due') return sum + Number(row.debit)
    if (row.entry_type === 'opening') return sum + Number(row.credit)
    return sum
  }, 0)

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1">
            <Link to="/suppliers">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Suppliers
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-[#111827]">{supplier.name}</h1>
          {rating ? (
            <div className="mt-1">
              <SupplierRatingStars score={rating.score} status={rating.rating_status} />
            </div>
          ) : null}
          <p className="text-sm text-[#6B7280]">
            {[supplier.phone, supplier.email, supplier.address].filter(Boolean).join(' · ') ||
              'No contact details'}
          </p>
        </div>
        <Badge variant={supplier.status === 'active' ? 'success' : 'default'}>
          {supplier.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Current due" value={formatBDT(Number(supplier.current_due))} accent />
        <Kpi label="Ledger entries" value={String(ledger.length)} />
        <Kpi label="Payments" value={String(payments.length)} />
        <Kpi label="Paid total" value={formatBDT(paymentTotal)} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
        <Kpi label="Purchase / opening due" value={formatBDT(purchaseDueTotal)} />
        <Kpi
          label="Last movement"
          value={
            ledger[0]?.occurred_at
              ? new Date(ledger[0].occurred_at).toLocaleDateString()
              : '—'
          }
        />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[#111827]">Supplier ledger</h2>
          {ledgerLoading ? (
            <span className="text-xs text-[#6B7280]">Loading ledger…</span>
          ) : null}
        </div>
        {ledgerError ? (
          <p className="mb-2 text-sm text-[#E11D48]">
            Could not load ledger. Check suppliers.read or accounts.read permission.
          </p>
        ) : null}
        <div className="@container min-w-0 rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={enterpriseReadable.tableHeader}>Date</TableHead>
                <TableHead className={enterpriseReadable.tableHeader}>Type</TableHead>
                <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                  Debit
                </TableHead>
                <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                  Credit
                </TableHead>
                <TableHead className={cn(enterpriseReadable.tableHeader, 'text-right')}>
                  Balance
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((row) => (
                <TableRow key={row.id} className="min-h-16">
                  <TableCell className={cn(enterpriseReadable.metadata, 'whitespace-nowrap')}>
                    {new Date(row.occurred_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="info">{partyLedgerEntryLabel(row.entry_type)}</Badge>
                    {row.notes ? (
                      <p className={cn(enterpriseReadable.metadata, 'mt-0.5')}>{row.notes}</p>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={cn(enterpriseReadable.ledgerPrimary, 'text-right whitespace-nowrap')}
                  >
                    {formatBDT(Number(row.debit))}
                  </TableCell>
                  <TableCell
                    className={cn(enterpriseReadable.ledgerPrimary, 'text-right whitespace-nowrap')}
                  >
                    {formatBDT(Number(row.credit))}
                  </TableCell>
                  <TableCell
                    className={cn(enterpriseReadable.ledgerBalance, 'text-right whitespace-nowrap')}
                  >
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
