import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, ShieldAlert, Loader2, Settings, Search } from 'lucide-react'
import { PageShell } from '@/components/layout/PageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { KpiGrid } from '@/components/common/KpiGrid'
import { ActionDropdown } from '@/components/common/ActionDropdown'
import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { useToast } from '@/components/ui/toast'
import { FraudRiskBadge } from './FraudRiskBadge'
import { FraudRuleFormDialog } from './FraudRuleFormDialog'
import { FraudCustomerActionDialog } from './FraudCustomerActionDialog'
import { FraudApiConfigDialog } from './FraudApiConfigDialog'
import { fraudService } from './fraud.service'
import { customersService } from '@/features/customers/customers.service'
import type { FraudRule, FraudRuleFormInput, HybridFraudResult } from './fraud.types'
import type { Customer } from '@/features/customers/customers.types'
import { cn } from '@/lib/utils'
import { toastRpcError } from '@/lib/errors/rpc-error'

const severityVariant = {
  low: 'default' as const,
  medium: 'warning' as const,
  high: 'danger' as const,
  blocked: 'blocked' as const,
}

export function FraudPage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [phone, setPhone] = useState('')
  const [checkResult, setCheckResult] = useState<HybridFraudResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [ruleFormOpen, setRuleFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<FraudRule | null>(null)
  const [archiveRule, setArchiveRule] = useState<FraudRule | null>(null)
  const [apiConfigOpen, setApiConfigOpen] = useState(false)
  const [customerAction, setCustomerAction] = useState<{
    customer: Customer
    mode: 'block' | 'unblock'
  } | null>(null)

  const { data: stats } = useQuery({
    queryKey: ['fraud', 'stats'],
    queryFn: () => fraudService.getStats(),
  })

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ['fraud', 'rules'],
    queryFn: () => fraudService.getRules(),
  })

  const { data: apiConfig } = useQuery({
    queryKey: ['fraud', 'api-config'],
    queryFn: () => fraudService.getApiConfig(),
  })

  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customersService.getAll(),
  })

  const flaggedCustomers = customers?.filter(
    (c) =>
      c.fraud_level === 'HIGH' ||
      c.fraud_level === 'BLOCKED' ||
      c.fraud_level === 'MEDIUM' ||
      c.is_blacklisted,
  ) ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['fraud'] })
    queryClient.invalidateQueries({ queryKey: ['customers'] })
  }

  const createRuleMutation = useMutation({
    mutationFn: (data: FraudRuleFormInput) => fraudService.createRule(data),
    onSuccess: () => { invalidate(); toast('Fraud rule created') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: FraudRuleFormInput }) =>
      fraudService.updateRule(id, data),
    onSuccess: () => { invalidate(); toast('Fraud rule updated') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const archiveRuleMutation = useMutation({
    mutationFn: (id: string) => fraudService.softDeleteRule(id),
    onSuccess: () => { invalidate(); toast('Rule archived'); setArchiveRule(null) },
  })

  const apiConfigMutation = useMutation({
    mutationFn: (config: Parameters<typeof fraudService.updateApiConfig>[0]) =>
      fraudService.updateApiConfig(config),
    onSuccess: () => { invalidate(); toast('API settings saved') },
  })

  const customerActionMutation = useMutation({
    mutationFn: ({ id, reason, mode }: { id: string; reason?: string; mode: 'block' | 'unblock' }) =>
      mode === 'block'
        ? fraudService.blockCustomer(id, reason!)
        : fraudService.unblockCustomer(id),
    onSuccess: () => { invalidate(); toast('Customer updated') },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const handleCheck = async () => {
    if (!phone.trim()) return
    setChecking(true)
    try {
      const result = await fraudService.runHybridCheck(phone.trim())
      setCheckResult(result)
      invalidate()
    } catch (e) {
      toastRpcError(toast, e, 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  const handleRuleSubmit = async (data: FraudRuleFormInput) => {
    if (editingRule) {
      await updateRuleMutation.mutateAsync({ id: editingRule.id, data })
    } else {
      await createRuleMutation.mutateAsync(data)
    }
    setEditingRule(null)
  }

  const kpis = [
    { label: 'Total Checks', value: stats?.total_checks ?? 0 },
    { label: 'Safe Customers', value: stats?.safe ?? 0, color: 'text-success' },
    { label: 'High Risk', value: stats?.high_risk ?? 0, color: 'text-warning' },
    { label: 'Blocked', value: stats?.blocked ?? 0, color: 'text-danger' },
    { label: 'API Checks Used', value: stats?.api_checks_used ?? 0 },
  ]

  return (
    <PageShell
      title="Fraud Checker"
      description="Customer risk assessment and fraud prevention"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setApiConfigOpen(true)}>
            <Settings className="h-4 w-4" />
            API Settings
          </Button>
          <Button onClick={() => { setEditingRule(null); setRuleFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            Add Rule
          </Button>
        </div>
      }
    >
      <KpiGrid items={kpis} columns={5} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manual Phone Check</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
              <Button onClick={handleCheck} disabled={checking || !phone.trim()}>
                {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Check
              </Button>
            </div>
            {checkResult && (
              <div className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{checkResult.phone}</p>
                  <FraudRiskBadge level={checkResult.risk_level} score={checkResult.final_score} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <ScoreBox label="Internal (60%)" value={checkResult.internal_score} />
                  <ScoreBox label="External (40%)" value={checkResult.external_score} />
                  <ScoreBox label="Final" value={checkResult.final_score} highlight />
                </div>
                <div className="mt-3">
                  <p className="text-xs font-semibold text-text-muted">Reasons</p>
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {checkResult.reasons.map((r, i) => (
                      <li key={i}>• {r}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold">Recommended: </span>
                  {checkResult.recommended_action}
                </p>
                {checkResult.external_report && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-text-muted">Courier History</p>
                    <div className="mt-1 space-y-1">
                      {checkResult.external_report.couriers.map((c) => (
                        <div key={c.name} className="flex justify-between text-xs">
                          <span>{c.name}</span>
                          <span>
                            <span className="text-success">{c.delivered} delivered</span>
                            {' · '}
                            <span className="text-danger">{c.returned} returned</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              API Integration
              {apiConfig && (
                <Badge variant={apiConfig.status === 'connected' ? 'success' : 'default'}>
                  {apiConfig.status}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {apiConfig ? (
              <>
                <Row label="Provider" value={apiConfig.provider_name} />
                <Row label="Base URL" value={apiConfig.api_base_url ?? '—'} />
                <Row label="Usage" value={`${apiConfig.used_checks} / ${apiConfig.monthly_limit}`} />
                <Row
                  label="Last Sync"
                  value={apiConfig.last_sync_at ? new Date(apiConfig.last_sync_at).toLocaleString('en-BD') : 'Never'}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setApiConfigOpen(true)}
                >
                  Configure API
                </Button>
              </>
            ) : (
              <LoadingSkeleton />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fraud Rules</CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden p-0">
          {rulesLoading ? (
            <LoadingSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50 text-left text-xs text-text-muted">
                    <th className="px-4 py-3 font-medium sm:px-5">Rule</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Points</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Threshold</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Severity</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                    <th className="px-4 py-3 font-medium sm:px-5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules?.map((rule) => (
                    <tr key={rule.id} className="border-b border-border/50 hover:bg-slate-50/50">
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium">{rule.name}</p>
                        <p className="text-xs text-text-muted">{rule.description}</p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">{rule.points}</td>
                      <td className="px-4 py-3 sm:px-5">{rule.threshold}</td>
                      <td className="px-4 py-3 sm:px-5">
                        <Badge variant={severityVariant[rule.severity]} className="capitalize">
                          {rule.severity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <Badge variant={rule.is_active ? 'success' : 'default'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <ActionDropdown
                          items={[
                            {
                              label: 'Edit',
                              onClick: () => { setEditingRule(rule); setRuleFormOpen(true) },
                            },
                            {
                              label: rule.is_active ? 'Disable' : 'Enable',
                              onClick: () =>
                                fraudService.toggleRule(rule.id, !rule.is_active).then(invalidate),
                            },
                            {
                              label: 'Archive',
                              onClick: () => setArchiveRule(rule),
                              variant: 'danger',
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-danger" />
            Flagged Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {flaggedCustomers.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-muted">No flagged customers</p>
            ) : (
              flaggedCustomers.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-text-muted">
                      {c.phone} · Return rate: {c.return_rate}%
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <FraudRiskBadge level={c.fraud_level} />
                    <ActionDropdown
                      items={[
                        c.is_blacklisted
                          ? {
                              label: 'Unblock',
                              onClick: () => setCustomerAction({ customer: c, mode: 'unblock' }),
                            }
                          : {
                              label: 'Block',
                              onClick: () => setCustomerAction({ customer: c, mode: 'block' }),
                              variant: 'danger',
                            },
                      ]}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <FraudRuleFormDialog
        open={ruleFormOpen}
        onOpenChange={setRuleFormOpen}
        rule={editingRule}
        onSubmit={handleRuleSubmit}
        loading={createRuleMutation.isPending || updateRuleMutation.isPending}
      />

      <FraudCustomerActionDialog
        open={!!customerAction}
        onOpenChange={() => setCustomerAction(null)}
        customer={customerAction?.customer ?? null}
        mode={customerAction?.mode ?? 'block'}
        onConfirm={async (id, reason) => {
          await customerActionMutation.mutateAsync({
            id,
            reason,
            mode: customerAction?.mode ?? 'block',
          })
        }}
        loading={customerActionMutation.isPending}
      />

      <FraudApiConfigDialog
        open={apiConfigOpen}
        onOpenChange={setApiConfigOpen}
        config={apiConfig ?? null}
        onSave={async (config) => { await apiConfigMutation.mutateAsync(config) }}
        onTest={async (provider) => {
          const result = await fraudService.testApiConnection(provider)
          toast(result.message, result.success ? 'success' : 'error')
          return result
        }}
        loading={apiConfigMutation.isPending}
      />

      <ConfirmDialog
        open={!!archiveRule}
        onOpenChange={() => setArchiveRule(null)}
        title="Archive Fraud Rule"
        description={`Archive "${archiveRule?.name}"?`}
        confirmLabel="Archive"
        variant="danger"
        loading={archiveRuleMutation.isPending}
        onConfirm={() => archiveRule && archiveRuleMutation.mutate(archiveRule.id)}
      />
    </PageShell>
  )
}

function ScoreBox({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div className={cn('rounded-lg bg-slate-50 p-2', highlight && 'ring-1 ring-primary/20')}>
      <p className="text-text-muted">{label}</p>
      <p className={cn('text-lg font-bold', highlight && 'text-primary')}>{value}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-text-muted">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{value}</span>
    </div>
  )
}
