# Supplier Management 360 — Implementation Summary

**Date:** 2026-11-18  
**Decisions:** Financial repair **1B** · Details schema **2A**

## What shipped

### Frontend (`src/features/suppliers/`)
- Premium **Supplier Directory** (`SuppliersPage`) — KPIs, filters, card/table views, URL `?due=1`, `/suppliers/new` opens create
- **Supplier Profile** (`SupplierProfilePage`) — shell + tabs `ledger | stock | details` via `?tab=`
- Redirects: `/:id/ledger` → `?tab=ledger`; `/:id/edit` → `?tab=details&edit=1`
- Ledger tab: statement KPIs, filters, expandable rows, CSV export
- Stock tab: provenance KPIs + product table + 30D velocity status (no invented sold totals)
- Details tab: profile fields, documents, purchases, derived activity
- `SupplierDetailPage` re-exports profile for lazy route compatibility

### Financial integrity
- Payment lists include `supplier_payment` / `purchase_payment` / `payment`
- Ledger order: `occurred_at DESC, id DESC`
- Purchases payment history reads `supplier_ledger` (not only `purchase_payments`)
- Migration `00154`: hardened `pay_supplier` idempotency, `approve_purchase_return` via `_post_supplier_ledger_entry`, `get_supplier_ledger_statement`, repair dry-run/apply RPCs
- Reconciliation Center: Supplier 360 dry-run + audited apply (accounts.manage)

### Schema / stock (`00155`)
- Nullable profile columns on `suppliers`
- `supplier_documents` + private `supplier-documents` storage bucket + RLS
- `get_supplier_directory_summary` / `get_supplier_directory_cards`
- `get_supplier_stock_velocity`
- Sale-return lot restore helper (residue → `unknown_legacy`)

## Routes (final)

| Path | Behavior |
|------|----------|
| `/suppliers` | Directory 360 |
| `/suppliers/import` | CSV import |
| `/suppliers/new` | Directory + create dialog |
| `/suppliers/:id?tab=` | Profile shell |
| `/suppliers/:id/ledger` | Redirect → tab=ledger |
| `/suppliers/:id/edit` | Redirect → tab=details&edit=1 |
| `/purchases/payments` | Pay hub (unchanged entry) |
| `/accounts/dues?tab=suppliers` | Due hub |

## Production readiness

- **Requires Migration** — apply `00154` + `00155`
- **Requires Data Repair apply** — run Supplier 360 dry-run then opening-sign / party-sync apply in Reconciliation Center
- Historical stock `unknown_legacy` remains explicit where provenance cannot be proven
