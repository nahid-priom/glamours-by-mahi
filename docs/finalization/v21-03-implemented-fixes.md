# V2.1 — Implemented Fixes

**Date:** 2026-11-14

| Gap | Fix | Evidence |
|-----|-----|----------|
| Activity CTE `scoped` | Migration 124 applied | Remote smoke + Activity E2E screenshot |
| Dashboard net profit / category / products | Migration 125 + DashboardPage KPIs | Remote smoke + dashboard screenshots |
| Employees `/new` / `/:id` | `EmployeeCreatePage`, `EmployeeDetailPage`, routes, form fields | Routes + typecheck |
| Auth account link | Detail → `/administration/users/new?employee_id=` | `AdminUserInvitePage` preselect |
| Commission Approve → Pay | UI gates; only `approved` payable | `SalesCommissionsPage` |
| Staff commission KPIs | Accrued / Pending / Approved / Paid / Reversed | `MyCommissionPage` |
| My Orders ≠ all POS sales | `order_only` filter on `list_staff_sales` (127) | `MyOrdersPage` + `MySalesPage` |
| Targets history | `list_staff_targets` (129) + AdminTargets table | AdminTargetsPage |
| Workspace privacy | Hide Super Admin/Owner; hide when no linked employee | `AppSidebar` |
| Advances write path | create / approve / disburse RPCs (128) + UI | PayrollAdvancesPage |
| Sale cache sync | Invalidate staff + commission keys after POS complete | `invalidateSaleCompletionCaches` |
| Recon apply | Remains gated; dry-run only | ReconciliationCenterPage |

## Anti double-pay (commissions)
Standalone pay requires `approved` status via UI + RPC. Payroll inclusion uses `include_commission_in_payroll` / allocation tables from migrations `069`/`070`/`118`. Paying twice surfaces RPC errors; UI only enables Pay on `approved`.
