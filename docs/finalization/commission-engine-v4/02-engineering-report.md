# Enterprise Sales & Commission Engine V4.0 — Engineering Report

## Audit

| Gap | Resolution |
|---|---|
| `void_sale` skipped commission reverse | Calls `_reverse_remaining_sale_commissions` |
| `edit_sale` accrued replacement without reversing original | Residual reverse before `complete_pos_sale` |
| Dual accrue (`trigger` + `complete_pos_sale`) | Wrapper accrue removed; trigger is sole auto path |
| Fixed rule proportional reverse on partial return | Skip reverse when fixed per-sale + partial |
| Paid reverse phantom cash | `recoverable_amount` obligation; no bank credit on reverse alone |
| Unresolved POS subject | `commission_attribution_exceptions` row; never auto-cashier |
| Sale Details no commission panel | `SaleCommissionPanel` + `get_sale_commission_audit` |
| HR KPIs page-scoped | `summarize_sales_commissions` full filtered totals |
| Soft-delete UI claimed financial reverse | Copy gated to Void/Correct |

## Architecture

- **Accrual authority:** `sales_completed_accrue_commission` trigger → `_accrue_sale_commission`.
- **Reversal authority:** `_reverse_sale_commissions` / `_apply_contributor_commission_reversals` + residual helper `_reverse_remaining_sale_commissions` for void/edit.
- **Settlement:** paid over-reversal → recoverable obligation; offset-against-future preferred when COA mapping incomplete.
- **Attribution:** existing contributor/line model; exceptions table for unresolved subjects; employee preferred when profile+employee same person.

## Migrations

| File | Purpose |
|---|---|
| `20260315000133_commission_engine_v4_integrity.sql` | residual reverse, void/edit patches, dedupe accrue, fixed skip, recoverable, exceptions, identity dedupe |
| `20260315000134_commission_engine_v4_audit_rpcs.sql` | `get_sale_commission_audit`, `summarize_sales_commissions`, `audit_commission_discrepancies` |

## Frontend

- Sale detail (live): `SaleCommissionPanel` summary / contributors / timeline / exceptions.
- HR `/hr/commissions`: filtered KPI strip from summarize RPC (pending/approved/paid/reversed/net/recoverable/exceptions).
- Void/edit/delete copy aligned with real financial behavior.
- Cache invalidation includes `sale-commission-audit` and `sales-commissions-summary` on sale completion and commission mutations.

## Invariants

1. Residual reverse never over-reverses (`original − already reversed`).
2. Fixed per-sale commission reverses only on full return or void/edit residual path.
3. Replacement sale after edit accrues once via completed trigger.
4. Paid reverse does not post Cash/Bank receipt without a real recovery payment.
5. Soft delete does not claim commission reverse.

## Policies (locked)

- Fixed = full return / void only (2A).
- % / amount-tier = residual recalc from remaining base under original snapshot.
- Period-volume = signed period adjustments; no paid history rewrite.
- Unresolved subject = allow sale + exception (never auto-cashier).
- Historical repair = dry-run report only.

## Tests

| Suite | Coverage |
|---|---|
| `supabase/tests/sql/commission_engine_v4_smoke.sql` | schema + RPC presence + fixed detector |
| Vitest `sale-commission-presentation.test.ts` | labels / timeline |
| Existing `employee_commission_reconciliation.sql` | keep runnable where env allows |

Authenticated E2E void/edit commission proof: **skipped** unless QA env with migrations applied.

## Reconciliation

- Dry-run RPC shipped; staging apply notes in `01-staging-reconciliation-notes.md`.
- No automatic production backfill.

## Verdict

**Staging-ready / not Production Ready** until:

1. Migrations 133–134 applied on target DB.
2. SQL smoke + at least one void residual and edit double-accrual proof executed against that DB.
3. Dry-run discrepancy count reviewed (and staging repair validated if exposure > 0).

Without those proofs, do not declare Production Ready.
