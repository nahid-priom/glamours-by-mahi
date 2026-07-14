import type { Payroll } from '@/database/schema'
import { runAtomic, TransactionError, peekDatabase } from '@/database/transaction'
import { postFinance, logActivity } from '@/database/repositories/finance.repository'

export const payrollService = {
  list() {
    return peekDatabase().payrolls
  },

  getById(id: string) {
    return peekDatabase().payrolls.find((p) => p.id === id) ?? null
  },

  pay(input: { payrollId: string; accountId: string; userName: string }): Payroll {
    return runAtomic(`payroll-pay:${input.payrollId}`, (db) => {
      const payroll = db.payrolls.find((p) => p.id === input.payrollId)
      if (!payroll) throw new TransactionError('Payroll not found')
      if (payroll.status === 'Paid') throw new TransactionError('Payroll already paid')
      const employee = db.employees.find((e) => e.id === payroll.employeeId)
      if (!employee || employee.status !== 'active') {
        throw new TransactionError('Inactive employee cannot receive payroll')
      }

      postFinance(db, {
        accountId: input.accountId,
        type: 'Expense',
        category: 'Salary',
        amount: payroll.netSalary,
        referenceType: 'payroll',
        referenceId: payroll.id,
        description: `Salary ${payroll.month} · ${employee.name}`,
        userName: input.userName,
      })

      payroll.status = 'Paid'
      payroll.paidAt = new Date().toISOString()
      payroll.accountId = input.accountId

      logActivity(db, {
        action: 'Payroll Paid',
        entityType: 'payroll',
        entityId: payroll.id,
        userName: input.userName,
        details: `${employee.name} · ৳${payroll.netSalary}`,
      })
      return payroll
    })
  },

  generateMonth(month: string, userName: string) {
    return runAtomic(`payroll-gen:${month}`, (db) => {
      const existing = db.payrolls.filter((p) => p.month === month)
      if (existing.length) return existing

      const created: Payroll[] = []
      for (const employee of db.employees.filter((e) => e.status === 'active')) {
        const attendance = db.attendance.filter(
          (a) => a.employeeId === employee.id && a.date.startsWith(month.slice(0, 7) || month),
        )
        const absent = attendance.filter((a) => a.status === 'Absent').length
        const late = attendance.filter((a) => a.status === 'Late').length
        const overtimeDays = attendance.filter((a) => a.status === 'Overtime').length
        const commission = db.commissions
          .filter((c) => c.employeeId === employee.id && c.status === 'Approved')
          .reduce((s, c) => s + c.amount, 0)
        const absenceDeduction = Math.round((employee.basicSalary / 30) * absent)
        const lateDeduction = late * 100
        const overtime = overtimeDays * 500
        const net =
          employee.basicSalary + overtime + commission - absenceDeduction - lateDeduction
        const payroll: Payroll = {
          id: `pay_${employee.id}_${month}`,
          employeeId: employee.id,
          month,
          basicSalary: employee.basicSalary,
          overtime,
          commission,
          bonus: 0,
          absenceDeduction,
          lateDeduction,
          advance: 0,
          otherDeduction: 0,
          netSalary: Math.max(0, net),
          status: 'Approved',
          paidAt: null,
          accountId: null,
        }
        db.payrolls.unshift(payroll)
        created.push(payroll)
      }
      logActivity(db, {
        action: 'Payroll Generated',
        entityType: 'payroll',
        entityId: month,
        userName,
        details: `${created.length} employees · ${month}`,
      })
      return created
    })
  },
}
