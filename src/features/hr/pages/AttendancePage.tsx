import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { KpiGrid } from '@/components/common/KpiGrid'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import {
  getAttendanceStats,
  listAttendanceDevices,
  listAttendanceRecords,
} from '../repositories/attendance.repository'

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  present: 'success',
  absent: 'danger',
  leave: 'warning',
  half_day: 'warning',
  holiday: 'default',
  weekly_off: 'default',
  missing_checkout: 'warning',
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })
}

export function AttendancePage() {
  const { activeBranchId } = useAuth()
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filters = {
    workDate,
    branchId: activeBranchId,
    status: status === 'all' ? null : status,
    search,
    page,
    pageSize: 30,
  }

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.attendance(filters),
    queryFn: () => listAttendanceRecords(filters),
  })

  const { data: stats } = useQuery({
    queryKey: queryKeys.attendanceStats({ workDate, branchId: activeBranchId }),
    queryFn: () => getAttendanceStats(workDate, activeBranchId),
  })

  const { data: devices = [] } = useQuery({
    queryKey: queryKeys.attendanceDevices,
    queryFn: listAttendanceDevices,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl text-[#111111]">Attendance</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Daily attendance records from devices and manual entry · {devices.length} device
          {devices.length === 1 ? '' : 's'} connected
        </p>
      </div>

      {stats ? (
        <KpiGrid
          items={[
            { label: 'Present', value: String(stats.present + stats.half_day) },
            { label: 'Absent', value: String(stats.absent) },
            { label: 'Late', value: String(stats.late) },
            { label: 'On leave', value: String(stats.leave) },
            { label: 'Total records', value: String(stats.total) },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="work_date">Date</Label>
          <Input
            id="work_date"
            type="date"
            value={workDate}
            onChange={(e) => {
              setWorkDate(e.target.value)
              setPage(1)
            }}
            className="w-[160px]"
          />
        </div>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-11 w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="present">Present</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
            <SelectItem value="leave">Leave</SelectItem>
            <SelectItem value="half_day">Half day</SelectItem>
            <SelectItem value="holiday">Holiday</SelectItem>
          </SelectContent>
        </Select>
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value)
            setPage(1)
          }}
          placeholder="Search employee…"
          className="max-w-sm"
        />
      </div>

      {error ? (
        <p className="text-sm text-[#E11D48]">
          {error instanceof Error ? error.message : 'Failed to load attendance'}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading attendance…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No attendance records"
          description="No records found for this date. Device punches are summarized into daily records."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check in</TableHead>
                <TableHead>Check out</TableHead>
                <TableHead>Late (min)</TableHead>
                <TableHead>Working (min)</TableHead>
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
                  <TableCell>{row.branch_name ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[row.status] ?? 'default'}>{row.status}</Badge>
                  </TableCell>
                  <TableCell>{formatTime(row.first_in)}</TableCell>
                  <TableCell>{formatTime(row.last_out)}</TableCell>
                  <TableCell>{row.late_minutes}</TableCell>
                  <TableCell>{row.working_minutes}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm text-[#6B7280]">
          <span>
            Page {page} of {totalPages} · {total} records
          </span>
        </div>
      ) : null}
    </div>
  )
}
