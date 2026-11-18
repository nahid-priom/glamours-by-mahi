# Supplier Management 360 — Architecture Audit

**Date:** 2026-11-18  
**Decisions locked:** Financial repair **1B** (audited apply) · Details schema **2A** (profile cols + documents)

## Verified current state

| Area | Finding |
|------|---------|
| Feature surface | Thin CRUD: `SuppliersPage` table, `SupplierDetailPage` flat ledger, CSV import. No components/hooks folders. |
| Routes | `/suppliers/new`, `/:id/edit`, `/:id/ledger` are cosmetic (same pages, no behavior). |
| AP SSOT | `suppliers.current_due` via `supplier_ledger`; dual check vs `purchases.due_total`. |
| Stock provenance | Exists: `inventory_receipt_sources` → positions → allocations (FIFO). UI only on Inventory `view=suppliers`. |
| Profile fields | No credit limit, payment terms, contact person, VAT, documents. |
| Rating | `supplier_rating` on detail only. |

## Root causes (RC-*)

| ID | Symptom | Cause |
|----|---------|-------|
| RC-PAY-1 | Detail Paid KPI ≈ 0 | `listSupplierPayments` filters `entry_type = 'payment'`; live posts `supplier_payment` / `purchase_payment` |
| RC-PAY-2 | Payments page undercounts | Lists `purchase_payments`; party `pay_supplier` often skips that table |
| RC-PAY-3 | Purchase/opening KPI wrong | Sums `purchase_due` only; ignores `purchase_invoice` |
| RC-BAL-1 | Party ≠ Σ invoice due | Dual SSOT; advances/unallocated; A2-REG-002 (~−25,720) |
| RC-BAL-2 | Opening sign | Supplier opening backfill used **credit**; sync uses `sum(debit−credit)` |
| RC-BAL-3 | Partial idempotent pay | `pay_supplier` early-returns on FT alone; may skip ledger/alloc |
| RC-ORD-1 | Zigzag running balance | Same `occurred_at`; lists lack `id` tie-break |
| RC-RET-1 | Return asymmetry | `approve_purchase_return` bypasses `_post_supplier_ledger_entry` |

## Reuse map

- Money write: `complete_purchase`, `pay_supplier`, purchase returns
- Stock: `get_supplier_stock_*` + `SupplierStock*` components
- Dues: `/accounts/dues?tab=suppliers`, `/purchases/payments`
- Recon: `get_reconciliation_report` / Reconciliation Center

## Non-goals

- No second accounting system
- No fabricated stock/sales attribution
- No silent delete of posted financial rows
