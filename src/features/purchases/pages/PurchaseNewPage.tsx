import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { purchasesRepository } from '../repositories/purchases.repository'
import { PurchaseQuickAddSupplierDialog } from '../components/PurchaseQuickAddSupplierDialog'
import { simpleAccountingRepository } from '@/features/accounting/repositories/simple-accounting.repository'
import { listPaymentMethods } from '@/features/sales/repositories/sales.repository'
import { EntityCombobox } from '@/components/entity-combobox'
import { useAuth } from '@/features/auth/auth-session'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { formatBDT } from '@/lib/format'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { invalidatePurchaseCompletionCaches } from '@/lib/mutations/party-finance-cache'
import { ResolvedPaymentAccountField } from '@/components/payments/ResolvedPaymentAccountField'
import {
  missingPaymentAccountMessage,
  resolvePaymentAccount,
} from '@/lib/payments/resolve-payment-account'
import { queryKeys } from '@/lib/query/keys'

type Line = {
  variantId: string
  label: string
  qty: number
  unitCost: number
  lineDiscount: number
}

export function PurchaseNewPage() {
  const { activeBranchId, profile, can } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [lines, setLines] = useState<Line[]>([])
  const [discount, setDiscount] = useState(0)
  const [tax, setTax] = useState(0)
  const [shipping, setShipping] = useState(0)
  const [note, setNote] = useState('')
  const [payAmount, setPayAmount] = useState(0)
  const [payMethod, setPayMethod] = useState('cash')

  const canCreateSupplier = can('suppliers.manage')

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
      payMethod === 'due'
        ? null
        : resolvePaymentAccount({
            methodCode: payMethod,
            branchId: activeBranchId,
            methods: payMethods,
            accounts,
            settings: settings ?? null,
          }),
    [payMethod, activeBranchId, payMethods, accounts, settings],
  )

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitCost - l.lineDiscount, 0)
  const grandTotal = Math.max(0, subtotal - discount + tax + shipping)

  const complete = useMutation({
    mutationFn: () => {
      if (!activeBranchId || !supplierId || lines.length === 0) {
        throw new Error('Branch, supplier, and line items are required')
      }
      if (payAmount > 0) {
        if (payMethod === 'due') throw new Error('Choose a payment method for pay-now amount')
        if (!resolved?.account.id) throw new Error(missingPaymentAccountMessage(payMethod))
      }
      const payments =
        payAmount > 0
          ? [
              {
                method: payMethod,
                amount: Math.min(payAmount, grandTotal),
                financial_account_id: resolved!.account.id,
              },
            ]
          : [{ method: 'due', amount: grandTotal }]

      return purchasesRepository.completePurchase({
        branch_id: activeBranchId,
        supplier_id: supplierId,
        client_txn_key: crypto.randomUUID(),
        discount,
        tax,
        shipping,
        note: note || undefined,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          qty: l.qty,
          unit_cost: l.unitCost,
          line_discount: l.lineDiscount,
        })),
        payments,
      })
    },
    onSuccess: async (res) => {
      await invalidatePurchaseCompletionCaches(qc, {
        supplierId,
        branchId: activeBranchId,
      })
      const label = res?.invoice_no ? ` — ${res.invoice_no}` : ''
      toast(`Purchase completed successfully${label}`)
      navigate(`/purchases/${res.purchase_id}`)
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">New Purchase</h1>
        <p className="text-sm text-[#6B7280]">Receive stock via complete_purchase RPC.</p>
      </div>

      {!activeBranchId ? (
        <p className="text-sm text-[#E11D48]">Select a branch first.</p>
      ) : null}

      <div className="space-y-3 rounded-xl border border-border bg-white p-4">
        <div className="space-y-1">
          <Label>Supplier</Label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <div className="min-w-0">
              <EntityCombobox
                value={supplierId}
                onChange={(id, option) => {
                  setSupplierId(id)
                  setSupplierLabel(option?.label ?? null)
                }}
                onSearch={purchasesRepository.searchSuppliers}
                placeholder="Search suppliers…"
                initialLabel={supplierLabel}
                aria-label="Supplier"
                className="w-full min-w-0"
              />
            </div>
            {canCreateSupplier && profile?.organization_id ? (
              <Button
                type="button"
                variant="outline"
                className="h-9 shrink-0 gap-1 border-[#E11D48]/45 px-2.5 text-[#E11D48] hover:bg-[#FFF1F2]"
                onClick={() => setSupplierDialogOpen(true)}
                aria-label="Add Supplier"
              >
                <UserPlus className="h-4 w-4" />
                <span className="text-xs font-semibold">+ Add</span>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="space-y-1">
          <Label>Add variant</Label>
          <EntityCombobox
            value={null}
            onChange={(id, option) => {
              if (!id || !option) return
              const unitCost =
                'unitCost' in option && typeof (option as { unitCost?: number }).unitCost === 'number'
                  ? (option as { unitCost: number }).unitCost
                  : 0
              setLines((prev) => [
                ...prev,
                {
                  variantId: id,
                  label: option.label,
                  qty: 1,
                  unitCost,
                  lineDiscount: 0,
                },
              ])
            }}
            onSearch={async (q) => {
              const rows = await purchasesRepository.searchVariants(q)
              return rows.map((r) => ({ ...r, unitCost: r.unitCost }))
            }}
            placeholder="Search products…"
            allowClear={false}
            aria-label="Add variant"
          />
        </div>

        <ul className="space-y-2">
          {lines.map((line, idx) => (
            <li key={`${line.variantId}-${idx}`} className="grid gap-2 rounded-lg border p-2 sm:grid-cols-5 sm:items-end">
              <p className="sm:col-span-2 truncate text-sm font-medium sm:pb-2">{line.label}</p>
              <div className="space-y-1">
                <Label htmlFor={`purchase-line-qty-${idx}`} className="text-xs text-text-muted">
                  Qty
                </Label>
                <Input
                  id={`purchase-line-qty-${idx}`}
                  type="number"
                  value={line.qty}
                  onChange={(e) => {
                    const next = [...lines]
                    next[idx] = { ...line, qty: Number(e.target.value) || 0 }
                    setLines(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`purchase-line-cost-${idx}`} className="text-xs text-text-muted">
                  Cost
                </Label>
                <Input
                  id={`purchase-line-cost-${idx}`}
                  type="number"
                  value={line.unitCost}
                  onChange={(e) => {
                    const next = [...lines]
                    next[idx] = { ...line, unitCost: Number(e.target.value) || 0 }
                    setLines(next)
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="sm:mb-0.5"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="purchase-discount">Discount</Label>
            <Input
              id="purchase-discount"
              type="number"
              value={discount || ''}
              onChange={(e) => setDiscount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchase-tax">Tax</Label>
            <Input
              id="purchase-tax"
              type="number"
              value={tax || ''}
              onChange={(e) => setTax(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchase-shipping">Shipping</Label>
            <Input
              id="purchase-shipping"
              type="number"
              value={shipping || ''}
              onChange={(e) => setShipping(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label htmlFor="purchase-note">Note</Label>
          <Input
            id="purchase-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="purchase-pay-now">Pay now</Label>
            <Input
              id="purchase-pay-now"
              type="number"
              value={payAmount || ''}
              onChange={(e) => setPayAmount(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="purchase-pay-method">Payment method</Label>
            <select
              id="purchase-pay-method"
              className="h-9 w-full rounded-md border border-border bg-white px-2 text-sm"
              value={payMethod}
              onChange={(e) => setPayMethod(e.target.value)}
            >
              {(payMethods.length
                ? payMethods
                : [
                    { code: 'cash', name: 'Cash' },
                    { code: 'bank', name: 'Bank' },
                  ]
              ).map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
              <option value="due">Due</option>
            </select>
          </div>
        </div>

        {payAmount > 0 && payMethod !== 'due' ? (
          <ResolvedPaymentAccountField
            label="Payment account"
            resolved={resolved}
            methodCode={payMethod}
            branchId={activeBranchId}
          />
        ) : null}

        <p className="text-sm font-semibold">Grand total: {formatBDT(grandTotal)}</p>
        {complete.error ? (
          <p className="text-sm text-[#E11D48]">
            {complete.error instanceof Error ? complete.error.message : 'Failed'}
          </p>
        ) : null}

        <PermissionGate permission="purchases.create">
          <Button
            disabled={
              !activeBranchId ||
              !supplierId ||
              lines.length === 0 ||
              complete.isPending ||
              (payAmount > 0 && payMethod !== 'due' && !resolved)
            }
            onClick={() => complete.mutate()}
          >
            {complete.isPending ? 'Posting…' : 'Complete purchase'}
          </Button>
        </PermissionGate>
      </div>

      {canCreateSupplier && profile?.organization_id ? (
        <PurchaseQuickAddSupplierDialog
          open={supplierDialogOpen}
          onOpenChange={setSupplierDialogOpen}
          organizationId={profile.organization_id}
          branchId={activeBranchId}
          onCreated={(supplier) => {
            setSupplierId(supplier.id)
            setSupplierLabel(supplier.name)
            void qc.invalidateQueries({ queryKey: ['suppliers'] })
            toast('Supplier created')
          }}
        />
      ) : null}
    </div>
  )
}
