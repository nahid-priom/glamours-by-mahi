# V2.1 — Corrected Functional Audit

**Date:** 2026-11-14  
**Distinction:** Sidebar route registration ≠ page-level feature completeness.

## Sidebar route registration
70/70 sidebar links match router entries. **0 × 404.**

## Page-level Partials (pre-V2.1)

| Area | Route / feature | Issue | Priority |
|------|-----------------|-------|----------|
| Activity | `/administration/activity` | `list_activity_feed` CTE `scoped` until mig 124 | P0 |
| Dashboard profit | `/dashboard` | Net profit / category need mig 125 | P0 |
| Employees | `/hr/employees/new`, `/:id` | Same list page; params ignored | P0 |
| Commissions | `/hr/commissions` | Approve RPC unused; pending treated payable | P0 |
| Advances | `/hr/payroll/advances` | Read-only | P1 |
| Staff targets | `/administration/targets` | Assign only; no history list | P1 |
| My Orders | `/staff/my-orders` | Thin wrapper over My Sales | P1 |
| Reconciliation | `/accounts/reconciliation` | Dry-run; apply gated | P1 |
| Admin Permissions | `/administration/permissions` | Static catalog | P2 |
| Website tabs | `/settings/website/*` siblings | Placeholders (orphan) | P2 |
| Employee RLS | `employees` | Org-wide until mig 126 | P1 |

## Module / action / test matrix (summary)

| Module | Read | Write | AuthZ | Automated test | Pre-V2.1 status |
|--------|------|-------|-------|----------------|-----------------|
| Dashboard | RPC | — | `dashboard.read` | E2E smoke | Partial vs defs |
| POS | catalogue | `complete_pos_sale` | `pos.create` | unit + E2E | Working |
| Sales history/returns/collections | yes | RPCs | sales.* | partial | Working |
| Online orders | yes | approve/fulfil | orders.* | partial | Working |
| Exchanges | yes | complete | exchange.* | partial | Working |
| Products/Inventory | yes | CRUD/adjust/transfer | products/inventory | partial | Working |
| Purchases/Suppliers | yes | post/pay | purchases/suppliers | partial | Working |
| Customers | yes | CRUD/collect | customers | partial | Working |
| Courier | yes | book/settle | courier | partial | Working |
| Accounts | yes | income/expense/dues | accounts | partial | Working; recon Partial |
| HR Employees | list | dialog CRUD | hr.* | none | Partial routes |
| Attendance/Leave | yes | manage | hr.attendance/leave | none | Working |
| Payroll | yes | create/calc/approve/pay | hr.payroll.* | none | Working; advances Partial |
| Commissions | list/pay | approve unwired | sales.commission.* | none | Partial |
| Commission settings | yes | upsert rules | manage | none | Working |
| Staff workspace | RPCs | follow-ups | staff.* | nav only | Partial orders/targets |
| Administration | users/roles/activity | invite/update | administration.* | shallow | Partial targets/perms |
| Reports hub | yes | — | reports.read | none | Working hub |
| Settings | yes | org settings/reset | settings.* | none | Working |

## Correction vs earlier “~4 Partial” claim
Earlier sidebar rollup undercounted **page-level** incompleteness. Correct Partial surface for V2.1 closure is the table above (~11 feature gaps), not 4 sidebar rows.

## Post-V2.1 status
P0/P1 gaps in the Partial table are closed except reconciliation **apply** (gated) and website/permissions P2 placeholders. See `v21-03-implemented-fixes.md` and `v21-10-production-readiness.md`.
