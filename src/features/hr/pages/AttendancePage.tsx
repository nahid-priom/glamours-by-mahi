import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { AppDateField } from '@/components/date-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { KpiGrid } from '@/components/common/KpiGrid'
import { SearchInput } from '@/components/shared/SearchInput'
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/features/auth/auth-session'
import { queryKeys } from '@/lib/query/keys'
import {
  approveMobileDevice,
  getAttendanceStats,
  issueBranchQr,
  listAttendanceAttempts,
  listAttendanceDevices,
  listAttendanceRecords,
  listCorrectionRequests,
  listMobileAttendanceDevices,
  reviewCorrectionRequest,
} from '../repositories/attendance.repository'

const statusVariant: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  present: 'success',
  absent: 'danger',
  leave: 'warning',
  half_day: 'warning',
  holiday: 'default',
  weekly_off: 'default',
  missing_checkout: 'warning',
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  revoked: 'danger',
}

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('en-BD', { hour: '2-digit', minute: '2-digit' })
}

export function AttendancePage() {
  const { activeBranchId, can } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState('daily')
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [qr, setQr] = useState<{ token: string; expires_at: string } | null>(null)

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

  const { data: mobileDevices = [] } = useQuery({
    queryKey: ['mobile-attendance-devices'],
    queryFn: listMobileAttendanceDevices,
  })

  const { data: attempts = [] } = useQuery({
    queryKey: ['attendance-attempts'],
    queryFn: () => listAttendanceAttempts(40),
  })

  const { data: corrections = [] } = useQuery({
    queryKey: ['attendance-corrections'],
    queryFn: listCorrectionRequests,
  })

  const approveMut = useMutation({
    mutationFn: approveMobileDevice,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['mobile-attendance-devices'] })
    },
  })

  const reviewMut = useMutation({
    mutationFn: reviewCorrectionRequest,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['attendance-corrections'] })
      void qc.invalidateQueries({ queryKey: queryKeys.attendance(filters) })
    },
  })

  const qrMut = useMutation({
    mutationFn: () => {
      if (!activeBranchId) throw new Error('Select a branch first')
      return issueBranchQr(activeBranchId)
    },
    onSuccess: (data) => setQr({ token: data.token, expires_at: data.expires_at }),
  })

  const canIssueQr = can('hr.attendance.manage') || can('hr.attendance.device.approve')

  useEffect(() => {
    if (!canIssueQr || !qr?.expires_at || !activeBranchId) return
    const ms = Math.max(5_000, new Date(qr.expires_at).getTime() - Date.now() - 5_000)
    const t = window.setTimeout(() => {
      void issueBranchQr(activeBranchId)
        .then((data) => setQr({ token: data.token, expires_at: data.expires_at }))
        .catch(() => undefined)
    }, ms)
    return () => window.clearTimeout(t)
  }, [qr?.expires_at, activeBranchId, canIssueQr])

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize))
  const pendingDevices = mobileDevices.filter((d) => d.status === 'pending').length
  const rejectedAttempts = attempts.filter((a) => a.decision === 'rejected').length
  const pendingCorrections = corrections.filter((c) => c.status === 'pending').length

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-3xl text-[#111111]">Attendance</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Daily records, mobile devices, attempts review, and branch QR · {devices.length} hardware
          device{devices.length === 1 ? '' : 's'}
        </p>
      </div>

      {stats ? (
        <KpiGrid
          items={[
            { label: 'Present', value: String(stats.present + stats.half_day) },
            { label: 'Absent', value: String(stats.absent) },
            { label: 'Late', value: String(stats.late) },
            { label: 'Pending devices', value: String(pendingDevices) },
            { label: 'Rejected attempts', value: String(rejectedAttempts) },
            { label: 'Pending corrections', value: String(pendingCorrections) },
          ]}
        />
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="devices">Mobile devices</TabsTrigger>
          <TabsTrigger value="attempts">Attempts</TabsTrigger>
          <TabsTrigger value="corrections">Corrections</TabsTrigger>
          <TabsTrigger value="qr">Branch QR</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="work_date">Date</Label>
              <AppDateField
                id="work_date"
                value={workDate}
                onChange={(ymd) => {
                  setWorkDate(ymd)
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
                <SelectItem value="missing_checkout">Missing checkout</SelectItem>
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
              description="No records found for this date. Mobile and device punches summarize into daily records."
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
        </TabsContent>

        <TabsContent value="devices" className="space-y-3">
          {mobileDevices.length === 0 ? (
            <EmptyState
              title="No mobile devices"
              description="Employees register devices from the attendance app."
            />
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mobileDevices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <p className="font-medium">{d.employees?.full_name ?? '—'}</p>
                        <p className="text-xs text-[#6B7280]">{d.employees?.employee_code}</p>
                      </TableCell>
                      <TableCell>
                        {d.platform} · {d.device_name ?? d.installation_id.slice(0, 8)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[d.status] ?? 'default'}>{d.status}</Badge>
                      </TableCell>
                      <TableCell>{new Date(d.created_at).toLocaleString()}</TableCell>
                      <TableCell className="space-x-2">
                        {can('hr.attendance.device.approve') || can('hr.device.manage') ? (
                          <>
                            {d.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    approveMut.mutate({ device_id: d.id, action: 'approve' })
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    approveMut.mutate({
                                      device_id: d.id,
                                      action: 'reject',
                                      reason: 'Rejected by admin',
                                    })
                                  }
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            {d.status === 'approved' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  approveMut.mutate({
                                    device_id: d.id,
                                    action: 'revoke',
                                    reason: 'Revoked by admin',
                                  })
                                }
                              >
                                Revoke
                              </Button>
                            ) : null}
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="attempts">
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Distance</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                    <TableCell>{a.event_type ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.decision === 'accepted' ? 'success' : 'danger'}>
                        {a.decision}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.risk_score}</TableCell>
                    <TableCell>
                      {a.distance_metres != null ? `${a.distance_metres} m` : '—'}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs">
                      {a.rejection_reason ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {attempts.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#6B7280]">No attempts logged yet.</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="corrections">
          <div className="overflow-x-auto rounded-2xl border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {corrections.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      {c.employees?.full_name ?? '—'}
                      <p className="text-xs text-[#6B7280]">{c.employees?.employee_code}</p>
                    </TableCell>
                    <TableCell>{c.work_date}</TableCell>
                    <TableCell>{c.request_type}</TableCell>
                    <TableCell className="max-w-xs truncate">{c.reason}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[c.status] ?? 'default'}>{c.status}</Badge>
                    </TableCell>
                    <TableCell className="space-x-2">
                      {c.status === 'pending' &&
                      (can('hr.attendance.manage') || can('hr.attendance.review')) ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => reviewMut.mutate({ id: c.id, action: 'approve' })}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => reviewMut.mutate({ id: c.id, action: 'reject' })}
                          >
                            Reject
                          </Button>
                        </>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {corrections.length === 0 ? (
              <p className="p-6 text-center text-sm text-[#6B7280]">No correction requests.</p>
            ) : null}
          </div>
        </TabsContent>

        <TabsContent value="qr" className="space-y-4">
          {!canIssueQr ? (
            <p className="text-sm text-[#E11D48]">
              Branch QR requires <code>hr.attendance.manage</code> or{' '}
              <code>hr.attendance.device.approve</code> (read-only is not enough).
            </p>
          ) : (
            <>
              <p className="text-sm text-[#6B7280]">
                HMAC-signed rotating branch QR for locations with <code>requires_qr</code>. Select an
                active branch in the header, then issue a server token (expires ~45s). Display only
                the server-issued token — do not invent client tokens.
              </p>
              <Button
                onClick={() => qrMut.mutate()}
                disabled={!activeBranchId || qrMut.isPending}
              >
                {qrMut.isPending ? 'Issuing…' : 'Issue / refresh QR'}
              </Button>
              {qr ? (
                <div className="inline-flex flex-col items-center gap-2 rounded-2xl border bg-white p-6">
                  <QRCodeSVG
                    value={JSON.stringify({
                      branch_id: activeBranchId,
                      token: qr.token,
                      expires_at: qr.expires_at,
                    })}
                    size={200}
                  />
                  <p className="text-xs text-[#6B7280]">
                    Expires {new Date(qr.expires_at).toLocaleTimeString()}
                  </p>
                </div>
              ) : null}
              {qrMut.error ? (
                <p className="text-sm text-[#E11D48]">{(qrMut.error as Error).message}</p>
              ) : null}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
