import { useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { brandConfig } from '@/config/brand'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatBDT, formatDateShort } from '@/lib/format'
import { queryKeys } from '@/lib/query/keys'
import {
  amountInWordsBDT,
  buildPayslipLines,
  type AttendanceSnapshot,
} from '../payroll/lib/payslip'
import { getPayrollItem } from '../repositories/payroll.repository'
import '@/features/print/print.css'

export function PayslipPage() {
  const { payrollItemId = '' } = useParams<{ payrollItemId: string }>()
  const printRef = useRef<HTMLDivElement>(null)

  const { data: item, isLoading, error } = useQuery({
    queryKey: queryKeys.payrollItem(payrollItemId),
    queryFn: () => getPayrollItem(payrollItemId),
    enabled: Boolean(payrollItemId),
  })

  const triggerPrint = () => window.print()

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[#6B7280]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading payslip…
      </div>
    )
  }

  if (error || !item) {
    return (
      <EmptyState
        title="Payslip not found"
        description={error instanceof Error ? error.message : 'This payslip may have been removed.'}
      />
    )
  }

  const run = item.payroll_runs
  const att = ((item as { attendance_snapshot?: AttendanceSnapshot }).attendance_snapshot ?? {}) as AttendanceSnapshot
  const { earnings, deductions } = buildPayslipLines({
    basic_salary: item.basic_salary,
    allowances: item.allowances,
    overtime: item.overtime,
    bonus: item.bonus,
    commission_amount: Number((item as { commission_amount?: number }).commission_amount ?? 0),
    attendance_deduction: item.attendance_deduction,
    leave_deduction: item.leave_deduction,
    other_deductions: item.other_deductions,
    breakdown: (item as { breakdown?: Record<string, unknown> }).breakdown,
  })
  const grossTotal = earnings.reduce((s, l) => s + l.amount, 0)
  const deductionTotal = deductions.reduce((s, l) => s + l.amount, 0)

  return (
    <div className="print-root min-h-screen bg-[#F9FAFB] p-4">
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {run ? (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/hr/payroll/${run.id}?tab=employees`}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back to payroll
            </Link>
          </Button>
        ) : null}
        <Button size="sm" onClick={triggerPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print
        </Button>
        <Button variant="outline" size="sm" onClick={triggerPrint}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Save as PDF
        </Button>
      </div>

      <div ref={printRef} className="print-page invoice-page mx-auto max-w-[210mm] bg-white p-8 shadow-sm">
        <div className="invoice-header mb-6 flex items-start justify-between border-b pb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ color: brandConfig.themeColor }}>
              {brandConfig.name}
            </h1>
            <p className="text-xs text-slate-500">{brandConfig.address}</p>
            <p className="text-xs text-slate-500">{brandConfig.phone}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold uppercase tracking-wide">Payslip</p>
            <p className="text-sm text-slate-600">{run?.period_label ?? 'Pay period'}</p>
            <p className="text-xs text-slate-500">
              {run ? `${run.period_start} – ${run.period_end}` : ''}
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Employee</p>
            <p className="font-semibold">{item.employee_name}</p>
            <p>{item.employee_code}</p>
            {item.designation ? <p>{item.designation}</p> : null}
            {item.department ? <p className="text-slate-600">{item.department}</p> : null}
          </div>
          <div className="text-right text-sm">
            <p className="text-xs font-semibold uppercase text-slate-500">Payment status</p>
            <p className="capitalize font-medium">
              {(item as { payment_status?: string }).payment_status ?? 'unpaid'}
            </p>
            {run?.branches?.name ? (
              <>
                <p className="mt-2 text-xs font-semibold uppercase text-slate-500">Branch</p>
                <p>{run.branches.name}</p>
              </>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">Generated {formatDateShort(new Date().toISOString())}</p>
          </div>
        </div>

        {(att.present != null || att.payable_days != null) && (
          <div className="mb-6 grid grid-cols-4 gap-2 rounded border p-3 text-xs">
            <div><span className="text-slate-500">Present</span><p className="font-medium">{att.present ?? '—'}</p></div>
            <div><span className="text-slate-500">Absent</span><p className="font-medium">{att.absent ?? '—'}</p></div>
            <div><span className="text-slate-500">Payable days</span><p className="font-medium">{att.payable_days ?? '—'}</p></div>
            <div><span className="text-slate-500">Overtime (min)</span><p className="font-medium">{att.overtime_minutes ?? '—'}</p></div>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-6">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Earnings</p>
            <table className="invoice-table w-full text-sm">
              <tbody>
                {earnings.map((line) => (
                  <tr key={line.code}>
                    <td>{line.name}</td>
                    <td className="text-right">{formatBDT(line.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t font-semibold">
                  <td>Gross</td>
                  <td className="text-right">{formatBDT(grossTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Deductions</p>
            <table className="invoice-table w-full text-sm">
              <tbody>
                {deductions.length === 0 ? (
                  <tr><td colSpan={2} className="text-slate-500">No deductions</td></tr>
                ) : (
                  deductions.map((line) => (
                    <tr key={line.code}>
                      <td>{line.name}</td>
                      <td className="text-right">{formatBDT(line.amount)}</td>
                    </tr>
                  ))
                )}
                <tr className="border-t font-semibold">
                  <td>Total deductions</td>
                  <td className="text-right">{formatBDT(deductionTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="flex justify-between text-lg font-bold">
            <span>Net pay</span>
            <span style={{ color: brandConfig.themeColor }}>{formatBDT(item.net_salary)}</span>
          </div>
          <p className="mt-2 text-sm text-slate-600">{amountInWordsBDT(item.net_salary)}</p>
        </div>

        <p className="mt-10 text-center text-xs text-slate-400">
          This is a computer-generated payslip · Powered by {brandConfig.poweredBy}
        </p>
      </div>
    </div>
  )
}
