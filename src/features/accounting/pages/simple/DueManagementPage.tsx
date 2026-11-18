import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { simpleAccountingRepository } from '../../repositories/simple-accounting.repository'
import { financialQueries, financialQueryKeys } from '../../lib/financial-queries'
import { PageHeader, DataTable, ErrorText, EmptyState, KpiCard } from '../../components/AccountingUi'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  invalidateCustomerCollectionCaches,
  invalidateSupplierPaymentCaches,
} from '@/lib/mutations/party-finance-cache'
import {
  NO_PAYMENT_ACCOUNT_MESSAGE,
  resolvePaymentAccount,
} from '@/lib/payments/resolve-payment-account'
import { listPaymentMethods } from '@/features/sales/repositories/sales.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { cn } from '@/lib/utils'

type Tab = 'customers' | 'suppliers'
type PartyRow = { id: string; name: string; phone: string | null; due: number }

export function DueManagementPage() {
  const { activeBranchId, profile } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'suppliers' ? 'suppliers' : 'customers'

  const [selected, setSelected] = useState<PartyRow | null>(null)
  const [detail, setDetail] = useState<PartyRow | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState('cash')
  const [reference, setReference] = useState('')

  const setTab = (next: Tab) => {
    setParams({ tab: next }, { replace: true })
    setSelected(null)
    setDetail(null)
  }

  const customersQuery = useQuery({
    queryKey: financialQueryKeys.dues('customers'),
    queryFn: () => financialQueries.listCustomerDues(),
    enabled: tab === 'customers',
  })

  const suppliersQuery = useQuery({
    queryKey: financialQueryKeys.dues('suppliers'),
    queryFn: () => financialQueries.listSupplierDues(),
    enabled: tab === 'suppliers',
  })

  const agingQuery = useQuery({
    queryKey: financialQueryKeys.dueAging(tab === 'customers' ? 'customer' : 'supplier'),
    queryFn: () =>
      financialQueries.getPartyDueAging(tab === 'customers' ? 'customer' : 'supplier'),
  })

  const rows = tab === 'customers' ? (customersQuery.data ?? []) : (suppliersQuery.data ?? [])
  const isLoading = tab === 'customers' ? customersQuery.isLoading : suppliersQuery.isLoading
  const error = tab === 'customers' ? customersQuery.error : suppliersQuery.error

  // Deep-link from customer/supplier profile Collect/Pay CTAs
  useEffect(() => {
    const customerId = params.get('customerId')
    const supplierId = params.get('supplierId')
    if (tab === 'customers' && customerId && customersQuery.data) {
      const match = customersQuery.data.find((r) => r.id === customerId)
      if (match) setSelected(match)
    }
    if (tab === 'suppliers' && supplierId && suppliersQuery.data) {
      const match = suppliersQuery.data.find((r) => r.id === supplierId)
      if (match) setSelected(match)
    }
  }, [tab, params, customersQuery.data, suppliersQuery.data])

  const partyDueTotal = rows.reduce((s, r) => s + r.due, 0)
  const invoiceDueTotal = agingQuery.data?.totalDue ?? null
  const reconDiff =
    invoiceDueTotal == null ? null : Math.round((partyDueTotal - invoiceDueTotal) * 100) / 100

  const detailQuery = useQuery({
    queryKey: financialQueryKeys.partyDetail(tab === 'customers' ? 'customer' : 'supplier', detail?.id ?? ''),
    enabled: Boolean(detail?.id),
    queryFn: async () => {
      if (!detail) throw new Error('No party')
      if (tab === 'customers') {
        const [invoices, ledger] = await Promise.all([
          financialQueries.listOpenCustomerInvoices(detail.id),
          financialQueries.listCustomerLedgerEntries(detail.id),
        ])
        return { invoices, ledger }
      }
      const [invoices, ledger] = await Promise.all([
        financialQueries.listOpenSupplierPurchases(detail.id),
        financialQueries.listSupplierLedgerEntries(detail.id),
      ])
      return { invoices, ledger }
    },
  })

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const { data: accounts = [] } = useQuery({
    queryKey: [...queryKeys.accounts, 'fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: settings } = useQuery({
    queryKey: [...queryKeys.accounts, 'settings', profile?.organization_id],
    enabled: Boolean(profile?.organization_id),
    queryFn: () => simpleAccountingRepository.getAccountSettings(profile!.organization_id),
  })

  const payMethods = useMemo(() => methods.filter((m) => !m.is_due), [methods])

  const resolved = useMemo(
    () =>
      resolvePaymentAccount({
        methodCode: method,
        branchId: activeBranchId,
        methods: payMethods,
        accounts,
        settings: settings ?? null,
      }),
    [method, activeBranchId, payMethods, accounts, settings],
  )

  const collect = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a customer')
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const receiveAccountId = resolved?.account.id ?? null
      if (!receiveAccountId) throw new Error(NO_PAYMENT_ACCOUNT_MESSAGE)
      return simpleAccountingRepository.collectCustomerDue({
        customer_id: selected.id,
        amount: amt,
        payment_method: method,
        financial_account_id: receiveAccountId,
        branch_id: activeBranchId,
        reference: reference || null,
      })
    },
    onSuccess: async () => {
      toast('Collection recorded')
      const customerId = selected?.id
      setSelected(null)
      setAmount('')
      setReference('')
      await invalidateCustomerCollectionCaches(qc, {
        customerId,
        branchId: activeBranchId,
      })
      await qc.invalidateQueries({ queryKey: financialQueryKeys.dues('customers') })
      await qc.invalidateQueries({ queryKey: financialQueryKeys.dueAging('customer') })
      if (customerId) {
        await qc.invalidateQueries({
          queryKey: financialQueryKeys.partyDetail('customer', customerId),
        })
      }
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const pay = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Select a supplier')
      if (!activeBranchId) throw new Error('Select an active branch first')
      const amt = Number(amount)
      if (!amt || amt <= 0) throw new Error('Enter a valid amount')
      const fa = resolved?.account.id ?? null
      if (!fa) throw new Error(NO_PAYMENT_ACCOUNT_MESSAGE)
      return simpleAccountingRepository.paySupplier({
        supplier_id: selected.id,
        amount: amt,
        method,
        financial_account_id: fa,
        branch_id: activeBranchId,
        reference: reference || null,
      })
    },
    onSuccess: async () => {
      toast('Payment recorded')
      const supplierId = selected?.id
      setSelected(null)
      setAmount('')
      setReference('')
      await invalidateSupplierPaymentCaches(qc, {
        supplierId,
        branchId: activeBranchId,
      })
      await qc.invalidateQueries({ queryKey: financialQueryKeys.dues('suppliers') })
      await qc.invalidateQueries({ queryKey: financialQueryKeys.dueAging('supplier') })
      if (supplierId) {
        await qc.invalidateQueries({
          queryKey: financialQueryKeys.partyDetail('supplier', supplierId),
        })
      }
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const aging = agingQuery.data
  const undated = aging?.undated ?? 0
  const overdue = aging?.dueDateSupported ? (aging?.overdue ?? 0) : 0
  const currentBucket = aging?.dueDateSupported ? (aging?.current ?? 0) : 0

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-4">
      <PageHeader
        title="Due Management"
        subtitle="Party balances are authoritative. Invoice aging is separate and never invents overdue from sale date alone."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/sales/collections">Full collections</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to="/purchases/payments">Supplier payments</Link>
            </Button>
          </div>
        }
      />

      <div className="flex rounded-lg border border-border bg-white p-1 text-sm">
        {(
          [
            ['customers', 'Customers'],
            ['suppliers', 'Suppliers'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              'flex-1 rounded-md px-3 py-2 font-medium',
              tab === id ? 'bg-[#111827] text-white' : 'text-[#6B7280]',
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label={tab === 'customers' ? 'Total customer receivables' : 'Total supplier payables'}
          value={formatBDT(partyDueTotal)}
          hint="Authoritative party current_due"
        />
        <KpiCard
          label={tab === 'customers' ? 'Open customer invoices' : 'Open purchase invoices'}
          value={invoiceDueTotal == null ? '…' : formatBDT(invoiceDueTotal)}
          hint="Sum of open document due_total"
        />
        <KpiCard
          label="Party − open invoices"
          value={reconDiff == null ? '…' : formatBDT(reconDiff)}
          hint="Opening / adjustments / other (not rewritten)"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard label="Due Date Not Set" value={formatBDT(undated)} hint="Invoice aging · undated" />
        <KpiCard
          label="Current (dated)"
          value={aging?.dueDateSupported ? formatBDT(currentBucket) : 'N/A'}
          hint={aging?.dueDateSupported ? 'Due date ≥ today' : 'Set due dates to enable'}
        />
        <KpiCard
          label="Overdue"
          value={aging?.dueDateSupported ? formatBDT(overdue) : 'N/A'}
          hint={
            aging?.dueDateSupported
              ? 'Only invoices with past due_date'
              : 'Not calculated without due dates'
          }
        />
      </div>

      {agingQuery.isLoading ? <Skeleton className="h-16" /> : null}
      {reconDiff != null && Math.abs(reconDiff) >= 0.01 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Party balance and open invoice totals differ by {formatBDT(reconDiff)}. This is usually
          opening balances, credits, adjustments, or documents outside the invoice filter — not
          silently forced equal. Collect/Pay still posts against party current_due via existing
          RPCs.
        </p>
      ) : null}
      {!aging?.dueDateSupported ? (
        <p className="rounded-xl border border-border bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
          Aging overdue is unavailable until due dates are set. Undated invoices stay in{' '}
          <strong>Due Date Not Set</strong> — never treated as overdue from document date alone.
        </p>
      ) : undated > 0 ? (
        <p className="rounded-xl border border-border bg-[#F9FAFB] px-4 py-3 text-sm text-[#6B7280]">
          {formatBDT(undated)} has no due date and is shown as <strong>Due Date Not Set</strong>.
        </p>
      ) : null}

      {isLoading ? <Skeleton className="h-40" /> : null}
      <ErrorText error={error} />
      {!isLoading && rows.length === 0 ? (
        <EmptyState message={tab === 'customers' ? 'No customer dues.' : 'No supplier dues.'} />
      ) : null}

      {rows.length > 0 ? (
        <DataTable
          headers={[tab === 'customers' ? 'Customer' : 'Supplier', 'Phone', 'Party due', '']}
          rows={rows.map((r) => [
            r.name,
            r.phone || '—',
            formatBDT(r.due),
            <div key={r.id} className="flex flex-wrap justify-end gap-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setDetail(r)}>
                Details
              </Button>
              {tab === 'customers' ? (
                <PermissionGate
                  permission={['customer_due.collect', 'accounts.manage', 'accounts.post', 'sales.read']}
                >
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelected(r)
                      setAmount(String(r.due))
                    }}
                  >
                    Collect
                  </Button>
                </PermissionGate>
              ) : (
                <PermissionGate
                  permission={['supplier_due.pay', 'accounts.manage', 'accounts.post', 'purchases.create']}
                >
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSelected(r)
                      setAmount(String(r.due))
                    }}
                  >
                    Pay
                  </Button>
                </PermissionGate>
              )}
            </div>,
          ])}
        />
      ) : null}

      <Dialog open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {detail?.name} · {formatBDT(detail?.due ?? 0)} party due
            </DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-4 text-sm">
              <p className="text-[#6B7280]">Phone {detail.phone || '—'}</p>
              {detailQuery.isLoading ? <Skeleton className="h-24" /> : null}
              <ErrorText error={detailQuery.error} />

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-[#111827]">Open invoices</h3>
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                    <Link to={tab === 'customers' ? `/customers/${detail.id}` : `/suppliers/${detail.id}`}>
                      Party profile
                    </Link>
                  </Button>
                </div>
                {(detailQuery.data?.invoices.length ?? 0) === 0 ? (
                  <p className="text-[#6B7280]">No open invoices with remaining due_total.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="px-2 py-1.5">Invoice</th>
                          <th className="px-2 py-1.5">Date</th>
                          <th className="px-2 py-1.5">Due date</th>
                          <th className="px-2 py-1.5 text-right">Remaining</th>
                          <th className="px-2 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {(detailQuery.data?.invoices ?? []).map((inv) => (
                          <tr key={inv.id} className="border-t">
                            <td className="px-2 py-1.5 font-mono">{inv.invoiceNo}</td>
                            <td className="px-2 py-1.5">{inv.docDate}</td>
                            <td className="px-2 py-1.5">{inv.dueDate ?? 'Not set'}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {formatBDT(inv.remainingDue)}
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Link
                                className="text-[#E11D48]"
                                to={tab === 'customers' ? `/sales/${inv.id}` : `/purchases/${inv.id}`}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-[#111827]">Recent ledger</h3>
                {(detailQuery.data?.ledger.length ?? 0) === 0 ? (
                  <p className="text-[#6B7280]">No ledger rows.</p>
                ) : (
                  <ul className="divide-y divide-border rounded-lg border border-border">
                    {(detailQuery.data?.ledger ?? []).slice(0, 12).map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium capitalize text-[#111827]">
                            {e.entryType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[#6B7280]">
                            {e.occurredAt.slice(0, 10)}
                            {e.notes ? ` · ${e.notes}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums">
                          {e.debit > 0 ? `+${formatBDT(e.debit)}` : `−${formatBDT(e.credit)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelected(detail)
                    setAmount(String(detail.due))
                  }}
                >
                  {tab === 'customers' ? 'Collect payment' : 'Pay supplier'}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={tab === 'customers' ? '/sales/collections' : '/purchases/payments'}>
                    Canonical payment page
                  </Link>
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {tab === 'customers' ? 'Collect due' : 'Pay supplier'} — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-[#6B7280]">Outstanding {formatBDT(selected?.due ?? 0)}</p>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                {payMethods.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Reference</Label>
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" />
            </div>
            <Button
              className="w-full"
              disabled={tab === 'customers' ? collect.isPending : pay.isPending}
              onClick={() => (tab === 'customers' ? collect.mutate() : pay.mutate())}
            >
              {tab === 'customers' ? 'Collect' : 'Pay'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
