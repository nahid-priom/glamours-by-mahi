import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AppDateField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatDateShort } from '@/lib/format'
import { addDaysYmd, todayYmd } from '@/lib/datetime/bd'
import { listAdminUsers } from '../repositories/administration.repository'
import { assignStaffTarget, listStaffTargets } from '@/features/staff/repositories/staff.repository'
import { queryKeys } from '@/lib/query/keys'
import { supabase } from '@/lib/supabase/client'

export function AdminTargetsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [staffUserId, setStaffUserId] = useState('')
  const [branchId, setBranchId] = useState('')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [salesAmount, setSalesAmount] = useState(100000)
  const [startsAt, setStartsAt] = useState(() => todayYmd())
  const [endsAt, setEndsAt] = useState(() => addDaysYmd(todayYmd(), 30))

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-targets'],
    queryFn: () => listAdminUsers(''),
  })

  const { data: branches = [] } = useQuery({
    queryKey: queryKeys.branches,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .is('deleted_at', null)
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data ?? []
    },
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['staff-targets-history'],
    queryFn: () => listStaffTargets({ limit: 100 }),
  })

  const mut = useMutation({
    mutationFn: () =>
      assignStaffTarget({
        staff_user_id: staffUserId,
        branch_id: branchId || null,
        target_period: period,
        sales_amount: salesAmount,
        starts_at: startsAt,
        ends_at: endsAt,
      }),
    onSuccess: () => {
      toast('Target assigned')
      void qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
      void qc.invalidateQueries({ queryKey: ['staff-targets-history'] })
      void qc.invalidateQueries({ queryKey: ['my-staff-targets-history'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const items = history?.items ?? []

  return (
    <PermissionGate permission={['staff.targets.manage', 'settings.manage']}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-xl font-bold">Staff Targets</h1>
          <p className="text-sm text-[#6B7280]">
            Assign sales targets to a specific staff user. Achievement is measured from that staff
            member&apos;s attributed sales only — never organization-wide totals.
          </p>
        </div>
        <form
          className="space-y-3 rounded-2xl border bg-white p-4"
          onSubmit={(e) => {
            e.preventDefault()
            mut.mutate()
          }}
        >
          <div className="space-y-1.5">
            <Label>Staff</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={staffUserId}
              onChange={(e) => setStaffUserId(e.target.value)}
              required
            >
              <option value="">Select…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role_name ?? '—'})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Branch (optional scope)</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All attributed sales</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Period</Label>
            <select
              className="h-10 w-full rounded-md border px-3 text-sm"
              value={period}
              onChange={(e) => setPeriod(e.target.value as typeof period)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Sales target (BDT)</Label>
            <Input
              type="number"
              min={0}
              value={salesAmount}
              onChange={(e) => setSalesAmount(Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Starts</Label>
              <AppDateField value={startsAt} onChange={setStartsAt} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <AppDateField value={endsAt} onChange={setEndsAt} />
            </div>
          </div>
          <Button type="submit" disabled={mut.isPending || !staffUserId}>
            Assign target
          </Button>
        </form>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-[#111111]">Target history</h2>
          {historyLoading ? (
            <p className="text-sm text-[#6B7280]">Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState title="No targets yet" description="Assigned targets will appear here." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-[#F9FAFB] text-left text-xs uppercase text-[#6B7280]">
                  <tr>
                    <th className="px-3 py-2">Staff</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Target</th>
                    <th className="px-3 py-2">Achieved</th>
                    <th className="px-3 py-2">Window</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const pct =
                      Number(row.sales_amount) > 0
                        ? Math.min(100, Math.round((Number(row.achieved_sales) / Number(row.sales_amount)) * 100))
                        : 0
                    return (
                      <tr key={row.id} className="border-t">
                        <td className="px-3 py-2 font-medium">{row.staff_name ?? '—'}</td>
                        <td className="px-3 py-2 capitalize">{row.target_period}</td>
                        <td className="px-3 py-2">{formatBDT(Number(row.sales_amount))}</td>
                        <td className="px-3 py-2">
                          {formatBDT(Number(row.achieved_sales))}
                          <span className="ml-1 text-xs text-[#6B7280]">({pct}%)</span>
                        </td>
                        <td className="px-3 py-2 text-xs text-[#6B7280]">
                          {formatDateShort(row.starts_at)} → {formatDateShort(row.ends_at)}
                        </td>
                        <td className="px-3 py-2 capitalize">{row.status}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PermissionGate>
  )
}
