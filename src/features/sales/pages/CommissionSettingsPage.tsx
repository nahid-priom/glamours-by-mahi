import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { commissionsRepository } from '../repositories/commissions.repository'
import { EntityCombobox } from '@/components/entity-combobox'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/auth-session'

const ruleSchema = z.object({
  profile_id: z.string().min(1, 'Select a salesperson'),
  rule_type: z.enum(['fixed', 'percent_sale', 'percent_profit', 'none']),
  rate: z.number().min(0),
  effective_from: z.string().min(1),
  notes: z.string().optional(),
})

type RuleForm = z.infer<typeof ruleSchema>

export function CommissionSettingsPage() {
  const { activeBranchId } = useAuth()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['commission-rules', activeBranchId],
    queryFn: () => commissionsRepository.listCommissionRules(activeBranchId),
  })

  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      profile_id: '',
      rule_type: 'percent_sale',
      rate: 2.5,
      effective_from: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const save = useMutation({
    mutationFn: (values: RuleForm) =>
      commissionsRepository.upsertCommissionRule({
        profile_id: values.profile_id,
        branch_id: activeBranchId,
        rule_type: values.rule_type,
        rate: values.rate,
        effective_from: values.effective_from,
        notes: values.notes,
      }),
    onSuccess: async () => {
      setShowForm(false)
      form.reset()
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
  })

  const deactivate = useMutation({
    mutationFn: commissionsRepository.deactivateCommissionRule,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
  })

  const activeRules = rules.filter((r) => r.is_active)

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Commission Settings</h1>
          <p className="text-sm text-[#6B7280]">
            Configure salesperson commission rules. No rule means no commission accrues.
          </p>
        </div>
        <PermissionGate permission="sales.commission.manage">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Create rule'}
          </Button>
        </PermissionGate>
      </div>

      {activeRules.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active commission rules. POS sales will not accrue commission until an Owner creates
          and activates a rule here.
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-white p-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <label className="block text-sm font-medium">
            Salesperson
            <div className="mt-1">
              <EntityCombobox
                value={form.watch('profile_id') || null}
                onChange={(id) => form.setValue('profile_id', id ?? '', { shouldValidate: true })}
                onSearch={commissionsRepository.searchSalespeople}
                placeholder="Search staff…"
              />
            </div>
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium">
              Type
              <select
                className="mt-1 h-9 w-full rounded-md border border-border px-2 text-sm"
                {...form.register('rule_type')}
              >
                <option value="percent_sale">% of sale</option>
                <option value="percent_profit">% of profit</option>
                <option value="fixed">Fixed amount</option>
                <option value="none">None</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Rate
              <Input
                type="number"
                step="0.01"
                className="mt-1"
                {...form.register('rate', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm font-medium">
              Effective from
              <Input type="date" className="mt-1" {...form.register('effective_from')} />
            </label>
          </div>
          <Input placeholder="Notes (optional)" {...form.register('notes')} />
          <Button type="submit" size="sm" disabled={save.isPending}>
            Save rule
          </Button>
          {save.error ? (
            <p className="text-sm text-[#E11D48]">{(save.error as Error).message}</p>
          ) : null}
        </form>
      ) : null}

      {isLoading ? <p className="text-sm text-[#6B7280]">Loading rules…</p> : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Profile</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Rate</th>
              <th className="px-3 py-2 text-left">Effective</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="px-3 py-2 font-mono text-xs">{r.profile_id.slice(0, 8)}…</td>
                <td className="px-3 py-2">{r.rule_type}</td>
                <td className="px-3 py-2">{Number(r.rate)}</td>
                <td className="px-3 py-2">
                  {r.effective_from}
                  {r.effective_to ? ` → ${r.effective_to}` : ''}
                </td>
                <td className="px-3 py-2">{r.is_active ? 'active' : 'inactive'}</td>
                <td className="px-3 py-2">
                  {r.is_active ? (
                    <PermissionGate permission="sales.commission.manage">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deactivate.isPending}
                        onClick={() => deactivate.mutate(r.id)}
                      >
                        Deactivate
                      </Button>
                    </PermissionGate>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
