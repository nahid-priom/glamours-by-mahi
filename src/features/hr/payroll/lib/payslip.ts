const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function chunkToWords(n: number): string {
  if (n === 0) return ''
  if (n < 20) return ONES[n]
  if (n < 100) {
    const t = Math.floor(n / 10)
    const r = n % 10
    return `${TENS[t]}${r ? ` ${ONES[r]}` : ''}`.trim()
  }
  const h = Math.floor(n / 100)
  const r = n % 100
  return `${ONES[h]} Hundred${r ? ` ${chunkToWords(r)}` : ''}`.trim()
}

function numberToWords(n: number): string {
  if (n === 0) return 'Zero'
  const parts: string[] = []
  const crore = Math.floor(n / 10_000_000)
  const lakh = Math.floor((n % 10_000_000) / 100_000)
  const thousand = Math.floor((n % 100_000) / 1_000)
  const rest = n % 1_000

  if (crore) parts.push(`${chunkToWords(crore)} Crore`)
  if (lakh) parts.push(`${chunkToWords(lakh)} Lakh`)
  if (thousand) parts.push(`${chunkToWords(thousand)} Thousand`)
  if (rest) parts.push(chunkToWords(rest))

  return parts.join(' ')
}

/** Convert BDT amount to words for payslip footer. */
export function amountInWordsBDT(amount: number): string {
  const safe = Math.max(0, Math.round(amount))
  return `${numberToWords(safe)} Taka only`
}

export type PayslipEarningLine = { code: string; name: string; amount: number }
export type PayslipDeductionLine = { code: string; name: string; amount: number }

export type AttendanceSnapshot = {
  scheduled_days?: number
  present?: number
  half_day?: number
  absent?: number
  paid_leave?: number
  unpaid_leave?: number
  holiday?: number
  weekly_off?: number
  late_days?: number
  overtime_minutes?: number
  payable_days?: number
  daily_rate?: number
}

export function buildPayslipLines(item: {
  basic_salary: number
  allowances: number
  overtime: number
  bonus: number
  commission_amount?: number
  attendance_deduction: number
  leave_deduction: number
  other_deductions: number
  breakdown?: Record<string, unknown> | null
}): { earnings: PayslipEarningLine[]; deductions: PayslipDeductionLine[] } {
  const earnings: PayslipEarningLine[] = [
    { code: 'basic', name: 'Basic salary', amount: Number(item.basic_salary) },
  ]
  if (Number(item.allowances) > 0) {
    earnings.push({ code: 'allowances', name: 'Allowances', amount: Number(item.allowances) })
  }
  if (Number(item.overtime) > 0) {
    earnings.push({ code: 'overtime', name: 'Overtime', amount: Number(item.overtime) })
  }
  if (Number(item.bonus) > 0) {
    earnings.push({ code: 'bonus', name: 'Bonus', amount: Number(item.bonus) })
  }
  if (Number(item.commission_amount ?? 0) > 0) {
    earnings.push({
      code: 'commission',
      name: 'Sales commission',
      amount: Number(item.commission_amount),
    })
  }

  const deductions: PayslipDeductionLine[] = []
  if (Number(item.attendance_deduction) > 0) {
    deductions.push({
      code: 'attendance',
      name: 'Attendance deduction',
      amount: Number(item.attendance_deduction),
    })
  }
  if (Number(item.leave_deduction) > 0) {
    deductions.push({
      code: 'leave',
      name: 'Leave deduction',
      amount: Number(item.leave_deduction),
    })
  }
  const breakdown = (item.breakdown ?? {}) as Record<string, number>
  if (Number(breakdown.advance_recovery) > 0) {
    deductions.push({
      code: 'advance',
      name: 'Advance recovery',
      amount: Number(breakdown.advance_recovery),
    })
  }
  if (Number(breakdown.loan_installment) > 0) {
    deductions.push({
      code: 'loan',
      name: 'Loan installment',
      amount: Number(breakdown.loan_installment),
    })
  }
  const other =
    Number(item.other_deductions) -
    Number(breakdown.advance_recovery ?? 0) -
    Number(breakdown.loan_installment ?? 0)
  if (other > 0) {
    deductions.push({ code: 'other', name: 'Other deductions', amount: other })
  }

  return { earnings, deductions }
}
