import { useState } from 'react'
import { peekDatabase, TransactionError } from '@/database/transaction'
import { customersService } from '@/services/customers.service'
import { formatBDT } from '@/lib/format'
import { useAuth } from '@/features/auth/auth.context'
import { useToast } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModuleShell } from './ErpModulePages'

export function CollectionFormPage() {
  const db = peekDatabase()
  const dueCustomers = db.customers.filter((c) => c.currentDue > 0 && !c.deleted_at)
  const { session } = useAuth()
  const { toast } = useToast()
  const [customerId, setCustomerId] = useState(dueCustomers[0]?.id ?? '')
  const [accountId, setAccountId] = useState(db.financialAccounts.find((a) => a.type === 'Cash')?.id ?? '')
  const selected = db.customers.find((c) => c.id === customerId)
  const [amount, setAmount] = useState(selected?.currentDue ?? 0)
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (saving) return
    setSaving(true)
    try {
      customersService.collect({
        customerId,
        amount,
        accountId,
        idempotencyKey: `col_${Date.now()}_${session.userId}`,
        userName: session.name,
      })
      toast('Customer collection received')
      window.location.reload()
    } catch (err) {
      toast(err instanceof TransactionError ? err.message : 'Collection failed', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModuleShell title="Customer Collection" subtitle="Money In / Payment — reduces customer due">
      <div className="mx-auto max-w-lg space-y-3 rounded-2xl border bg-white p-4">
        <label className="text-xs font-medium text-[#6B7280]">Customer</label>
        <select
          className="w-full rounded-xl border px-3 py-2 text-sm"
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value)
            const c = db.customers.find((x) => x.id === e.target.value)
            setAmount(c?.currentDue ?? 0)
          }}
        >
          {dueCustomers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · Due {formatBDT(c.currentDue)}
            </option>
          ))}
        </select>
        <label className="text-xs font-medium text-[#6B7280]">Amount</label>
        <Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} />
        <label className="text-xs font-medium text-[#6B7280]">Receive Into Account</label>
        <select className="w-full rounded-xl border px-3 py-2 text-sm" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {db.financialAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatBDT(a.balance)})
            </option>
          ))}
        </select>
        <Button className="w-full rounded-full" disabled={saving || !dueCustomers.length} onClick={save}>
          {saving ? 'Saving…' : 'Record Collection'}
        </Button>
      </div>
    </ModuleShell>
  )
}
