import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/toast'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { KpiGrid } from '@/components/common/KpiGrid'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import { listEmployees } from '../repositories/employees.repository'
import {
  createLeaveRequest,
  getLeaveStats,
  listLeaveRequests,
  updateLeaveStatus,
} from '../repositories/leave.repository'

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'default',
}

const LEAVE_TYPES = ['casual', 'sick', 'annual', 'unpaid', 'maternity', 'other']

export function LeavesPage() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [employeeId, setEmployeeId] = useState('')
  const [leaveType, setLeaveType] = useState('casual')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  const filters = { status: status === 'all' ? null : status, search }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.leaveRequests(filters),
    queryFn: () => listLeaveRequests(filters),
  })

  const { data: stats } = useQuery({
    queryKey: queryKeys.leaveStats,
    queryFn: getLeaveStats,
  })

  const { data: employeesData } = useQuery({
    queryKey: queryKeys.employees({ status: 'active', pageSize: 200 }),
    queryFn: () => listEmployees({ status: 'active', pageSize: 200 }),
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error('No organization')
      if (!employeeId) throw new Error('Select an employee')
      if (!startDate || !endDate) throw new Error('Select start and end dates')
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
      return createLeaveRequest(profile.organization_id, {
        employee_id: employeeId,
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        days,
        reason: reason || null,
      })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-requests'] })
      void qc.invalidateQueries({ queryKey: queryKeys.leaveStats })
      toast('Leave request submitted')
      setOpen(false)
      setEmployeeId('')
      setReason('')
      setStartDate('')
      setEndDate('')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const reviewMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approved' | 'rejected' }) =>
      updateLeaveStatus(id, action),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['leave-requests'] })
      void qc.invalidateQueries({ queryKey: queryKeys.leaveStats })
      toast('Leave request updated')
    },
    onError: (e: Error) => toast(e.message, 'error'),
  })

  const items = data?.items ?? []
  const employees = employeesData?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#111111]">Leave</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Leave requests with approve / reject workflow
          </p>
        </div>
        <PermissionGate permission="hr.leave.read">
          <Button className="rounded-full" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Request leave
          </Button>
        </PermissionGate>
      </div>

      {stats ? (
        <KpiGrid
          items={[
            { label: 'Pending', value: String(stats.pending) },
            { label: 'Approved', value: String(stats.approved) },
            { label: 'Rejected', value: String(stats.rejected) },
            { label: 'Total', value: String(stats.total) },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search employee or type…"
          className="max-w-sm"
        />
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Failed to load leave requests'}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading leave requests…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No leave requests"
          description="Submit a leave request for an employee to get started."
          actionLabel="Request leave"
          onAction={() => setOpen(true)}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.employee_name}</p>
                      <p className="text-xs text-[#6B7280]">{row.employee_code}</p>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{row.leave_type}</TableCell>
                  <TableCell>{row.start_date}</TableCell>
                  <TableCell>{row.end_date}</TableCell>
                  <TableCell>{row.days}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status] ?? 'default'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.reason ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    {row.status === 'pending' ? (
                      <PermissionGate permission="hr.leave.approve">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              reviewMutation.mutate({ id: row.id, action: 'approved' })
                            }
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              reviewMutation.mutate({ id: row.id, action: 'rejected' })
                            }
                          >
                            Reject
                          </Button>
                        </div>
                      </PermissionGate>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId || 'none'} onValueChange={(v) => setEmployeeId(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select…</SelectItem>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name} ({e.employee_code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Leave type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="start_date">Start date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="end_date">End date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Submitting…' : 'Submit'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
