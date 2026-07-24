export type SalaryType = 'monthly' | 'daily' | 'hourly'

export type AttendanceSummaryInput = {
  calendarDays: number
  scheduledWorkingDays: number
  presentDays: number
  halfDays: number
  absentDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  holidayDays: number
  weeklyOffDays: number
  lateDays: number
  totalLateMinutes: number
  overtimeMinutes: number
}

export type PayrollCalculationInput = {
  salaryType: SalaryType
  basicSalary: number
  allowances: number
  overtimeAmount: number
  bonusAmount: number
  commissionAmount: number
  attendance: AttendanceSummaryInput
  advanceRecovery: number
  loanInstallment: number
  otherDeductions: number
  lateDeductionPerDay?: number
  dailyRateOverride?: number
}

export type PayrollCalculationResult = {
  grossSalary: number
  totalEarnings: number
  attendanceDeduction: number
  leaveDeduction: number
  lateDeduction: number
  totalDeductions: number
  netPayable: number
  payableDays: number
  dailyRate: number
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function calculateDailyRate(
  salaryType: SalaryType,
  basicSalary: number,
  scheduledWorkingDays: number,
): number {
  if (scheduledWorkingDays <= 0) return 0
  if (salaryType === 'daily') return basicSalary
  if (salaryType === 'hourly') return basicSalary * 8
  return basicSalary / scheduledWorkingDays
}

export function calculatePayrollAmounts(input: PayrollCalculationInput): PayrollCalculationResult {
  const scheduledWorkingDays = Math.max(input.attendance.scheduledWorkingDays, 1)
  const dailyRate = input.dailyRateOverride ?? calculateDailyRate(
    input.salaryType,
    input.basicSalary,
    scheduledWorkingDays,
  )

  const payableDays =
    input.attendance.presentDays +
    input.attendance.halfDays * 0.5 +
    input.attendance.paidLeaveDays +
    input.attendance.holidayDays +
    input.attendance.weeklyOffDays

  let earnedBasic = input.basicSalary
  if (input.salaryType === 'monthly') {
    earnedBasic = roundMoney((input.basicSalary / scheduledWorkingDays) * payableDays)
  } else if (input.salaryType === 'daily') {
    earnedBasic = roundMoney(dailyRate * payableDays)
  } else {
    const hours = (input.attendance.overtimeMinutes + payableDays * 8 * 60) / 60
    earnedBasic = roundMoney(input.basicSalary * hours)
  }

  const overtimeAmount = roundMoney(input.overtimeAmount)
  const bonusAmount = roundMoney(input.bonusAmount)
  const commissionAmount = roundMoney(input.commissionAmount)
  const allowances = roundMoney(input.allowances)

  const attendanceDeduction = roundMoney(input.attendance.absentDays * dailyRate)
  const leaveDeduction = roundMoney(input.attendance.unpaidLeaveDays * dailyRate)
  const lateDeduction = roundMoney(
    input.attendance.lateDays * (input.lateDeductionPerDay ?? dailyRate * 0.1),
  )
  const advanceRecovery = roundMoney(input.advanceRecovery)
  const loanInstallment = roundMoney(input.loanInstallment)
  const otherDeductions = roundMoney(input.otherDeductions)

  const grossSalary = roundMoney(earnedBasic)
  const totalEarnings = roundMoney(
    grossSalary + allowances + overtimeAmount + bonusAmount + commissionAmount,
  )
  const totalDeductions = roundMoney(
    attendanceDeduction +
      leaveDeduction +
      lateDeduction +
      advanceRecovery +
      loanInstallment +
      otherDeductions,
  )
  const netPayable = roundMoney(Math.max(totalEarnings - totalDeductions, 0))

  return {
    grossSalary,
    totalEarnings,
    attendanceDeduction,
    leaveDeduction,
    lateDeduction,
    totalDeductions,
    netPayable,
    payableDays,
    dailyRate: roundMoney(dailyRate),
  }
}
