import { describe, expect, it } from 'vitest'
import { amountInWordsBDT, buildPayslipLines } from './payslip'

describe('amountInWordsBDT', () => {
  it('converts zero', () => {
    expect(amountInWordsBDT(0)).toBe('Zero Taka only')
  })

  it('converts typical salary amounts', () => {
    expect(amountInWordsBDT(33300)).toBe('Thirty Three Thousand Three Hundred Taka only')
    expect(amountInWordsBDT(1500)).toBe('One Thousand Five Hundred Taka only')
  })
})

describe('buildPayslipLines', () => {
  it('builds earnings and deductions with advance recovery', () => {
    const { earnings, deductions } = buildPayslipLines({
      basic_salary: 20000,
      allowances: 5000,
      overtime: 1000,
      bonus: 0,
      commission_amount: 2000,
      attendance_deduction: 500,
      leave_deduction: 0,
      other_deductions: 1500,
      breakdown: { advance_recovery: 1000, loan_installment: 500 },
    })

    expect(earnings.map((e) => e.code)).toEqual(['basic', 'allowances', 'overtime', 'commission'])
    expect(earnings.reduce((s, e) => s + e.amount, 0)).toBe(28000)
    expect(deductions.map((d) => d.code)).toEqual(['attendance', 'advance', 'loan'])
    expect(deductions.reduce((s, d) => s + d.amount, 0)).toBe(2000)
  })
})
