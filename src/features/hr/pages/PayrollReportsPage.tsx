import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { EmptyState } from '@/components/shared/EmptyState'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  PAYROLL_STATUS_OPTIONS,
  PAYROLL_STATUS_VARIANT,
  normalizePayrollFilters,
} from '../payroll/lib/payroll-filters'
import { getPayrollStats, listPayrollReportRows } from '../repositories/payroll.repository'

function downloadCsv(rows: Awaited<ReturnType<typeof listPayrollReportRows>>) {
  const header = ['Period', 'Branch', 'Status', 'Employees', 'Gross', 'Deductions', 'Net', 'Outstanding']
  const lines = rows.map((r) => [
    r.period_label,
    r.branch_name ?? 'All',
    r.status,
    String(r.employee_count),
    String(r.total_gross),
    String(r.total_deductions),
    String(r.total_net),
    String((r as { outstanding?: number }).outstanding ?? r.total_net),
  ])
  const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `payroll-report-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function PayrollReportsPage() {
  const { activeBranchId } = useAuth()
  const [status, setStatus] = useState('all')
  const [branchScope, setBranchScope] = useState<'active' | 'all'>('active')

  const filters = normalizePayrollFilters(
    {
      status: status === 'all' ? null : status,
      branchId: branchScope === 'all' ? null : activeBranchId,
    },
    activeBranchId,
  )

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: [...queryKeys.payrollRuns(filters), 'report'],
    queryFn: () => listPayrollReportRows(filters),
  })

  const { data: stats } = useQuery({
    queryKey: queryKeys.payrollStats(filters),
    queryFn: () => getPayrollStats(filters),
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link to="/hr/payroll">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Payroll
            </Link>
          </Button>
          <h1 className="font-serif text-3xl text-[#111111]">Payroll reports</h1>
          <p className="mt-1 text-sm text-[#6B7280]">Summary of payroll runs with export</p>
        </div>
        <Button size="sm" variant="outline" disabled={rows.length === 0} onClick={() => downloadCsv(rows)}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {stats ? (
        <KpiGrid
          items={[
            { label: 'Runs', value: String(rows.length) },
            { label: 'Total gross', value: formatBDT(stats.total_gross) },
            { label: 'Total net', value: formatBDT(stats.total_net) },
            { label: 'Outstanding', value: formatBDT(stats.outstanding) },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11 w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {PAYROLL_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={branchScope} onValueChange={(v) => setBranchScope(v as 'active' | 'all')}>
          <SelectTrigger className="h-11 w-[200px]">
            <SelectValue placeholder="Branch scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Current branch + org-wide</SelectItem>
            <SelectItem value="all">All branches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <EmptyState title="Could not load report" description={error instanceof Error ? error.message : ''} />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No payroll data" description="Adjust filters or create payroll runs." />
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Employees</TableHead>
                <TableHead>Gross</TableHead>
                <TableHead>Net</TableHead>
                <TableHead>Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link className="font-medium hover:underline" to={`/hr/payroll/${row.id}`}>
                      {row.period_label}
                    </Link>
                  </TableCell>
                  <TableCell>{row.branch_name ?? 'All branches'}</TableCell>
                  <TableCell>
                    <Badge variant={PAYROLL_STATUS_VARIANT[row.status] ?? 'default'} className="capitalize">
                      {row.status.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{row.employee_count}</TableCell>
                  <TableCell>{formatBDT(row.total_gross)}</TableCell>
                  <TableCell className="font-semibold">{formatBDT(row.total_net)}</TableCell>
                  <TableCell>
                    {formatBDT(Number((row as { outstanding?: number }).outstanding ?? row.total_net))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
