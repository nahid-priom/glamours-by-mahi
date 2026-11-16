import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { EntityCombobox } from '@/components/entity-combobox'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { toastRpcError } from '@/lib/errors/rpc-error'
import {
  commissionsRepository,
  type CommissionOrderSource,
  type CommissionRuleRow,
  type CommissionStructureMode,
  type CommissionSubjectType,
  type CommissionTier,
} from '../repositories/commissions.repository'

const SOURCES: { id: CommissionOrderSource; label: string }[] = [
  { id: 'pos', label: 'POS' },
  { id: 'moderator', label: 'Moderator' },
  { id: 'tele_sales', label: 'Tele sales' },
  { id: 'ecommerce', label: 'Ecommerce' },
]

const tierSchema = z.object({
  min_amount: z.number().min(0),
  max_amount: z.number().min(0).nullable(),
  rate_type: z.enum(['percent', 'fixed']),
  rate: z.number().min(0),
})

const ruleSchema = z
  .object({
    subject_type: z.enum(['employee', 'profile']),
    subject_id: z.string().min(1, 'Select a person'),
    structure_mode: z.enum(['per_sale', 'sale_amount_tiers', 'period_volume_tiers']),
    rule_type: z.enum(['fixed', 'percent_sale', 'percent_profit', 'none']),
    rate: z.number().min(0),
    base_metric: z.enum(['sale_total', 'profit']),
    tiers: z.array(tierSchema),
    applies_to_sources: z.array(z.string()).min(1),
    effective_from: z.string().min(1),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.structure_mode !== 'per_sale' && v.tiers.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'Add at least one tier', path: ['tiers'] })
    }
  })

type RuleForm = z.infer<typeof ruleSchema>

function emptyTier(): CommissionTier[] {
  return [{ min_amount: 0, max_amount: null, rate_type: 'percent', rate: 5 }]
}

function structureLabel(mode: string | null | undefined) {
  if (mode === 'sale_amount_tiers') return 'Sale amount tiers'
  if (mode === 'period_volume_tiers') return 'Period volume tiers'
  return 'Per sale'
}

function summarizeRule(rule: CommissionRuleRow) {
  if (rule.structure_mode === 'per_sale' || !rule.structure_mode) {
    if (rule.rule_type === 'fixed') return `Fixed ${formatBDT(rule.rate)} / sale`
    if (rule.rule_type === 'percent_profit') return `${rule.rate}% of profit`
    if (rule.rule_type === 'percent_sale') return `${rule.rate}% of sale`
    return 'None'
  }
  const tiers = rule.tiers ?? []
  if (tiers.length === 0) return 'No tiers'
  return tiers
    .slice(0, 3)
    .map((t) => {
      const band =
        t.max_amount == null
          ? `≥ ${formatBDT(t.min_amount)}`
          : `${formatBDT(t.min_amount)}–${formatBDT(t.max_amount)}`
      const rate = t.rate_type === 'fixed' ? formatBDT(t.rate) : `${t.rate}%`
      return `${band} → ${rate}`
    })
    .join('; ')
}

function tierPreview(tiers: CommissionTier[], mode: CommissionStructureMode) {
  if (!tiers.length) return 'Add tiers to preview rates.'
  const basis = mode === 'period_volume_tiers' ? 'monthly sales volume' : 'this sale amount'
  return tiers
    .map((t) => {
      const band =
        t.max_amount == null
          ? `If ${basis} is ≥ ${formatBDT(t.min_amount)}`
          : `If ${basis} is ${formatBDT(t.min_amount)}–${formatBDT(t.max_amount)}`
      const rate = t.rate_type === 'fixed' ? formatBDT(t.rate) : `${t.rate}%`
      return `${band} → ${rate}`
    })
    .join(' · ')
}

export function CommissionSettingsPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [subjectLabel, setSubjectLabel] = useState<string | null>(null)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.commissionRules(activeBranchId),
    queryFn: () => commissionsRepository.listCommissionRules(activeBranchId),
  })

  const { data: employees = [] } = useQuery({
    queryKey: queryKeys.commissionEmployees(activeBranchId, ''),
    queryFn: () => commissionsRepository.searchCommissionEmployees('', activeBranchId, false),
  })

  const { data: subjectBundle } = useQuery({
    queryKey: ['commission-subjects', activeBranchId],
    queryFn: () => commissionsRepository.searchCommissionSubjects('', 'all', activeBranchId),
  })

  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees])
  const profileMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of subjectBundle ?? []) {
      if (s.kind === 'profile') m.set(s.id, s.label)
    }
    return m
  }, [subjectBundle])

  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      subject_type: 'employee',
      subject_id: '',
      structure_mode: 'per_sale',
      rule_type: 'percent_sale',
      rate: 2.5,
      base_metric: 'sale_total',
      tiers: emptyTier(),
      applies_to_sources: ['pos', 'moderator', 'tele_sales', 'ecommerce'],
      effective_from: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const subjectType = form.watch('subject_type')
  const structureMode = form.watch('structure_mode') as CommissionStructureMode
  const tiers = form.watch('tiers')
  const sources = form.watch('applies_to_sources')

  const save = useMutation({
    mutationFn: (values: RuleForm) =>
      commissionsRepository.upsertCommissionRule({
        subject_type: values.subject_type as CommissionSubjectType,
        employee_id: values.subject_type === 'employee' ? values.subject_id : null,
        profile_id: values.subject_type === 'profile' ? values.subject_id : null,
        branch_id: activeBranchId,
        structure_mode: values.structure_mode,
        rule_type: values.rule_type,
        rate: values.rate,
        base_metric: values.base_metric,
        tiers: values.structure_mode === 'per_sale' ? [] : values.tiers,
        period_unit: 'month',
        applies_to_sources: values.applies_to_sources as CommissionOrderSource[],
        effective_from: values.effective_from,
        notes: values.notes,
      }),
    onSuccess: async () => {
      toast('Commission structure saved')
      setShowForm(false)
      setSubjectLabel(null)
      form.reset()
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e) => toastRpcError(toast, e, 'Could not save rule'),
  })

  const deactivate = useMutation({
    mutationFn: commissionsRepository.deactivateCommissionRule,
    onSuccess: async () => {
      toast('Rule deactivated')
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e) => toastRpcError(toast, e, 'Could not deactivate rule'),
  })

  const activeRules = rules.filter((r) => r.is_active)

  const ruleLabel = (rule: CommissionRuleRow) => {
    if (rule.subject_type === 'profile' || (!rule.employee_id && rule.profile_id)) {
      return profileMap.get(rule.profile_id ?? '') ?? 'Moderator / Tele sales'
    }
    if (rule.employee_id) {
      return employeeMap.get(rule.employee_id)?.label ?? 'Employee'
    }
    return '—'
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Commission Settings</h1>
          <p className="text-sm text-[#6B7280]">
            Build custom commission structures for employees or moderators — per sale, sale amount
            tiers, or monthly volume tiers.
          </p>
        </div>
        <PermissionGate permission="sales.commission.manage">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Create structure'}
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Active structures</p>
          <p className="text-2xl font-bold">{activeRules.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Branch scope</p>
          <p className="text-sm font-semibold">{activeBranchId ? 'Current branch' : 'All branches'}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Modes</p>
          <p className="text-sm font-semibold">Per sale · Amount tiers · Volume tiers</p>
        </div>
      </div>

      {activeRules.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active commission structures. Sales will not accrue commission until a structure is
          created for the employee or moderator.
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-4 rounded-xl border border-border bg-white p-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <div className="flex flex-wrap gap-2">
            {(['employee', 'profile'] as const).map((kind) => (
              <Button
                key={kind}
                type="button"
                size="sm"
                variant={subjectType === kind ? 'default' : 'outline'}
                onClick={() => {
                  form.setValue('subject_type', kind)
                  form.setValue('subject_id', '')
                  setSubjectLabel(null)
                }}
              >
                {kind === 'employee' ? 'Employee' : 'Moderator / Tele sales'}
              </Button>
            ))}
          </div>

          <div>
            <Label>{subjectType === 'employee' ? 'Employee' : 'Moderator / Tele sales'}</Label>
            <div className="mt-1">
              <EntityCombobox
                value={form.watch('subject_id') || null}
                onChange={(id, opt) => {
                  form.setValue('subject_id', id ?? '', { shouldValidate: true })
                  setSubjectLabel(opt?.label ?? null)
                }}
                onSearch={async (q) => {
                  const rows = await commissionsRepository.searchCommissionSubjects(
                    q,
                    subjectType,
                    activeBranchId,
                  )
                  return rows.map((r) => ({
                    id: r.id,
                    label: r.label,
                    description: r.description,
                  }))
                }}
                placeholder={
                  subjectType === 'employee'
                    ? 'Search by name or employee code…'
                    : 'Search moderator or tele salesman…'
                }
              />
            </div>
            {subjectLabel ? (
              <p className="mt-1 text-xs text-[#6B7280]">Selected: {subjectLabel}</p>
            ) : null}
            {form.formState.errors.subject_id ? (
              <p className="mt-1 text-xs text-[#E11D48]">{form.formState.errors.subject_id.message}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(
              [
                ['per_sale', 'Per sale'],
                ['sale_amount_tiers', 'Sale amount tiers'],
                ['period_volume_tiers', 'Period volume tiers'],
              ] as const
            ).map(([mode, label]) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={structureMode === mode ? 'default' : 'outline'}
                onClick={() => {
                  form.setValue('structure_mode', mode)
                  if (mode !== 'per_sale' && (form.getValues('tiers')?.length ?? 0) === 0) {
                    form.setValue('tiers', emptyTier())
                  }
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          {structureMode === 'per_sale' ? (
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
                <Controller
                  control={form.control}
                  name="effective_from"
                  render={({ field }) => (
                    <AppDateField
                      className="mt-1"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                    />
                  )}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">
                  % / fixed applies to
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-border px-2 text-sm"
                    {...form.register('base_metric')}
                  >
                    <option value="sale_total">Sale total</option>
                    <option value="profit">Profit</option>
                  </select>
                </label>
                <label className="text-sm font-medium">
                  Effective from
                  <Controller
                    control={form.control}
                    name="effective_from"
                    render={({ field }) => (
                      <AppDateField
                        className="mt-1"
                        value={field.value ?? ''}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Tiers</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      form.setValue('tiers', [
                        ...tiers,
                        {
                          min_amount: tiers[tiers.length - 1]?.min_amount
                            ? Number(tiers[tiers.length - 1].min_amount) + 1000
                            : 0,
                          max_amount: null,
                          rate_type: 'percent',
                          rate: 5,
                        },
                      ])
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Add tier
                  </Button>
                </div>
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-2 rounded-lg border border-border p-2"
                  >
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={tier.min_amount}
                      onChange={(e) => {
                        const next = [...tiers]
                        next[index] = { ...tier, min_amount: Number(e.target.value) || 0 }
                        form.setValue('tiers', next)
                      }}
                    />
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max (blank = ∞)"
                      value={tier.max_amount ?? ''}
                      onChange={(e) => {
                        const next = [...tiers]
                        next[index] = {
                          ...tier,
                          max_amount: e.target.value === '' ? null : Number(e.target.value) || 0,
                        }
                        form.setValue('tiers', next)
                      }}
                    />
                    <select
                      className="h-9 rounded-md border border-border px-2 text-sm"
                      value={tier.rate_type}
                      onChange={(e) => {
                        const next = [...tiers]
                        next[index] = {
                          ...tier,
                          rate_type: e.target.value as 'percent' | 'fixed',
                        }
                        form.setValue('tiers', next)
                      }}
                    >
                      <option value="percent">%</option>
                      <option value="fixed">Fixed</option>
                    </select>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Rate"
                      value={tier.rate}
                      onChange={(e) => {
                        const next = [...tiers]
                        next[index] = { ...tier, rate: Number(e.target.value) || 0 }
                        form.setValue('tiers', next)
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      disabled={tiers.length <= 1}
                      onClick={() => form.setValue('tiers', tiers.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-[#E11D48]" />
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-[#6B7280]">{tierPreview(tiers, structureMode)}</p>
              </div>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium">Applies to order sources</p>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((s) => {
                const checked = sources.includes(s.id)
                return (
                  <Button
                    key={s.id}
                    type="button"
                    size="sm"
                    variant={checked ? 'default' : 'outline'}
                    onClick={() => {
                      const next = checked
                        ? sources.filter((x) => x !== s.id)
                        : [...sources, s.id]
                      form.setValue('applies_to_sources', next.length ? next : [s.id])
                    }}
                  >
                    {s.label}
                  </Button>
                )
              })}
            </div>
          </div>

          <label className="block text-sm font-medium">
            Notes
            <Input className="mt-1" {...form.register('notes')} />
          </label>

          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save structure'}
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Person</th>
              <th className="px-3 py-2 text-left">Mode</th>
              <th className="px-3 py-2 text-left">Structure</th>
              <th className="px-3 py-2 text-left">Effective</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <p className="font-medium">{ruleLabel(rule)}</p>
                  <p className="text-[11px] text-[#9CA3AF]">
                    {rule.subject_type === 'profile' ? 'Moderator / profile' : 'Employee'}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="default" className="text-[10px]">
                    {structureLabel(rule.structure_mode)}
                  </Badge>
                </td>
                <td className="max-w-[18rem] px-3 py-2 text-xs text-[#4B5563]">
                  {summarizeRule(rule)}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-xs">
                  {rule.effective_from}
                  {rule.effective_to ? ` → ${rule.effective_to}` : ''}
                </td>
                <td className="px-3 py-2">
                  {rule.is_active ? (
                    <PermissionGate permission="sales.commission.manage">
                      <Button size="sm" variant="ghost" onClick={() => deactivate.mutate(rule.id)}>
                        Deactivate
                      </Button>
                    </PermissionGate>
                  ) : (
                    <span className="text-xs text-[#9CA3AF]">Inactive</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && rules.length === 0 ? (
          <p className="p-6 text-center text-sm text-[#6B7280]">No structures configured.</p>
        ) : null}
      </div>
    </div>
  )
}
