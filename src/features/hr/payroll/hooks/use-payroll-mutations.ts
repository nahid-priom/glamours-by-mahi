import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/components/ui/toast'
import { toastRpcError } from '@/lib/errors/rpc-error'
import { queryKeys } from '@/lib/query/keys'
import {
  approvePayrollRun,
  calculatePayrollRun,
  createPayrollRun,
  payPayrollItems,
  rejectPayrollRun,
  submitPayrollForReview,
  type CreatePayrollRunPayload,
  type PayPayrollItemsPayload,
} from '@/features/hr/repositories/payroll.repository'

export function usePayrollMutations(runId?: string) {
  const qc = useQueryClient()
  const { toast } = useToast()

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['payroll-runs'] })
    await qc.invalidateQueries({ queryKey: ['payroll-stats'] })
    if (runId) {
      await qc.invalidateQueries({ queryKey: queryKeys.payrollRun(runId) })
      await qc.invalidateQueries({ queryKey: queryKeys.payrollItems(runId) })
      await qc.invalidateQueries({ queryKey: queryKeys.payrollApprovalLogs(runId) })
      await qc.invalidateQueries({ queryKey: queryKeys.payrollPayments(runId) })
    }
    await qc.invalidateQueries({ queryKey: queryKeys.accounts })
    await qc.invalidateQueries({ queryKey: ['accounting-transactions'] })
  }

  const create = useMutation({
    mutationFn: (payload: CreatePayrollRunPayload) => createPayrollRun(payload),
    onSuccess: async (res) => {
      await invalidate()
      toast(res.idempotent ? 'Payroll run already exists' : 'Payroll created')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const calculate = useMutation({
    mutationFn: (id: string) => calculatePayrollRun(id, crypto.randomUUID()),
    onSuccess: async (res: { payroll_run_id: string; employee_count: number; idempotent?: boolean }) => {
      await invalidate()
      toast(
        res.idempotent
          ? 'Payroll already calculated'
          : `Payroll calculated for ${res.employee_count} employees`,
      )
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const approve = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      approvePayrollRun(id, comments),
    onSuccess: async () => {
      await invalidate()
      toast('Payroll approved')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      rejectPayrollRun(id, reason),
    onSuccess: async () => {
      await invalidate()
      toast('Payroll returned to draft')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const submitReview = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) =>
      submitPayrollForReview(id, comments),
    onSuccess: async () => {
      await invalidate()
      toast('Payroll submitted for review')
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  const pay = useMutation({
    mutationFn: (payload: PayPayrollItemsPayload) => payPayrollItems(payload),
    onSuccess: async (res: { idempotent?: boolean; amount_paid: number }) => {
      await invalidate()
      toast(
        res.idempotent
          ? 'Payment already recorded'
          : `Payment recorded — ৳${res.amount_paid.toLocaleString()}`,
      )
    },
    onError: (e: Error) => toastRpcError(toast, e),
  })

  return { create, calculate, submitReview, approve, reject, pay }
}
