import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import {
  executeDataReset,
  previewDataReset,
} from '@/features/administration/repositories/administration.repository'

const LEVELS = [
  {
    id: 'demo' as const,
    title: '1. Reset Demo Data',
    desc: 'Soft-delete GG-SEED catalog products only.',
  },
  {
    id: 'transactions' as const,
    title: '2. Reset Transactions',
    desc: 'Sales, purchases, returns, exchanges, courier parcels, stock movements.',
  },
  {
    id: 'inventory' as const,
    title: '3. Reset Inventory',
    desc: 'Zero stock quantities and soft-delete stock ledger. Products kept.',
  },
  {
    id: 'accounts' as const,
    title: '4. Reset Accounts & Ledgers',
    desc: 'Journals, financial transactions, customer/supplier ledgers and due caches.',
  },
  {
    id: 'full' as const,
    title: '5. Full Business Reset',
    desc:
      'Transactions + inventory + accounts + catalog masters (products, variants, categories, subcategories, brands). Org, admin users, and roles preserved.',
  },
]

type ResetLevel = (typeof LEVELS)[number]['id']

export function DataResetSettingsPage() {
  const { toast } = useToast()
  const [level, setLevel] = useState<ResetLevel>('demo')
  const [preview, setPreview] = useState<Record<string, number | string> | null>(null)
  const [confirm, setConfirm] = useState('')
  const [phrase, setPhrase] = useState('')

  const expectedPhrase = `RESET ${level}`

  const previewMut = useMutation({
    mutationFn: () => previewDataReset({ reset_level: level }),
    onSuccess: (res) => setPreview(res.summary),
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const executeMut = useMutation({
    mutationFn: () =>
      executeDataReset({
        confirm: 'RESET',
        confirm_phrase: phrase,
        reset_level: level,
      }),
    onSuccess: () => {
      toast('Data reset completed. Review the audit log.', 'success')
      setConfirm('')
      setPhrase('')
      setPreview(null)
      void previewMut.mutate()
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <PermissionGate permission="settings.data_reset">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Data reset</h1>
          <p className="text-sm text-[#6B7280]">
            High-risk admin maintenance. Preview impact, type the confirmation phrase, then execute.
            Actions are audited and locked against concurrent runs.
          </p>
        </div>

        <div className="space-y-2">
          {LEVELS.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer gap-3 rounded-xl border border-border bg-white p-3 hover:border-[#E11D48]/40"
            >
              <input
                type="radio"
                name="reset-level"
                className="mt-1"
                checked={level === item.id}
                onChange={() => {
                  setLevel(item.id)
                  setPreview(null)
                  setPhrase('')
                }}
              />
              <span>
                <span className="block text-sm font-semibold text-[#111827]">{item.title}</span>
                <span className="block text-xs text-[#6B7280]">{item.desc}</span>
              </span>
            </label>
          ))}
        </div>

        <Button variant="outline" disabled={previewMut.isPending} onClick={() => previewMut.mutate()}>
          {previewMut.isPending ? 'Previewing…' : 'Preview impact'}
        </Button>

        {preview ? (
          <dl className="grid grid-cols-2 gap-2 rounded-xl border bg-[#F9FAFB] p-4 text-sm">
            {Object.entries(preview).map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase text-[#6B7280]">{k}</dt>
                <dd className="font-medium">{String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="space-y-1.5">
            <Label>Type RESET to unlock</Label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" />
          </div>
          <div className="space-y-1.5">
            <Label>
              Confirmation phrase <span className="font-mono text-xs">({expectedPhrase})</span>
            </Label>
            <Input
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={expectedPhrase}
            />
          </div>
          <Button
            variant="danger"
            disabled={
              confirm !== 'RESET' ||
              phrase.toUpperCase() !== expectedPhrase.toUpperCase() ||
              executeMut.isPending ||
              !preview
            }
            onClick={() => executeMut.mutate()}
          >
            {executeMut.isPending ? 'Executing…' : `Execute ${level} reset`}
          </Button>
        </div>
      </div>
    </PermissionGate>
  )
}
