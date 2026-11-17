# REPORT 10 — Final Decision Package for ChatGPT / Implementation Planning

**Audit-only. Do not treat this as an implementation ticket already executed.**

## A. Current Architecture Facts (VERIFIED)

- App: React/Vite/TS + Supabase Postgres RPCs + RLS.  
- Accounts UI: `src/features/accounting/pages/simple/*` behind `src/app/routes/accounts.routes.tsx` (`accounts.read`).  
- Nav: long Accounts list in `AppSidebar.tsx` (~187–203).  
- Hybrid ledger: `financial_accounts.current_balance` + `financial_transactions` + journals + party ledgers/`current_due`.  
- FE contract: `simple-accounting.repository.ts` (income/expense/transfer/close/void/collect/pay/P&L/KPIs).  
- Collect/pay pages also mounted under sales/purchases routes (dual URLs).  
- Legacy accounting URLs already redirect (chart/journals/cashbook/…).  

## B. Existing Financial Source of Truth

| Concern | Source |
|---|---|
| Wallet balance | `financial_accounts.current_balance` |
| Cash-book | `financial_transactions` (`balance_after`) |
| AR/AP | `customers.current_due` / `suppliers.current_due` + `*_ledger` |
| Invoice allocation | `payment_allocations` + open sale/purchase due |
| Op income/expense | `income_entries` / `expense_entries` |
| COGS for Accounts P&L | `sale_items.cost_price * qty` |
| Revenue for Accounts P&L | `sales.grand_total` (completed) − `sale_returns` |
| Key RPCs | `create_income`, `create_expense`, `transfer_account_balance`, `close_business_day`, `void_financial_transaction`, `collect_customer_due`, `pay_supplier`, recon RPCs, POS/purchase complete RPCs |

## C. Accounts Routes — Current vs Target

| Current | Target role |
|---|---|
| `/accounts` | Accounts Management hub (enhance) |
| `/accounts/cash-bank` | Merge into hub / ledger |
| `/accounts/income`, `/expenses` | Internal actions/tabs |
| `/accounts/customer-due`, `/supplier-due` | Merge → `/accounts/dues` |
| `/accounts/collections`, `/supplier-payments` | Redirect to canonical sales/purchases or dues actions |
| `/accounts/transactions` | **KEEP** |
| `/accounts/profit-loss` | **KEEP** / deepen |
| `/accounts/daily-closing`, `/reconciliation`, `/settings` | Secondary from hub |
| Legacy Navigate routes | Keep |

Candidate targets: `/accounts`, `/accounts/transactions`, `/accounts/dues`, `/accounts/profit-loss`, optional `/accounts/accounts/:id/ledger`.

## D. Existing Reusable Components

- `src/features/accounting/components/AccountingUi.tsx` — `KpiCard`, `PageHeader`, `DateRangeInputs`, …  
- `CashBankPage`, `TransactionsPage`, due pages, `SimpleProfitLossPage`  
- `CollectDueDialog`, `DueCollectionPage`, `SupplierPaymentsPage`  
- `EntityCombobox`, `resolve-payment-account.ts`  
- `ReconciliationCenterPage` + hooks  
- Dashboard `CashFlowChart` (shell)  

## E. Financial Problems Requiring Attention

**Confirmed (code/SQL)**

- **P0:** POS sale FT with `apply_balance=false` + core no FA credit; void still debits FA.  
- **P1:** Deposit/withdraw → income/expense (P&L pollution).  
- **P1:** Daily close collection filter misses `customer_collection`.  
- Daily closing difference treats blank counted as 0.  
- Dual collect/pay URLs; `/sales/:id/collections` ignores id; closing permission mismatch.  
- No AR/AP aging; Accounts P&L thin; branch dashboard profit = collection−COGS ≠ org formula.  
- RLS can UPDATE FA `current_balance`.  
- Dual live vs demo reporting stacks for some “profit by product” UIs.  

**Unverified runtime**

- Magnitude of FA vs FT delta on production today.  
- Large-range P&L performance under load.  
- Current recon due deltas (historical gaps known from prior report).  

## F. Migration Dependencies (before UI polish)

1. **Fix POS FA apply_balance / void pairing (A2-000) before trusting Cash & Bank.**  
2. Decide deposit/withdraw accounting semantics.  
3. Fix close_business_day collection txn types.  
4. Agree overdue: need `due_date` or not for v1 dues hub.  
5. Align P&L definitions with dashboard/reports (and flag demo reporters).  
6. Do **not** rebuild posting engines merely for sidebar simplification.  

## G. Recommended Architecture

**UI façade over existing RPCs** + additive analytics/aging read models.  
Preserve transactions route.  
Redirect retired leaves.  
No parallel balance tables.  

## H. Database Migration Requirements

| Item | Class |
|---|---|
| Destructive GL rewrite | Unnecessary |
| Deposit/withdraw non-P&L movement | Recommended |
| `due_date` + aging RPC | Required only if overdue UI is in scope |
| P&L breakdown RPC | Recommended for Phase 4 |
| Recon apply for opening AR/AP/stock | Separate authorized ops task |

## I. Implementation Order

0. Fix deposit/withdraw + closing UX + FA reverse audit  
1. Contracts/tests/recon dry-run  
2. Accounts Management hub + sidebar slim  
3. Due Management tabs (+ aging if approved)  
4. P&L analytics  
5. Regression suite  
6. Redirect cutover / release  

## J. Acceptance Criteria (minimum)

- Deposit does not increase Other Income; withdraw does not increase Expenses.  
- Transfer is P&L-neutral and FA-sum neutral.  
- Collect due: FA↑, customer due↓, sales revenue unchanged.  
- Pay supplier: FA↓, supplier due↓, no new purchase OpEx.  
- Closing: no shortage shown before counted entered; close requires permission.  
- Transactions remain reachable.  
- Old `/accounts/*` bookmarks either work or redirect.  
- Branch filter scopes FA/P&L/dues consistently.  
- Permissions enforced in RPC (not only hidden buttons).  
- Mobile: hubs usable without unbroken horizontal page scroll.  

## K. Open Questions

1. Are pure deposits/withdrawals owner equity movements, or should they stay as income/expense categories by policy?  
2. Is overdue based on explicit invoice due dates, or days-since-invoice?  
3. How should shared (org-wide) expenses allocate across branch P&L?  
4. Should `/accounts/transactions` remain top-level after slim nav?  
5. Authorize production recon apply for historical opening AR/AP/stock?  

## L. Recommended Next Cursor Task (DO NOT EXECUTE HERE)

> **Phase 0 only (priority order):** (1) Fix POS sale payment FA credit vs void debit (`apply_balance` alignment) with recon test; (2) include `customer_collection` in `close_business_day` cash collection filters; (3) non-P&L deposit/withdraw or exclude from `getProfitLoss`; (4) Daily Closing blank-counted UI + `daily_closing.create` gate; (5) optional: restrict FA `current_balance` updates to DEFINER helpers. **No Accounts 2.0 hub UI yet.**

---

## Quality gates checklist

| Gate | Result |
|---|---|
| Accounts routes discovered | PASS |
| FE components inspected | PASS |
| Backend accounting traced | PASS |
| Financial tables identified | PASS |
| POS/Purchase/Inventory/Due/P&L examined | PASS |
| Branch scoping examined | PASS |
| UI reuse evaluated | PASS |
| Tests inventory reported (not executed) | PASS |
| Migration/rollback assessed | PASS |
| Proposed vs verified distinguished | PASS |
| App code / prod data modified | **NONE** (audit docs only) |
| Design image pixel audit | BLOCKED (images not in repo context) |
| Live prod balance sampling | BLOCKED (no authorized DB read this session) |
