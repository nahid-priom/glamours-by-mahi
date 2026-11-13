# V2.1 — HR / Commission E2E Evidence

## Employee create → detail → login link
- Routes: `/hr/employees`, `/hr/employees/new`, `/hr/employees/:id`
- Soft delete preserved; Create login deep-links invite with `employee_id`
- Authenticated smoke: employees shell screenshot set under `screenshots/v21/employees-*.png`

## Commission lifecycle
- Pending → Approve (`approve_sales_commission`) → Pay (`pay_sales_commission`)
- Pending not payable in UI
- Screenshots: `screenshots/v21/commissions-*.png`
- Full POS → accrue → approve → pay money movement **not executed** against production in this pass (non-destructive policy). RPC wiring + UI gates verified in code + remote function presence.

## Advances
- Create / Approve / Disburse RPCs applied (128) and verified remotely
- UI: `screenshots/v21/advances-*.png`
- Payroll calculate already recovers `disbursed`/`recovering` remaining balances into payslip deductions (existing `calculate_payroll_run`)
- Live advance → payroll run → payslip on production **not forced** (would mutate payroll); recovery path documented as existing SQL

## Blockers (honest)
- Destructive money paths (live commission payout, live payroll payment) skipped on linked production.
- Staff My Workspace screenshots require a non–Super Admin linked employee session — not available in `.env.e2e.local` (admin only).
