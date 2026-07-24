import { describe, expect, it } from 'vitest'
import { calculatePayrollAmounts } from './payroll-calculator'

describe('calculatePayrollAmounts', () => {
  const baseAttendance = {
    calendarDays: 30,
    scheduledWorkingDays: 26,
    presentDays: 26,
    halfDays: 0,
    absentDays: 0,
    paidLeaveDays: 0,
    unpaidLeaveDays: 0,
    holidayDays: 0,
    weeklyOffDays: 0,
    lateDays: 0,
    totalLateMinutes: 0,
    overtimeMinutes: 0,
  }

  it('calculates full monthly attendance correctly', () => {
    const result = calculatePayrollAmounts({
      salaryType: 'monthly',
      basicSalary: 30000,
      allowances: 5000,
      overtimeAmount: 0,
      bonusAmount: 0,
      commissionAmount: 0,
      attendance: baseAttendance,
      advanceRecovery: 0,
      loanInstallment: 0,
      otherDeductions: 0,
    })
    expect(result.grossSalary).toBe(30000)
    expect(result.totalEarnings).toBe(35000)
    expect(result.netPayable).toBe(35000)
  })

  it('deducts absence and unpaid leave', () => {
    const result = calculatePayrollAmounts({
      salaryType: 'monthly',
      basicSalary: 26000,
      allowances: 0,
      overtimeAmount: 0,
      bonusAmount: 0,
      commissionAmount: 0,
      attendance: { ...baseAttendance, presentDays: 24, absentDays: 2, unpaidLeaveDays: 1 },
      advanceRecovery: 0,
      loanInstallment: 0,
      otherDeductions: 0,
    })
    expect(result.attendanceDeduction).toBeGreaterThan(0)
    expect(result.leaveDeduction).toBeGreaterThan(0)
    expect(result.netPayable).toBeLessThan(26000)
  })

  it('includes overtime and commission', () => {
    const result = calculatePayrollAmounts({
      salaryType: 'monthly',
      basicSalary: 20000,
      allowances: 0,
      overtimeAmount: 1500,
      bonusAmount: 1000,
      commissionAmount: 2500,
      attendance: baseAttendance,
      advanceRecovery: 0,
      loanInstallment: 0,
      otherDeductions: 0,
    })
    expect(result.totalEarnings).toBe(25000)
    expect(result.netPayable).toBe(25000)
  })

  it('never returns negative net salary', () => {
    const result = calculatePayrollAmounts({
      salaryType: 'monthly',
      basicSalary: 5000,
      allowances: 0,
      overtimeAmount: 0,
      bonusAmount: 0,
      commissionAmount: 0,
      attendance: { ...baseAttendance, presentDays: 5, absentDays: 21 },
      advanceRecovery: 3000,
      loanInstallment: 2000,
      otherDeductions: 500,
    })
    expect(result.netPayable).toBeGreaterThanOrEqual(0)
  })
})
