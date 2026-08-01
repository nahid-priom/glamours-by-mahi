import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { listAdminUsers } from '../repositories/administration.repository'
import { assignStaffTarget } from '@/features/staff/repositories/staff.repository'

export function AdminTargetsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [staffUserId, setStaffUserId] = useState('')
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [salesAmount, setSalesAmount] = useState(100000)
  const [startsAt, setStartsAt] = useState(() => new Date().toISOString().slice(0, 10))
  const [endsAt, setEndsAt] = useState(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().slice(0, 10)
  })

  const { data: users = [] } = useQuery({
    queryKey: ['admin-users-targets'],
    queryFn: () => listAdminUsers(''),
  })

  const mut = useMutation({
    mutationFn: () =>
      assignStaffTarget({
        staff_user_id: staffUserId,
        target_period: period,
        sales_amount: salesAmount,
        starts_at: startsAt,
        ends_at: endsAt,
      }),
    onSuccess: () => {
      toast('Target assigned')
      void qc.invalidateQueries({ queryKey: ['staff-dashboard'] })
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  return (
    <PermissionGate permission={['staff.targets.manage', 'settings.manage']}>
      <div className="mx-auto max-w-lg space-y-4">
        <div>
          <h1 className="text-xl font-bold">Staff Targets</h1>
          <p className="text-sm text-[#6B7280]">Moderator / Sales Executive-এর জন্য Target সেট করুন</p>
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
              <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ends</Label>
              <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            </div>
          </div>
          <Button type="submit" disabled={mut.isPending || !staffUserId}>
            Assign target
          </Button>
        </form>
      </div>
    </PermissionGate>
  )
}
