# HR + Administration Centralized SSOT — Implementation Report

**Company:** Code Bondhu IT  
**Application:** Glamorous Gallery By Mahi  
**Date:** 2026-11-18  
**Scope:** Commission clawback integrity, identity SSOT, branch authorization sync, payroll settlement alignment  
**Production deploy:** NOT performed (explicitly withheld)

---

## REPORT A — Executive Summary

### What was implemented

1. **Forward-only commission clawback fix** (migration `151`) restoring `sale_item_id`-first matching while preserving V4 fixed-rule skip, recoverable paid clawbacks, entitlement caps, and `FOR UPDATE`.
2. **Read-only over-reverse audit categories** (migration `152`) extending `audit_commission_discrepancies` — no historical rewrite.
3. **Branch-scoped commission summarize** (migration `153`) + HR commissions UI/list filters by `activeBranchId`.
4. **Admin user provisioning hardening** in `admin-create-user` (race-safe employee link + Auth compensation; branch grant revive; warnings).
5. **BranchSwitcher** no longer treats empty grants as “all branches”; clears revoked active branch; expands cache invalidation.
6. **Stores create UX** instructs admins to assign grants explicitly (no auto-grant-all).
7. **Admin user detail** refreshes session when editing the signed-in user after grant/role changes.

### What was preserved

- Existing commission engine, triggers, RPCs, UI/nav/theme.
- Policy 2A (fixed per-sale reverse only on full return).
- Exchange actor replacement accrual (migration 110 policy).
- Payroll allocation uniqueness and `include_commission_in_payroll`.
- `user_branch_access` as grant SSOT; `user_has_branch_access` as server gate.
- Historical commission amounts (no auto-repair / backfill).

### Critical defects fixed

| Defect | Fix |
|--------|-----|
| Migration 133 `profile_id` + `LIMIT 1` over-reverse on multi-line partial returns | Migration 151 line-aware reverse |
| Missing `event_type` on reverse | Restored `return_reverse` / `exchange_reverse` |
| Empty `branchIds` UI showed all branches | BranchSwitcher grant-strict filtering |
| Orphan Auth user on failed employee link | Compensating delete/deactivate |

### Remaining risks

- Historical commissions already over-reversed by 133 behavior are **listed** by audit RPC but **not repaired**.
- Paid recoverable balances have no dedicated recovery UI / automatic payroll offset (policy gate).
- Exchange `complete_product_exchange` still relies on historical DO-block patch for commission helpers (fragility if RPC fully rewritten).
- SQL smoke for 151/152/153 not executed against a live isolated DB in this session (schema/source invariants written; apply required).

### Overall release status

**CONDITIONALLY READY** — code and migrations are ready for controlled staging apply + SQL smoke proofs. Not production-ready until migrations 151–153 are applied on a non-prod DB, smoke tests pass, and historical discrepancy counts are reviewed.

---

## REPORT B — Current SSOT Architecture

| Domain | Authoritative source |
|--------|----------------------|
| Authentication | Supabase Auth users |
| Application identity | `profiles` |
| Employee HR record | `employees` (`profile_id` link; unique per org) |
| Roles | `roles` |
| Permissions | `permissions` + `role_permissions` + `user_has_permission` |
| Branches | `branches` (managed via `/stores`) |
| Branch grants | `user_branch_access` |
| Session grants | Auth bundle: `branchIds`, `permissions`, `activeBranchId` (UI only) |
| Commission rules | `salesman_commission_rules` |
| Commission ledger | `salesman_commissions` |
| Attribution gaps | `commission_attribution_exceptions` |
| Payroll inclusion | `employees.include_commission_in_payroll` + `payroll_commission_allocations` |
| Financial posting | Existing financial txn RPCs (pay path only; reverse uses recoverable) |

---

## REPORT C — Commission Lifecycle

| Event | Mechanism | Tables / notes |
|-------|-----------|----------------|
| Sale completed | Trigger `sales_completed_accrue_commission` → `_accrue_sale_commission` | Per-line `salesman_commissions` (`sale_item_id`) |
| Partial / full return | Trigger on `sale_returns` → `_reverse_sale_commissions` → `_apply_contributor_commission_reversals` (151) | Line match by `sale_item_id`; fixed skip unless full |
| Exchange complete | `_apply_exchange_commission_effects` | Reverse return lines + accrue replacement to actor |
| Exchange cancel | `_undo_exchange_commission_effects` | Undo reverse + replacement |
| Void / edit | `_reverse_remaining_sale_commissions` | Residual remaining entitlement |
| Approve / pay | `approve_sales_commission`, `pay_sales_commission` | Status + optional financial out |
| Paid clawback | `recoverable_amount` increment | No phantom cash credit |
| Payroll | `calculate_payroll_run` | Approved, unallocated only; unique alloc index |

---

## REPORT D — Administration Synchronization

| Operation | Path |
|-----------|------|
| Create user | Edge `admin-create-user` → Auth → `profiles` → link `employees.profile_id` → `user_branch_access` → audit |
| Update user / grants | RPC `update_admin_user` replace-set on `user_branch_access` |
| Session sync | `refreshProfile()` on self-edit; BranchSwitcher clears revoked `activeBranchId` |
| New branch | `/stores` insert into `branches` only; toast directs grant assignment in Administration |
| Roles / permissions | Existing admin pages + SQL permission checks; catalog remains contract |

**Security principle:** `activeBranchId` / localStorage is UI context only. Server RPCs use `user_has_branch_access`.

**`settings.manage`:** may list/operate across org branches via SQL helper; does not imply unrestricted financial bypass beyond existing permission keys.

---

## REPORT E — Database Changes

| Migration | Purpose | Rollback |
|-----------|---------|----------|
| `20260315000151_commission_line_reverse_restore.sql` | Restore line-aware reverse + keep V4 policies | Redeploy prior function body from 133 (not recommended without re-breaking clawback) |
| `20260315000152_commission_over_reverse_audit.sql` | Read-only discrepancy categories | Drop/replace audit function with 134 body |
| `20260315000153_commission_summarize_branch_filter.sql` | `p_branch_id` on summarize | Restore 5-arg summarize from 134 |

**Deployment requirements**

1. Apply 151 → 152 → 153 on staging only after backup (after accounts finalize `148`).
2. Run `supabase/tests/sql/commission_line_reverse_restore_smoke.sql` and existing V4 smoke.
3. Call `audit_commission_discrepancies` dry-run; review `over_reversed_commission` items.
4. Do **not** auto-backfill.

---

## REPORT F — Modified Files

### New

- `supabase/migrations/20260315000151_commission_line_reverse_restore.sql`
- `supabase/migrations/20260315000152_commission_over_reverse_audit.sql`
- `supabase/migrations/20260315000153_commission_summarize_branch_filter.sql`
- `supabase/tests/sql/commission_line_reverse_restore_smoke.sql`
- `docs/audits/hr-admin-centralized-ssot-implementation-report.md`

### Modified

- `supabase/functions/admin-create-user/index.ts`
- `src/components/layout/BranchSwitcher.tsx`
- `src/features/stores/StoresPage.tsx`
- `src/features/administration/pages/AdminUserDetailPage.tsx`
- `src/features/sales/repositories/commissions.repository.ts`
- `src/features/sales/pages/SalesCommissionsPage.tsx`

---

## REPORT G — ERP Integration Matrix

| Module | Integration | Verification |
|--------|-------------|--------------|
| POS | Accrue on complete; branch via `user_has_branch_access` | PASS (code path verified; live E2E NOT EXECUTED) |
| Sales | Line attribution + commission panel | PASS (code) |
| Returns | Clawback via trigger + line match (151) | PASS (SQL source + match invariant smoke); live DB BLOCKED |
| Exchanges | Reverse + replacement (110 helpers) | PASS (code); live NOT EXECUTED |
| Inventory | Branch grants / stock RPCs | PASS (existing gates; no contradictory rewrite) |
| HR | Eligibility + commissions pages branch filter | PASS |
| Payroll | Approved + unique allocations; recoverable not auto-deducted | PASS |
| Administration | Users/roles/grants + session refresh | PASS |
| Accounts | Recoverable obligation; no phantom reverse cash | PASS (policy preserved) |
| Reports | Summarize RPC server aggregates + optional branch | PASS |

---

## REPORT H — Automated Test Results

**Environment:** local workspace `/home/priom/Desktop/mahi`, Vitest v4.1.10  
**Commands:**

```bash
npx vitest run src/features/sales/__tests__/commission-rule-schema.test.ts \
  src/features/sales/components/sale-commission/__tests__/sale-commission-presentation.test.ts \
  src/features/hr/payroll/lib/payroll-calculator.test.ts \
  src/features/hr/payroll/lib/payslip.test.ts \
  src/features/administration/__tests__/invite-payload.test.ts

npx vitest run src/features/sales src/features/hr/payroll src/features/administration
```

| Suite | Result |
|-------|--------|
| Commission rule schema | PASS |
| Sale commission presentation | PASS |
| Payroll calculator / payslip | PASS |
| Admin invite payload | PASS |
| Broader sales + HR payroll + administration | PASS (39 tests) |
| `commission_engine_v4_smoke.sql` against live DB | NOT EXECUTED (no isolated DB apply in session) |
| `commission_line_reverse_restore_smoke.sql` against live DB | NOT EXECUTED (apply migrations first) |
| Production mutating E2E / payroll payout | NOT EXECUTED (policy) |

---

## REPORT I — Historical Data Integrity

- New categories in `audit_commission_discrepancies`:
  - `over_reversed_commission`
  - `paid_with_recoverable_balance`
  - `reversed_missing_event_type`
- `dry_run: true`, `repair_policy: read_only_no_auto_backfill`
- **No historical ledger rows were modified.**
- Separate authorized repair plan required after staging discrepancy review.

---

## REPORT J — Security & RBAC

- Frontend `PermissionGate` / `PermissionRoute` remain UX only.
- Server: `user_has_permission` + `user_has_branch_access` remain authoritative.
- BranchSwitcher no longer escalates empty grants to all-branch UI for non-`settings.manage` users.
- Admin create still requires `administration.users.create` (or Super Admin/Owner).
- Data reset untouched; not executed.

---

## REPORT K — Release Readiness

### Decision: CONDITIONALLY READY

**Why**

- Release-blocking clawback defect is corrected in forward migrations with preserved V4 policies.
- Identity/branch session gaps addressed without parallel systems.
- Unit tests PASS; DB smokes and live return/exchange/void proofs still required on staging after migrate.

**Blockers before production**

1. Apply migrations 151–153 on staging.
2. Run SQL smokes + at least one multi-line partial return proof.
3. Review `audit_commission_discrepancies` over-reverse count.
4. Explicit approval for any historical repair (separate plan).

---

## ChatGPT Decision Handoff

### A. Verified Implemented Features

- Line-aware commission reverse restore (151)
- Over-reverse read-only audit (152)
- Branch filter on commission summarize + HR list (153 + UI)
- Admin create-user compensation / grant hardening
- BranchSwitcher revoke fallback + grant-strict listing
- Stores create explicit-grant messaging
- Admin self-session refresh on grant update

### B. Final HR/Admin SSOT Architecture

Auth → profiles → employees; roles/permissions; branches + `user_branch_access`; commission ledger SSOT; payroll allocations unique; UI branch selection non-authoritative.

### C. Commission Bug Fix Evidence

Root cause: 133 matched `profile_id LIMIT 1` while callers still sent `sale_item_id`. Fix: 151 restores item-first match, keeps fixed-skip + recoverable + entitlement cap + event_type.

### D. Return/Exchange/Void/Correction Test Results

Unit/source invariants PASS. Live return/exchange/void DB proofs NOT EXECUTED pending staging migrate.

### E. Payroll and Settlement Integrity

Verified: only `approved` unallocated commissions enter payroll; unique `payroll_commission_allocations`; paid clawbacks use `recoverable_amount` without phantom cash. Recovery UI / auto-offset = remaining policy gate.

### F. Branch Access Synchronization

Explicit grants only; new branch not auto-granted; BranchSwitcher clears revoked selection; admin self-edit refreshes profile grants.

### G. Authentication & RBAC Results

Server permission + branch gates preserved; empty grant escalation removed from BranchSwitcher.

### H. Database Migration Requirements

Apply `151`, `152`, `153` in order on staging (after accounts `148`); run smokes; do not mutate production history.

### I. Remaining Defects or Blockers

- Historical over-reversals unrepaired
- Recoverable settlement UX missing
- Exchange RPC patch fragility
- Live SQL/E2E proofs pending

### J. Recommended Release Decision

**CONDITIONALLY READY** for controlled staging release; **NOT READY** for production until staging proofs and discrepancy review complete.

### K. Next Required Actions

1. Staging migrate 151–153  
2. Run commission SQL smokes + multi-line partial return fixture  
3. Dry-run `audit_commission_discrepancies` and triage  
4. Decide authorized historical repair (separate approval)  
5. Optional: recovery workflow for `recoverable_amount`  
6. Production only after explicit authorization  
