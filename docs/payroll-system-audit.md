# Payroll System Audit — Glamorous Gallery By Mahi ERP

**Audit date:** 2026-07-25  
**Scope:** HR Payroll module, database, accounting integration, permissions

---

## 1. Existing routes and components

| Route | Component | Status |
|-------|-----------|--------|
| `/hr/payroll` | `PayrollPage` (list + KPIs) | Read-only list; KPI/list bug |
| `/hr/payroll/:id` | `PayrollRunDetail` (inline in PayrollPage) | Basic detail view |
| `/reports/hr` | Redirect → `/hr/payroll` | OK |

**Missing routes (required):**
- `/hr/payroll/new`
- `/hr/payroll/:id/review`
- `/hr/payroll/:id/payments`
- `/hr/payroll/salary-structures`
- `/hr/payroll/advances`
- `/hr/payroll/reports`
- `/hr/payslips/:payrollItemId`

**Legacy (not wired):**
- `src/features/erp/ErpRoutes.tsx` → `HrPayrollPage` (IndexedDB)
- `src/services/payroll.service.ts` (deprecated)

---

## 2. Existing database tables and columns

### Core (migration `017`)
- **`payroll_runs`** — period, status, totals, `journal_entry_id`, soft delete
- **`payroll_items`** — per-employee lines, `breakdown` jsonb

### Commission bridge (migration `068`)
- **`payroll_commission_allocations`** — links `salesman_commissions` → payroll
- **`payroll_items.commission_amount`**, `commission_adjustment`
- **`employees.commission_*`** fields

### Employee salary source
- **`employees.basic_salary`**, `allowances` jsonb, `salary_type` (`monthly|daily|hourly`)

### Attendance inputs
- **`attendance_records`** — daily summary with `is_approved`, late/overtime minutes
- **`attendance_raw_logs`** — device punches (not for direct payroll calc)

### Leave inputs
- **`leave_requests`** — approved leave affects payroll

### Missing tables (required by spec)
- `salary_structures`, `salary_structure_components`
- `payroll_item_earnings`, `payroll_item_deductions`
- `payroll_adjustments`, `payroll_payments`, `payroll_payment_allocations`
- `payroll_approval_logs`
- `employee_advances`, `employee_loans`, `loan_installments`

---

## 3. Current payroll lifecycle

```
draft → calculated → approved → paid | cancelled
```

**Gaps vs required lifecycle:**
- No `reviewed`, `payment_pending`, `partially_paid`, `closed`
- No `reversed`, `recalculation_required`
- No server-side status transition validation
- No RPCs — all reads are direct table queries
- No write operations from production UI

---

## 4. Attendance-to-payroll integration

| Layer | Exists | Used in payroll |
|-------|--------|-----------------|
| Raw device logs | Yes | No (correct) |
| Daily attendance records | Yes | **Not wired** |
| Finalized attendance summary | Partial (`is_approved` flag) | **Not wired** |
| Payroll calculation snapshot | `breakdown` jsonb only | Demo seed manual |

Demo seed inserts static `payroll_items` without reading attendance.

---

## 5. Accounting integration

| Capability | Status |
|------------|--------|
| `journal_entry_id` on `payroll_runs` | Column exists, never populated |
| `_post_journal` helper | Available (migration `031`) |
| Salary expense category | `expense_categories` seed includes "Salary" |
| Chart account `salary_expense` / `salary_payable` | **Missing** system roles |
| Financial transactions on pay | **Not implemented** |
| Idempotent posting | Pattern exists in purchase/sale RPCs |

---

## 6. RLS and permissions

### RLS
- `payroll_runs_org_all` — org scope + soft delete
- `payroll_items_org_all` — org scope + soft delete
- `payroll_commission_allocations_org_all` — org scope

**Gap:** No branch-level RLS; branch filtering is client-side only.

### Permissions (migration `016`)
| Permission | Seeded |
|------------|--------|
| `hr.payroll.read` | Yes |
| `hr.payroll.create` | Yes |
| `hr.payroll.approve` | Yes |
| `hr.payroll.pay` | Yes |

**Missing:** `calculate`, `review`, `reverse`, `export`, `salary_structure.manage`, `employee_advance.manage`

**Route guard:** `PermissionRoute module="hr"` only — any HR permission grants payroll access.

**Page guard:** No `PermissionGate` on payroll actions (page is read-only).

---

## 7. Duplicate or conflicting logic

| Issue | Location |
|-------|----------|
| Legacy IndexedDB payroll | `payroll.service.ts`, `ErpRoutes.tsx` |
| KPI vs list filter mismatch | `PayrollPage.tsx` + `payroll.repository.ts` |
| `payrollStats` key has no filters | `queryKeys.payrollStats` |
| List filters by `activeBranchId` | Excludes org-wide runs (`branch_id IS NULL`) |
| `database.ts` stale | Missing migration `068` types |

---

## 8. Missing business rules

- Pay period overlap prevention
- Maker-checker (calculator ≠ approver)
- Attendance incomplete → block approval
- Immutable approved payroll
- Partial payment tracking
- Advance/loan recovery
- Commission single-inclusion
- Idempotent calculate/approve/pay
- Negative net salary policy
- Effective-dated salary structures

---

## 9. Data integrity risks

1. **KPI/list inconsistency** — confirmed production bug (see §10)
2. Direct client writes would bypass validation (no RPCs today)
3. No unique constraint on active period per employee
4. `payroll_items` totals not validated against run totals
5. Approved runs can be soft-deleted without reversal
6. Float risk mitigated (numeric types) but JS aggregation in stats uses `Number()`

---

## 10. Root cause — KPI shows data, list empty

**Confirmed root cause:**

Demo/production payroll runs use **`branch_id = NULL`** (organization-wide scope).  
The list query applies:

```typescript
if (filters.branchId) builder = builder.eq('branch_id', filters.branchId)
```

In PostgreSQL, `NULL = <uuid>` is never true, so org-wide runs are excluded when a branch is selected.

The KPI query (`getPayrollStats`) has **no branch filter**, so it counts all runs including `branch_id IS NULL`.

**Fix:** Unified filter contract — when filtering by branch, include org-wide runs:  
`branch_id = X OR branch_id IS NULL`. Pass identical filters to KPI and list queries.

---

## 11. Implementation plan

### Phase A — Bug fix & query contract (immediate)
- [x] Unify `PayrollFilters` for list + stats
- [x] Fix branch NULL handling
- [x] Scope `payrollStats` query key to filters
- [x] Separate loading/error/empty UI states

### Phase B — Schema migration `070`
- Extend `payroll_runs` / `payroll_items` columns and statuses
- Add supporting tables (structures, earnings, deductions, payments, advances, loans)
- Add chart account roles `salary_expense`, `salary_payable`
- Add permissions

### Phase C — RPCs
- `get_payroll_dashboard_summary`
- `create_payroll_run`
- `calculate_payroll_run`
- `approve_payroll_run` / `reject_payroll_run`
- `pay_payroll_items`
- `get_payroll_run_details`

### Phase D — Frontend module
- Refactor into `src/features/hr/payroll/`
- List page with full KPI grid + filters
- Detail page with tabs + actions
- New payroll wizard
- Payslip print view
- Mutation hooks + cache invalidation

### Phase E — Tests & verification
- Filter consistency tests
- Calculation unit tests
- RPC idempotency tests
- Typecheck + build

---

## 12. Files to modify

| File | Change |
|------|--------|
| `src/features/hr/repositories/payroll.repository.ts` | Unified filters, RPC calls |
| `src/features/hr/pages/PayrollPage.tsx` | Refactor / replace |
| `src/lib/query/keys.ts` | Filter-scoped stats key |
| `src/app/routes/hr.routes.tsx` | New payroll routes |
| `src/app/routes/lazy.tsx` | Lazy imports |
| `src/lib/permissions/catalog.ts` | New permissions |
| `supabase/migrations/20260315000070_payroll_system_complete.sql` | New |
| `docs/payroll-system-audit.md` | This document |

---

## 13. Regression risks

- Branch managers seeing org-wide payroll (intentional for NULL branch runs)
- Status enum extension breaking existing seed data (mitigated: old values preserved)
- Commission double-count if allocation logic regresses
- Journal imbalance if chart accounts missing (RPC must fail fast)

---

## 14. Commands for verification

```bash
npm run typecheck
npm run test
npm run build
```
