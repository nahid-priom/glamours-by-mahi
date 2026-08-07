import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AppDateField } from '@/components/date-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-session'
import { usePayrollMutations } from '../payroll/hooks/use-payroll-mutations'

function monthBounds(date = new Date()) {
  const y = date.getFullYear()
  const m = date.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    label: start.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(end.getDate())}`,
  }
}

export function PayrollNewPage() {
  const navigate = useNavigate()
  const { activeBranchId } = useAuth()
  const { create } = usePayrollMutations()
  const defaults = monthBounds()

  const [periodLabel, setPeriodLabel] = useState(defaults.label)
  const [periodStart, setPeriodStart] = useState(defaults.start)
  const [periodEnd, setPeriodEnd] = useState(defaults.end)
  const [paymentDate, setPaymentDate] = useState('')
  const [scopeType, setScopeType] = useState<'organization' | 'branch'>('organization')
  const [notes, setNotes] = useState('')

  const handleSubmit = () => {
    create.mutate(
      {
        period_label: periodLabel,
        period_start: periodStart,
        period_end: periodEnd,
        payment_date: paymentDate || null,
        scope_type: scopeType,
        branch_id: scopeType === 'branch' ? activeBranchId : null,
        notes: notes || null,
        client_txn_key: crypto.randomUUID(),
      },
      {
        onSuccess: (res) => {
          navigate(`/hr/payroll/${(res as { payroll_run_id: string }).payroll_run_id}`)
        },
      },
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div>
        <p className="text-xs text-[#6B7280]">
          <Link to="/hr/payroll" className="hover:text-primary">
            Payroll
          </Link>
          {' / New'}
        </p>
        <h1 className="font-serif text-3xl text-[#111111]">Create payroll run</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Define the pay period, then calculate from finalized attendance.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
        <div className="space-y-1.5">
          <Label>Period name</Label>
          <Input value={periodLabel} onChange={(e) => setPeriodLabel(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Period start</Label>
            <AppDateField value={periodStart} onChange={setPeriodStart} />
          </div>
          <div className="space-y-1.5">
            <Label>Period end</Label>
            <AppDateField value={periodEnd} onChange={setPeriodEnd} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Payment date (optional)</Label>
          <AppDateField value={paymentDate} onChange={setPaymentDate} clearable />
        </div>
        <div className="space-y-1.5">
          <Label>Scope</Label>
          <Select value={scopeType} onValueChange={(v) => setScopeType(v as 'organization' | 'branch')}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="organization">All active employees (organization)</SelectItem>
              <SelectItem value="branch">Current branch employees only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            disabled={!periodLabel || !periodStart || !periodEnd || create.isPending}
            onClick={handleSubmit}
            className="min-h-11"
          >
            {create.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create payroll run'
            )}
          </Button>
          <Button variant="outline" asChild className="min-h-11">
            <Link to="/hr/payroll">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
