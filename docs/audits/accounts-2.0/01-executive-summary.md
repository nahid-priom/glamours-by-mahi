# REPORT 1 — Executive Audit Summary

**Project:** Glamorous Gallery By Mahi  
**Audit:** Accounts Management 2.0 — read-only  
**Date:** 2026-11-18  
**Mode:** No application code, schema, or production data modified  

## Recommendation

**CONDITIONALLY READY** for a UI-first Accounts Management 2.0 migration that **reuses existing RPCs/tables**, but **not ready to trust Cash & Bank / daily close figures** until Phase 0 fixes the **verified POS FA non-credit + void debit** defect and closing collection-type mismatch. Deposit/withdraw P&L pollution and aging/P&L drill-downs follow after that.

## Current system health

| Area | Assessment | Confidence |
|---|---|---|
| Cash/bank operational posting (income, expense, transfer, void) | Working via Supabase RPCs | VERIFIED |
| Customer collect / supplier pay | Working; FIFO allocation exists | VERIFIED |
| Party due balances (`customers.current_due` / `suppliers.current_due`) | Authoritative party SSOT with ledger helpers | VERIFIED |
| Financial account balances | Stored `financial_accounts.current_balance` updated under row lock in `_adjust_financial_account_balance` / `_post_financial_txn` | VERIFIED |
| Journals | Present (`_post_journal`); hybrid with cash-book FT | VERIFIED |
| Accounts UI | “Simple retail accounting” pages under `/accounts/*` | VERIFIED |
| Deposit/Withdraw UX | Implemented as `create_income` / `create_expense` → pollutes P&L | VERIFIED (defect) |
| Due aging / overdue buckets | Not implemented for AR/AP | VERIFIED gap |
| Product / invoice / branch P&L drill-down on Accounts P&L | Not on `SimpleProfitLossPage`; limited report at `/reports/profit` | VERIFIED gap |
| Historical recon gaps | Documented opening AR/AP/stock exceptions in prior unified-core report | VERIFIED (prior evidence) |

## Accounting architecture (one paragraph)

The ERP uses a **hybrid** model: a **cash-book** of `financial_transactions` that updates `financial_accounts.current_balance`, optional **double-entry journals**, and **party ledgers** (`customer_ledger` / `supplier_ledger`) that maintain `current_due`. Sales/purchases post through hardened RPCs (`complete_pos_sale`, `complete_purchase`, `collect_customer_due`, `pay_supplier`) with `client_txn_key` idempotency. Simple Accounts UI is a thin React Query layer over these RPCs and direct table reads (`simple-accounting.repository.ts`).

## Accounts migration readiness

| Target page | Readiness | Notes |
|---|---|---|
| Accounts Management | **High** | CashBank + Transactions + Income/Expense + Settings already cover most capabilities; need ledger detail route UX and deposit/withdraw semantics |
| Due Management | **Medium** | Lists + collect/pay exist; **no aging/due-date/overdue** model; dual routes for collect/pay |
| Profit & Loss | **Medium–Low** | Summary KPIs exist client-side; missing product/variant/invoice/branch analytics UI and shared COGS contract with dashboard |

## Critical problems (must address or consciously accept)

1. **P0 — POS sale cash does not credit FA** while FT is written with `apply_balance=false`; void/edit still decrements FA (`_complete_pos_sale_core` + wrappers). Cash & Bank understates sale receipts.  
2. **P1 — Deposit/Withdraw as Income/Expense** (`CashBankPage.tsx` → `createIncome` / `createExpense`) misstates P&L vs pure money movement.  
3. **P1 — Daily closing collection type filter** looks for `customer_due_collection|due_collection|collection` but collect RPC posts `customer_collection` → cash_collections undercount.  
4. **P2 — Daily Closing difference KPI** treats empty counted cash as `0` (`DailyClosingPage.tsx`).  
5. **P2 — Dual collect/pay URLs** and `/sales/:id/collections` unused param.  
6. **P2 — No AR/AP aging**; Accounts P&L lacks product/invoice drill-down; branch dashboard profit uses `collection − COGS` vs org `sales − COGS − expenses`.  
7. **P2 — RLS allows authenticated UPDATE of `financial_accounts.current_balance`** for some manage/post roles (policy risk vs app “don’t patch balance” comment).

## Verified working capabilities

- Financial account CRUD + branch/org-wide accounts  
- Transfer between accounts (`transfer_account_balance`)  
- Income / expense posting with categories  
- Transaction list with `balance_after`  
- Customer due list + collection RPC  
- Supplier due list + pay RPC + FIFO allocations (SQL)  
- Daily closing RPC (`close_business_day`)  
- Reconciliation center (dry-run / report RPCs)  
- Account settings blob on `organizations.settings`  
- Permission catalog + parent route gate `accounts.read`  
- Legacy redirects already present for chart/journals/cashbook aliases  

## Major technical dependencies

- Supabase Postgres RPCs + RLS  
- `simple-accounting.repository.ts` as primary FE contract  
- `resolve-payment-account.ts` for method → FA mapping  
- Party finance cache invalidation (`party-finance-cache.ts`)  
- WAC / `sale_items.cost_price` for COGS  
- Active branch from `auth-session`  

## Database migration requirement

| Change | Necessity |
|---|---|
| New money-movement types (deposit/withdraw/owner draw) or source flags excluding from P&L | **Recommended (optional schema / RPC)** if deposit/withdraw remain UX actions |
| Invoice `due_date` + aging RPC/view | **Required** for Due Management overdue design |
| Product/branch P&L RPC or materialized report | **Optional** (can start aggregating from existing sale lines) |
| Destructive rewrite of historical FT/journals | **Not required / not recommended** |

## UI refactor requirement

**Additive UI consolidation**, not a rewrite of posting engines:

1. Collapse sidebar to Accounts Management / Due Management / Profit & Loss.  
2. Keep Transactions as primary or nested surface.  
3. Relocate Daily Closing, Reconciliation, Settings as secondary actions/tabs.  
4. Preserve deep links via redirects (pattern already used in `accounts.routes.tsx`).

## Estimated risk level

**Medium–High** if deposit/withdraw + sale FA reverse issues are ignored; **Medium** if Phase 0 fixes those and UI is a façade over existing RPCs.

## Recommended migration approach

**Strategy A (preferred): Façade + compatibility redirects**  
Build three hub pages that compose existing repositories/RPCs; keep `/accounts/transactions` live; redirect retired sidebar items; fix deposit/withdraw semantics first.

**Strategy B (heavier): New accounting read models**  
Introduce aging + P&L analytics RPCs first, then UI. Safer for Due/P&L analytics depth, longer before user-visible Accounts Management polish.

---

*Evidence bases: `src/app/routes/accounts.routes.tsx`, `src/components/layout/AppSidebar.tsx`, `src/features/accounting/**`, `src/lib/permissions/catalog.ts`, migrations `00011`, `00031`, `00033`, `00065`, `00066`, `docs/unified-core-implementation-report.md`.*
