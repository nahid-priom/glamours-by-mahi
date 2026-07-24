import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Wallet,
} from 'lucide-react'
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
import { SearchInput } from '@/components/shared/SearchInput'
import { PermissionGate } from '@/components/permission-gate/PermissionGate'
import { useAuth } from '@/features/auth/auth-session'
import { formatBDT } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  PAYROLL_STATUS_OPTIONS,
  PAYROLL_STATUS_VARIANT,
  normalizePayrollFilters,
} from '../payroll/lib/payroll-filters'
import { getPayrollStats, listPayrollRuns } from '../repositories/payroll.repository'

export function PayrollPage() {
  const navigate = useNavigate()
  const { activeBranchId } = useAuth()
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [branchScope, setBranchScope] = useState<'active' | 'all'>('active')

  const filters = normalizePayrollFilters(
    {
      status: status === 'all' ? null : status,
      branchId: branchScope === 'all' ? null : activeBranchId,
      search,
    },
    activeBranchId,
  )

  const {
    data,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.payrollRuns(filters),
    queryFn: () => listPayrollRuns(filters),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.payrollStats(filters),
    queryFn: () => getPayrollStats(filters),
  })

  const items = data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl text-[#111111]">Payroll</h1>
          <p className="mt-1 text-sm text-[#6B7280]">
            Payroll runs from finalized attendance · approved runs post to accounts
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/payroll/salary-structures">
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              Salary structures
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/payroll/advances">
              <Wallet className="mr-1.5 h-3.5 w-3.5" />
              Advances & loans
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/hr/payroll/reports">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Reports
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <PermissionGate permission="hr.payroll.create">
            <Button size="sm" asChild>
              <Link to="/hr/payroll/new">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create payroll
              </Link>
            </Button>
          </PermissionGate>
        </div>
      </div>

      {statsLoading ? (
        <div className="flex items-center gap-2 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading summary…
        </div>
      ) : stats ? (
        <KpiGrid
          items={[
            { label: 'Draft', value: String(stats.draft) },
            { label: 'Calculated', value: String(stats.calculated) },
            { label: 'Reviewed', value: String(stats.reviewed) },
            { label: 'Approved', value: String(stats.approved) },
            { label: 'Partially paid', value: String(stats.partially_paid) },
            { label: 'Paid', value: String(stats.paid) },
            { label: 'Total gross', value: formatBDT(stats.total_gross) },
            { label: 'Total deductions', value: formatBDT(stats.total_deductions) },
            { label: 'Total net', value: formatBDT(stats.total_net) },
            { label: 'Outstanding', value: formatBDT(stats.outstanding) },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder="Search period or branch…"
          />
        </div>
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
          <SelectTrigger className="h-11 w-[180px]">
            <SelectValue placeholder="Branch scope" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Current branch + org-wide</SelectItem>
            <SelectItem value="all">All branches</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <EmptyState
          title="Could not load payroll runs"
          description={error instanceof Error ? error.message : 'Please try again.'}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading payroll runs…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={status !== 'all' || search ? 'No matching payroll runs' : 'No payroll runs'}
          description={
            status !== 'all' || search
              ? 'Try changing filters or reset your search.'
              : 'Create a payroll run for a pay period to get started.'
          }
        />
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{row.period_label}</p>
                      <p className="text-xs text-[#6B7280]">
                        {row.period_start} → {row.period_end}
                      </p>
                    </div>
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
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/hr/payroll/${row.id}`)}>
                      View
                    </Button>
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
