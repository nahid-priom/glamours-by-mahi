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
import { useToast } from '@/components/ui/toast'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'

const ruleSchema = z.object({
  employee_id: z.string().min(1, 'Select an employee'),
  rule_type: z.enum(['fixed', 'percent_sale', 'percent_profit', 'none']),
  rate: z.number().min(0),
  effective_from: z.string().min(1),
  notes: z.string().optional(),
})

type RuleForm = z.infer<typeof ruleSchema>

export function CommissionSettingsPage() {
  const { activeBranchId } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)

  const { data: rules = [], isLoading } = useQuery({
    queryKey: queryKeys.commissionRules(activeBranchId),
    queryFn: () => commissionsRepository.listCommissionRules(activeBranchId),
  })

  const { data: employees = [] } = useQuery({
    queryKey: queryKeys.commissionEmployees(activeBranchId, ''),
    queryFn: () => commissionsRepository.searchCommissionEmployees('', activeBranchId, false),
  })

  const employeeMap = new Map(employees.map((e) => [e.id, e]))

  const form = useForm<RuleForm>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      employee_id: '',
      rule_type: 'percent_sale',
      rate: 2.5,
      effective_from: new Date().toISOString().slice(0, 10),
      notes: '',
    },
  })

  const save = useMutation({
    mutationFn: (values: RuleForm) =>
      commissionsRepository.upsertCommissionRule({
        employee_id: values.employee_id,
        branch_id: activeBranchId,
        rule_type: values.rule_type,
        rate: values.rate,
        effective_from: values.effective_from,
        notes: values.notes,
      }),
    onSuccess: async () => {
      toast('Commission rule saved')
      setShowForm(false)
      form.reset()
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not save rule', 'error'),
  })

  const deactivate = useMutation({
    mutationFn: commissionsRepository.deactivateCommissionRule,
    onSuccess: async () => {
      toast('Rule deactivated')
      await qc.invalidateQueries({ queryKey: ['commission-rules'] })
    },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not deactivate rule', 'error'),
  })

  const activeRules = rules.filter((r) => r.is_active)
  const employeesWithoutRules = employees.filter(
    (e) => !activeRules.some((r) => r.employee_id === e.id),
  )

  const ruleLabel = (employeeId: string | null, profileId: string | null) => {
    if (employeeId) {
      const emp = employeeMap.get(employeeId)
      return emp?.label ?? 'Employee'
    }
    if (profileId) return 'Profile (needs employee link)'
    return '—'
  }

  return (
    <div className="mx-auto w-full max-w-5xl min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#111827]">Commission Settings</h1>
          <p className="text-sm text-[#6B7280]">
            Configure employee commission rules. Sales without a matching rule accrue no commission.
          </p>
        </div>
        <PermissionGate permission="sales.commission.manage">
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            {showForm ? 'Cancel' : 'Create rule'}
          </Button>
        </PermissionGate>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Active rules</p>
          <p className="text-2xl font-bold">{activeRules.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Employees without rules</p>
          <p className="text-2xl font-bold">{employeesWithoutRules.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <p className="text-xs text-[#6B7280]">Branch scope</p>
          <p className="text-sm font-semibold">{activeBranchId ? 'Current branch' : 'All branches'}</p>
        </div>
      </div>

      {activeRules.length === 0 && !isLoading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No active commission rules. POS sales will not accrue commission until a rule is created for
          the salesperson employee.
        </div>
      ) : null}

      {showForm ? (
        <form
          className="space-y-3 rounded-xl border border-border bg-white p-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
        >
          <label className="block text-sm font-medium">
            Employee
            <div className="mt-1">
              <EntityCombobox
                value={form.watch('employee_id') || null}
                onChange={(id) => form.setValue('employee_id', id ?? '', { shouldValidate: true })}
                onSearch={(q) =>
                  commissionsRepository.searchCommissionEmployees(q, activeBranchId, false)
                }
                placeholder="Search by name or employee code…"
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
              <Input type="number" step="0.01" className="mt-1" {...form.register('rate', { valueAsNumber: true })} />
            </label>
            <label className="text-sm font-medium">
              Effective from
              <Input type="date" className="mt-1" {...form.register('effective_from')} />
            </label>
          </div>
          <label className="block text-sm font-medium">
            Notes
            <Input className="mt-1" {...form.register('notes')} />
          </label>
          <Button type="submit" disabled={save.isPending}>
            Save rule
          </Button>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-[#F9FAFB] text-xs uppercase text-[#6B7280]">
            <tr>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Rate</th>
              <th className="px-3 py-2 text-left">Effective</th>
              <th className="px-3 py-2 text-left" />
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-b last:border-0">
                <td className="px-3 py-2">{ruleLabel(rule.employee_id, rule.profile_id)}</td>
                <td className="px-3 py-2">{rule.rule_type}</td>
                <td className="px-3 py-2">{rule.rate}</td>
                <td className="px-3 py-2">
                  {rule.effective_from}
                  {rule.effective_to ? ` → ${rule.effective_to}` : ''}
                </td>
                <td className="px-3 py-2">
                  {rule.is_active ? (
                    <PermissionGate permission="sales.commission.manage">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deactivate.mutate(rule.id)}
                      >
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
          <p className="p-6 text-center text-sm text-[#6B7280]">No rules configured.</p>
        ) : null}
      </div>
    </div>
  )
}
