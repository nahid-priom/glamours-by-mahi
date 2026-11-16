import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  simpleAccountingRepository,
  type AccountKind,
  type AccountSettings,
} from '../../repositories/simple-accounting.repository'
import { PageHeader, DataTable, ErrorText, EmptyState } from '../../components/AccountingUi'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { methodCodeToAccountKind } from '@/lib/payments/resolve-payment-account'
import { queryKeys } from '@/lib/query/keys'
import { listPaymentMethods } from '@/features/sales/repositories/sales.repository'
import { toastRpcError } from '@/lib/errors/rpc-error'

export function AccountSettingsPage() {
  const { profile, activeBranchId } = useAuth()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [settings, setSettings] = useState<AccountSettings | null>(null)
  const [incomeText, setIncomeText] = useState('')
  const [expenseText, setExpenseText] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<AccountKind>('cash')
  const [opening, setOpening] = useState('0')

  const orgId = profile?.organization_id

  const { data: accounts = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.accounts, 'settings-fa', activeBranchId],
    queryFn: () => simpleAccountingRepository.listFinancialAccounts(activeBranchId),
  })

  const { data: methods = [] } = useQuery({
    queryKey: queryKeys.paymentMethods,
    queryFn: listPaymentMethods,
  })

  const payMethods = useMemo(() => methods.filter((m) => !m.is_due), [methods])

  const { data: loadedSettings, isLoading: loadingSettings } = useQuery({
    queryKey: [...queryKeys.accounts, 'settings', orgId],
    enabled: Boolean(orgId),
    queryFn: () => simpleAccountingRepository.getAccountSettings(orgId!),
  })

  useEffect(() => {
    if (!loadedSettings) return
    setSettings(loadedSettings)
    setIncomeText(loadedSettings.incomeCategories.join('\n'))
    setExpenseText(loadedSettings.expenseCategories.join('\n'))
  }, [loadedSettings])

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (!orgId || !settings) throw new Error('Not ready')
      const next: AccountSettings = {
        ...settings,
        incomeCategories: incomeText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        expenseCategories: expenseText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
      }
      return simpleAccountingRepository.saveAccountSettings(orgId, next)
    },
    onSuccess: async (next) => {
      setSettings(next)
      toast('Settings saved')
      await qc.invalidateQueries({ queryKey: queryKeys.accounts })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const addAccount = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('Not signed in')
      if (!activeBranchId) throw new Error('Select an active branch first')
      if (!name.trim()) throw new Error('Name required')
      return simpleAccountingRepository.createAlignedFinancialAccount({
        organization_id: orgId,
        name: name.trim(),
        account_kind: kind,
        branch_id: activeBranchId,
        opening_balance: Number(opening) || 0,
      })
    },
    onSuccess: async () => {
      setName('')
      setOpening('0')
      toast('Account added and linked for this branch')
      await qc.invalidateQueries({ queryKey: queryKeys.accounts })
      await qc.invalidateQueries({ queryKey: queryKeys.paymentMethods })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const linkMethod = useMutation({
    mutationFn: ({ code, accountId }: { code: string; accountId: string }) =>
      simpleAccountingRepository.linkPaymentMethodAccount(code, accountId),
    onSuccess: async () => {
      toast('Payment method account updated')
      await qc.invalidateQueries({ queryKey: queryKeys.paymentMethods })
      await qc.invalidateQueries({ queryKey: queryKeys.posPaymentMethods })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      simpleAccountingRepository.setAccountActive(id, is_active),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: queryKeys.accounts })
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-6">
      <PageHeader
        title="Account Settings"
        subtitle="Cash accounts, categories, and business rules — no accountant setup required."
      />

      {(isLoading || loadingSettings) && !settings ? <Skeleton className="h-40" /> : null}
      <ErrorText error={error} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#111827]">Cash & bank accounts</h2>
        <PermissionGate permission={['accounts.manage', 'account_settings.manage']}>
          <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-white p-3">
            <Input className="max-w-xs" placeholder="Name (e.g. Cash Counter, bKash)" value={name} onChange={(e) => setName(e.target.value)} />
            <select
              className="h-9 rounded-md border border-border bg-white px-2 text-sm"
              value={kind}
              onChange={(e) => setKind(e.target.value as AccountKind)}
            >
              <option value="cash">Cash</option>
              <option value="bank">Bank / Card</option>
              <option value="mobile_money">Mobile banking</option>
              <option value="other">Other</option>
            </select>
            <Input
              className="w-28"
              type="number"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="Opening"
            />
            <Button disabled={addAccount.isPending} onClick={() => addAccount.mutate()}>
              Add
            </Button>
          </div>
        </PermissionGate>
        {!isLoading && accounts.length === 0 ? <EmptyState message="No accounts yet." /> : null}
        {accounts.length > 0 ? (
          <DataTable
            headers={['Name', 'Type', 'Opening', 'Balance', 'Active', '']}
            rows={accounts.map((a) => [
              a.name,
              a.account_kind.replace('_', ' '),
              formatBDT(a.opening_balance),
              formatBDT(a.current_balance),
              a.is_active ? 'Yes' : 'No',
              <PermissionGate key={a.id} permission={['accounts.manage', 'account_settings.manage']}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => toggleActive.mutate({ id: a.id, is_active: !a.is_active })}
                >
                  {a.is_active ? 'Disable' : 'Enable'}
                </Button>
              </PermissionGate>,
            ])}
          />
        ) : null}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[#111827]">Payment method accounts</h2>
        <p className="text-xs text-[#6B7280]">
          Each POS / collection / supplier payment method uses one Accounts ledger. Prefer accounts
          for the active branch; resolution also matches account type (cash / bank / mobile).
        </p>
        <PermissionGate permission={['accounts.manage', 'account_settings.manage']}>
          {payMethods.length === 0 ? (
            <EmptyState message="No payment methods configured." />
          ) : (
            <div className="grid gap-2 rounded-xl border border-border bg-white p-3 sm:grid-cols-2">
              {payMethods.map((m) => {
                const kind = methodCodeToAccountKind(m.code)
                const options = accounts.filter(
                  (a) =>
                    a.is_active &&
                    (a.account_kind === kind ||
                      kind === 'other' ||
                      (kind === 'mobile_money' && a.account_kind === 'bank')),
                )
                return (
                  <div key={m.id} className="space-y-1">
                    <Label>
                      {m.name}{' '}
                      <span className="font-normal text-[#6B7280]">({m.code})</span>
                    </Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                      value={m.financial_account_id ?? ''}
                      disabled={linkMethod.isPending}
                      onChange={(e) => {
                        const accountId = e.target.value
                        if (!accountId) return
                        linkMethod.mutate({ code: m.code, accountId })
                      }}
                    >
                      <option value="">Not linked</option>
                      {(options.length ? options : accounts.filter((a) => a.is_active)).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} · {a.account_kind.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              })}
            </div>
          )}
        </PermissionGate>
      </section>

      {settings ? (
        <PermissionGate permission={['accounts.manage', 'account_settings.manage', 'settings.manage']}>
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 rounded-xl border border-border bg-white p-4">
              <h2 className="text-sm font-semibold">Income categories</h2>
              <p className="text-xs text-[#6B7280]">One per line (other income only — sales come from POS)</p>
              <textarea
                className="min-h-[140px] w-full rounded-md border border-input bg-transparent p-2 text-sm"
                value={incomeText}
                onChange={(e) => setIncomeText(e.target.value)}
              />
            </div>
            <div className="space-y-2 rounded-xl border border-border bg-white p-4">
              <h2 className="text-sm font-semibold">Expense categories</h2>
              <p className="text-xs text-[#6B7280]">One per line</p>
              <textarea
                className="min-h-[140px] w-full rounded-md border border-input bg-transparent p-2 text-sm"
                value={expenseText}
                onChange={(e) => setExpenseText(e.target.value)}
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-white p-4 sm:col-span-2">
              <h2 className="text-sm font-semibold">Defaults & policies</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Default cash account</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={settings.defaultCashAccountId ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultCashAccountId: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {accounts
                      .filter((a) => a.account_kind === 'cash')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Default bank / mobile account</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={settings.defaultBankAccountId ?? ''}
                    onChange={(e) =>
                      setSettings({ ...settings, defaultBankAccountId: e.target.value || null })
                    }
                  >
                    <option value="">None</option>
                    {accounts
                      .filter((a) => a.account_kind === 'bank' || a.account_kind === 'mobile_money')
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Default purchase payment account</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={settings.defaultPurchasePaymentAccountId ?? ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        defaultPurchasePaymentAccountId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">None</option>
                    {accounts
                      .filter((a) => a.is_active)
                      .map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>Expense approval limit (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={settings.expenseApprovalLimit || ''}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        expenseApprovalLimit: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="0 = no approval"
                  />
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.allowNegativeBalance}
                    onChange={(e) =>
                      setSettings({ ...settings, allowNegativeBalance: e.target.checked })
                    }
                  />
                  Allow negative account balance
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.requireDailyClosing}
                    onChange={(e) =>
                      setSettings({ ...settings, requireDailyClosing: e.target.checked })
                    }
                  />
                  Require daily closing
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.allowCustomerAdvance}
                    onChange={(e) =>
                      setSettings({ ...settings, allowCustomerAdvance: e.target.checked })
                    }
                  />
                  Allow customer advance (over-collection)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.allowSupplierAdvance}
                    onChange={(e) =>
                      setSettings({ ...settings, allowSupplierAdvance: e.target.checked })
                    }
                  />
                  Allow supplier advance (over-payment)
                </label>
              </div>
              <Button className="mt-1" disabled={saveSettings.isPending} onClick={() => saveSettings.mutate()}>
                Save settings
              </Button>
            </div>
          </section>
        </PermissionGate>
      ) : null}
    </div>
  )
}
