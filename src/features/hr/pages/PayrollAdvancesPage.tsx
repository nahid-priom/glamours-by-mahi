import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import { listEmployeeAdvances, listEmployeeLoans } from '../repositories/payroll.repository'

export function PayrollAdvancesPage() {
  const { data: advances = [], isLoading: advLoading, error: advError } = useQuery({
    queryKey: queryKeys.employeeAdvances,
    queryFn: listEmployeeAdvances,
  })

  const { data: loans = [], isLoading: loanLoading, error: loanError } = useQuery({
    queryKey: queryKeys.employeeLoans,
    queryFn: listEmployeeLoans,
  })

  const isLoading = advLoading || loanLoading
  const error = advError ?? loanError

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/hr/payroll">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Payroll
          </Link>
        </Button>
        <h1 className="font-serif text-3xl text-[#111111]">Advances & loans</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Employee advances and loan installments recovered through payroll
        </p>
      </div>

      {error ? (
        <EmptyState
          title="Could not load data"
          description={error instanceof Error ? error.message : 'Please try again.'}
        />
      ) : isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <section className="space-y-2">
            <h2 className="font-medium text-[#111111]">Salary advances</h2>
            {advances.length === 0 ? (
              <EmptyState title="No advances" description="Employee salary advances will appear here." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Recovered</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.employees?.full_name ?? '—'}</p>
                            <p className="text-xs text-[#6B7280]">{row.employees?.employee_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatBDT(row.amount)}</TableCell>
                        <TableCell>{formatBDT(row.recovered_amount)}</TableCell>
                        <TableCell>{formatBDT(row.remaining_amount)}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                        <TableCell>{formatDateShort(row.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>

          <section className="space-y-2">
            <h2 className="font-medium text-[#111111]">Employee loans</h2>
            {loans.length === 0 ? (
              <EmptyState title="No loans" description="Employee loans will appear here." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Principal</TableHead>
                      <TableHead>Installment</TableHead>
                      <TableHead>Paid</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Start</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.employees?.full_name ?? '—'}</p>
                            <p className="text-xs text-[#6B7280]">{row.employees?.employee_code}</p>
                          </div>
                        </TableCell>
                        <TableCell>{formatBDT(row.principal)}</TableCell>
                        <TableCell>{formatBDT(row.installment_amount)}</TableCell>
                        <TableCell>{formatBDT(row.paid_amount)}</TableCell>
                        <TableCell>{formatBDT(row.remaining_amount)}</TableCell>
                        <TableCell className="capitalize">{row.status}</TableCell>
                        <TableCell>{row.start_date}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
