# Accounts & Finance 2.0 — Post-Migration End-to-End Audit & Regression Report

**Project:** Glamorous Gallery By Mahi  
**Company:** Code Bondhu IT  
**Audit mode:** READ-ONLY verification (no application code changes; no mutating financial fixtures)  
**Audit date:** 2026-11-18  
**Repo HEAD:** `ec15f40` on `main` (Accounts 2.0 changes present as **uncommitted** working-tree deltas)  
**Linked DB (read-only probe):** Supabase project `vahqinuminrcjpussimn` via `TEST_DATABASE_URL` (TCP + `BEGIN READ ONLY`)  

---

## REPORT A — Executive Summary

| Area | Status | Evidence basis |
|---|---|---|
| Migration verification | **APPLIED** on linked DB (`00146`, `00147` in `supabase_migrations.schema_migrations`) | Read-only SQL |
| Overall system health | **CONDITIONAL** | Build/typecheck/unit PASS; live UI/runtime ERP mutation tests BLOCKED |
| Navigation | **PASS (code)** | Sidebar 3 primaries; routes + redirects registered |
| Ledger integrity | **MOSTLY PASS (static + RPC defs)** | No second balance table in FE; deposit RPC FT-only; POS `apply_balance=true` live |
| ERP integration | **TRACE PASS / RUNTIME BLOCKED** | Code paths reuse existing RPCs; no disposable mutating run |
| P&L accuracy | **CONDITIONAL** | Snapshot COGS design correct; live chart/UI BLOCKED; report RPC present |
| Security | **CONDITIONAL (static)** | Permission gates + DEFINER `_auth_ctx`; role matrix runtime NOT RUN |
| Responsive UI | **BLOCKED** | Dev server not running (`localhost:5173` chrome-error) |
| Release recommendation | **CONDITIONALLY READY** | See Report L |

**Primary answer:** Accounts 2.0 is **architecturally connected** to the existing hybrid ledger (FA / FT / party dues / income-expense entries / sale_items COGS) and migrations **are applied** on the linked database. It is **not fully proven production-ready** because (1) end-to-end mutating workflows and browser UI were not executed in a confirmed disposable session, (2) hub cash KPIs can undercount when >200 period transactions exist, and (3) party `current_due` vs open invoice `due_total` aggregates diverge and are shown without reconciliation explanation.

---

## Discovery snapshot (Phase 1)

### Git / working tree

- Branch: `main` @ `ec15f40`
- Accounts 2.0 implementation is **not committed**; modified/untracked includes:
  - Routes / sidebar / breadcrumbs / permissions catalog
  - Accounting pages + `simple-accounting.repository.ts`
  - `src/features/accounting/lib/*` (commands/queries/cash-flow metrics/tests)
  - `DueManagementPage.tsx`
  - Migrations `20260315000146_*`, `20260315000147_*`
  - `docs/audits/accounts-2.0/*`
  - Dashboard fallback COGS fix in `dashboard.repository.ts`

### Database migration status (verified)

| Version | Present in DB |
|---|---|
| `20260315000146` | Yes |
| `20260315000147` | Yes |

Live functions present: `post_account_cash_movement`, `get_party_due_aging`, `get_profit_loss_report`, `complete_pos_sale`, `close_business_day`, `collect_customer_due`, `pay_supplier`, `create_income`, `create_expense`, `transfer_account_balance`, `void_sale`.

`sales.due_date` / `purchases.due_date` columns exist.

### Local stack

- Local Supabase (`127.0.0.1:54322`): **down** (`ECONNREFUSED`)
- Vite/dev UI: **not running** (browser navigate → chrome-error)
- `npm run db:push` previously succeeded in an earlier terminal session (exit 0)

---

## REPORT B — Route Verification

### Primary sidebar (`AppSidebar.tsx` ~182–198)

1. Accounts Management → `/accounts`
2. Due Management → `/accounts/dues`
3. Profit & Loss → `/accounts/profit-loss`

### Registered accounts routes (`accounts.routes.tsx`)

| Path | Element | Notes |
|---|---|---|
| `/accounts` | AccountsDashboardPage | Hub |
| `/accounts/dues` | DueManagementPage | New |
| `/accounts/cash-bank` | CashBankPage | Hub secondary |
| `/accounts/income` | IncomePage | Hub quick action |
| `/accounts/expenses` | ExpensesPage | Hub quick action |
| `/accounts/transactions` | TransactionsPage | First-class + hub |
| `/accounts/daily-closing` | DailyClosingPage | Hub secondary |
| `/accounts/reconciliation` | ReconciliationCenterPage | Hub secondary |
| `/accounts/settings` | AccountSettingsPage | Hub secondary |
| `/accounts/profit-loss` | ProfitLossPage | Primary |
| `/accounts/customer-due` | Redirect → dues?tab=customers | Legacy |
| `/accounts/supplier-due` | Redirect → dues?tab=suppliers | Legacy |
| `/accounts/collections` | RedirectPreserveQuery → `/sales/collections` | Legacy |
| `/accounts/supplier-payments` | RedirectPreserveQuery → `/purchases/payments` | Legacy |
| Older GL aliases | Navigate to settings/transactions/P&L/cash-bank | No loops found in registration |

**Permission wrapper:** parent `PermissionRoute permission="accounts.read"`.

**Duplicate registration:** none found for the three primary paths.

**Runtime deep-link / back-forward / mobile nav:** **BLOCKED** (no live app).

---

## REPORT C — Accounts Management Tests

### UI structure (code inspection) — `SimpleAccountsDashboardPage.tsx`

| Expected | Result | Evidence |
|---|---|---|
| Header | PASS | “Accounts Management” |
| Branch selector | PASS (layout) | `TopHeader` / `MobileTopBar` `BranchSwitcher` — not duplicated on page |
| Date range | PASS | `DateRangeInputs` + period KPIs |
| Total Balance | PASS | `totalAccountBalance(listFinancialAccounts)` → FA `current_balance` |
| Money In / Out / Transfer / Net Cash Flow | PASS (logic) / **RISK** | `summarizePeriodCashFlow` on `listTransactions` **limit 200** |
| My Accounts | PASS | Active FA list → `/accounts/transactions?accountId=` |
| Quick Actions | PASS | Income/Expense/Transfer/Deposit/Withdraw/Collect/Pay links |
| Recent + View All | PASS | Recent list + `/accounts/transactions` |
| Secondary Daily Closing / Recon / Settings | PASS | Text links on hub |

### Operation traces (UI → RPC) — code verified, runtime mutating **BLOCKED**

| # | Action | Path | Authoritative RPC / write | Classification |
|---|---|---|---|---|
| 1 | Add Account | Cash & Bank | `createAlignedFinancialAccount` | Trace PASS |
| 2 | Edit Account | Settings enable/disable mainly | `setAccountActive` | **GAP:** no full rename/edit on hub (P3) |
| 3 | Select / ledger | Hub → Transactions `accountId` | FT reads | Trace PASS |
| 4 | Other Income | `/accounts/income` | `create_income` + `client_txn_key` | Trace PASS |
| 5 | Expense | `/accounts/expenses` | `create_expense` + `client_txn_key` | Trace PASS |
| 6 | Transfer | Cash & Bank | `transfer_account_balance` | Trace PASS — excluded from Money In/Out |
| 7 | Deposit | Cash & Bank → `postCashMovement` | `post_account_cash_movement` FT `cash_deposit` | Trace PASS — **not** income_entries (DB def verified) |
| 8 | Withdraw | same | FT `cash_withdrawal` | Trace PASS — **not** expense_entries |
| 9 | Collect Due | `/accounts/dues` | `collect_customer_due` | Trace PASS |
| 10 | Pay Supplier | `/accounts/dues` | `pay_supplier` | Trace PASS |

### Money classification (critical)

| Rule | Verified behavior |
|---|---|
| Deposit ≠ P&L income | Live `post_account_cash_movement` def: `_post_financial_txn`, no `income_entries` / `expense_entries` |
| Withdraw ≠ P&L expense | Same |
| Transfers excluded from Money In/Out | `cash-flow-metrics.ts` skips transfer categories |
| Collections ≠ sales revenue | Uses `collect_customer_due` (not sale complete) — static |
| Supplier pay ≠ purchase expense | Uses `pay_supplier` — static |

**FT counts on linked DB:** `cash_deposit=0`, `cash_withdrawal=0` (feature unused in live data yet — runtime deposit regression **NOT RUN** against fixtures).

### Confirmed application defect

**A2-REG-001 (P2) — Hub period cash KPIs truncated**

- **Current:** hub loads `listTransactions({ limit: 200 })` then aggregates Money In/Out/Transfer/Net Cash Flow.
- **Expected:** period totals over all in-scope movements (or server aggregate).
- **Impact:** busy months understate cash KPIs without error.
- **Evidence:** `SimpleAccountsDashboardPage.tsx` (~55–63); `listTransactions` default/limit in repository (~396–410).
- **Fix (approval required):** server-side period aggregate RPC/view, or paginated sum; do not silently truncate.

---

## REPORT D — Due Management Tests

### Implementation

- Page: `DueManagementPage.tsx` at `/accounts/dues`
- Tabs: Customers / Suppliers
- Party list SSOT: `customers.current_due` / `suppliers.current_due` via `listCustomerDues` / `listSupplierDues`
- Collect/Pay: same repo RPCs + payment account resolution as legacy due pages
- Aging: `getPartyDueAging` with honest fallback (`dueDateSupported: false` → undated = total, overdue = 0)

### Overdue / due dates

| Check | Result |
|---|---|
| `due_date` columns exist | PASS (DB) |
| Any sales with due_date set | **0** (DB snapshot) |
| Fabricated overdue from sale date | **Not present** in aging RPC (filters on `due_date`) |
| UI “Due Date Not Set” | PASS (code) |
| Invoice-level list / partial invoice allocation UI on dues hub | **NOT IMPLEMENTED** (party-level only) |

### Read-only reconciliation snapshot (linked DB)

| Metric | Value |
|---|---|
| Customer `current_due` sum | **113,517.00** |
| Open completed sales `due_total` sum | **102,267.00** (all undated) |
| Gap (customer) | **+11,250.00** party > invoices |
| Supplier `current_due` sum | **112,279.00** |
| Open completed purchases `due_total` sum | **137,999.00** |
| Gap (supplier) | **−25,720.00** party < invoices |

**Classification:**

- **A2-REG-002 (P2 / Needs Investigation):** KPI panel mixes party `current_due` totals with invoice aging buckets. Gaps are consistent with opening balances / adjustments / credits / status filters, but the UI does not explain divergence. **Not rewritten.** Treat as reconciliation risk until opening-balance policy is documented in UI.
- Outstanding invoices UI, payment history, allocation detail on this page: **NOT PRESENT** (users redirected to sales/purchases full flows for history) — **P2 product gap vs audit checklist**, not a silent false overdue.

Aging RPC as DB role without app auth: returns `Unauthorized` — expected (`_auth_ctx`).

---

## REPORT E — Profit & Loss Tests

### UI (`SimpleProfitLossPage.tsx`)

Tabs: Overview, Branch Wise, Product Wise, Sale Wise, Overall P&L.  
KPIs: Net sales, COGS, Gross profit, **Gross margin**, Other income, Expenses, Net profit, **Net profit margin**.  
Chart: `CashFlowChart` fed by report `trend` (not demo peekDatabase).

### Formula (code + RPC design)

- Gross Profit = Net Sales − COGS (`sale_items.cost_price` snapshots)
- Gross Margin % = Gross / Net Sales
- Net Profit = Gross + Other Income − Expenses (`income_entries` / `expense_entries` only → deposits/withdrawals excluded by construction)
- Net Margin % = Net / Net Sales

Fallback if RPC missing: base `getProfitLoss` + empty breakdowns (fail closed vs sales−expenses).

Dashboard client fallback now uses `getProfitLoss` for profitToday (**PASS** vs prior sales−expenses risk) — `dashboard.repository.ts` ~374–390.

### Runtime P&L correctness / chart rendering

**BLOCKED** (no authenticated UI; no disposable fixture run of `get_profit_loss_report` under JWT).

### Trend cap

SQL report trend uses `generate_series` capped (~62 days) — long ranges may truncate chart (**P3** documentation risk).

---

## REPORT F — Cross-Module ERP Integration

| Workflow | Authoritative path (static) | Runtime test |
|---|---|---|
| POS cash/bank/mobile/credit/split | `complete_pos_sale` → FA/FT/party/journals/inventory | **BLOCKED** mutating |
| Sale void | `void_sale` + `_void_sale_financial_transactions` | **BLOCKED** |
| Sale return | Existing return RPCs | **BLOCKED** |
| Purchase cash/credit/pay/return | Existing purchase + `pay_supplier` | **BLOCKED** |
| Inventory receive/adjust/transfer | Inventory module (not reimplemented) | **NOT RUN** |
| Dashboard KPI refresh | Query invalidation helpers + dashboard repo | Static PASS; runtime **NOT RUN** |
| Reports module | Separate report pages; dues/P&L hubs do not use `reporting.service` peek | Static PASS |

### Live POS FA integrity (definition-level)

`complete_pos_sale(jsonb)` live body posts `'sale_payment'` via `_post_financial_txn(..., true)` — **apply_balance=true VERIFIED** on linked DB.

`close_business_day` live body includes `'customer_collection'` — **VERIFIED**.

---

## REPORT G — Financial Integrity & Reconciliation

### Source-of-truth matrix

| Metric | Authoritative source | UI consumers |
|---|---|---|
| Account balance | `financial_accounts.current_balance` | Hub, Cash & Bank, Settings |
| Cash movements | `financial_transactions` | Transactions, hub recent/KPIs |
| Other income / opex | `income_entries` / `expense_entries` | Income/Expense pages, P&L |
| Non-P&L deposit/withdraw | FT `cash_deposit` / `cash_withdrawal` | Cash & Bank |
| Customer due (party) | `customers.current_due` | Dues list KPI |
| Supplier due (party) | `suppliers.current_due` | Dues list KPI |
| Aging buckets | Open `sales`/`purchases`.`due_total` + `due_date` | Dues aging KPIs |
| COGS / gross | `sale_items.cost_price` × qty | P&L / getProfitLoss* |
| Transfers | FT transfer types | Cash & Bank; excluded from Money In/Out |

### Posting contracts (static)

| Contract | Evidence | Runtime |
|---|---|---|
| Idempotency keys | Repo generates `client_txn_key` for income/expense/cash move/collect/pay/transfer | Unit wrappers PASS; live double-submit **NOT RUN** |
| No second balance table in Accounts 2.0 FE | Grep/architecture | PASS |
| Deposit non-P&L | Live RPC def | PASS |
| Atomic multi-record | Relies on existing SECURITY DEFINER RPCs | Assumed; **NOT re-proven** here |
| FA vs ledger history | Not recomputed in this audit beyond aggregates | Full recon **PARTIAL** |

### Read-only FA snapshot

- Active FA count: **6**
- Active FA balance sum: **284,030**

No FA↔FT closing-identity proof executed (would need per-account ledger walk); mark **UNVERIFIED**.

---

## REPORT H — RBAC & Security

| Control | Static result |
|---|---|
| Route gate `accounts.read` | PASS |
| Sidebar permission arrays for dues/P&L | PASS |
| Catalog path `dues` | PASS (`catalog.ts`) |
| Deposit/withdraw RPC perms `accounts.post` \| `accounts.manage` | PASS (migration/SQL) |
| Daily closing FE gate matches RPC triad | PASS (`DailyClosingPage` PermissionGate) |
| Aging/P&L RPCs require `_auth_ctx` | PASS (Unauthorized without session) |
| Role matrix (cashier/manager/admin) live | **NOT RUN** |
| Direct RPC bypass attempts as low-priv user | **NOT RUN** |

Empty counted cash: FE treats blank as null difference / disabled submit; explicit `0` valid — **PASS (code)** (`DailyClosingPage.tsx` ~42–49, 128–131).

---

## REPORT I — Desktop & Mobile UI

| Check | Result |
|---|---|
| Design tokens / English copy (code) | PASS-ish (existing pink `#E11D48` patterns) |
| Responsive breakpoints / screenshots | **BLOCKED** — no running app |
| Keyboard / focus / overflow | **BLOCKED** |
| Tables horizontal scroll containment | Code uses `overflow-x-auto` on hub recent table — visual **BLOCKED** |

---

## REPORT J — Defect Register

| ID | Sev | Module | Current | Expected | Root cause | Evidence | Impact | Recommended fix | Migration? |
|---|---|---|---|---|---|---|---|---|---|
| A2-REG-001 | P2 | Accounts hub KPIs | Period cash KPIs from max 200 FT rows | Full-period totals | Client aggregate + hard limit | `SimpleAccountsDashboardPage.tsx`; repo `listTransactions` | Misleading Money In/Out/Net | Server aggregate or paginated sum | Optional read RPC |
| A2-REG-002 | P2 | Due Management | Party due ≠ invoice due sums; UI silent | Explain SSOT vs invoice aging | Hybrid opening/adjustments + dual metrics | DB snapshot gaps; `DueManagementPage` KPIs | Misread receivables/payables aging | Label party vs invoice totals; document opening policy | No |
| A2-REG-003 | P2 | Due Management | No invoice list / allocation UI on hub | Audit checklist wanted invoice detail | Scope of 2.0 hub = party actions + aging honesty | `DueManagementPage.tsx` | Ops friction, not false overdue | Link to sale/purchase due docs or embed read-only invoice table | No |
| A2-REG-004 | P3 | Accounts hub | No edit-account on hub | Optional edit UX | Edit deferred to Settings/CashBank | Hub + Settings | UX only | Add edit or clarify “manage” | No |
| A2-REG-005 | P3 | P&L chart | Trend series capped ~62 days in SQL | Document or full range | Performance cap in `get_profit_loss_report` | Migration `00147` | Incomplete long-range charts | Document or aggregate by week/month | Optional |
| A2-REG-006 | P2 Process | Release process | FE Accounts 2.0 uncommitted on `main` while DB migrations already applied | Code + DB ship together | Working tree vs `db:push` | `git status`; migration table | Runtime/API drift risk across envs | Commit/PR FE before further prod push | N/A |

**No P0 verified defect** in applied POS apply_balance / deposit RPC / closing collection type based on live function definitions.

**Hypotheses (unverified):** concurrent over-allocation; FA closing identity drift; supplier due gap root cause — need authorized investigative queries + fixtures, not balance rewrites.

---

## REPORT K — Test Execution Evidence

| Test | Command / procedure | Env | Expected | Actual | Data modified? | Class |
|---|---|---|---|---|---|---|
| Typecheck | `npx tsc --noEmit` | local | exit 0 | exit 0 | No | **PASS** |
| Lint | `npm run lint` | local | exit 0 | exit 0 (warnings only) | No | **PASS** |
| Build | `npm run build` | local | exit 0 | exit 0 | No (dist only) | **PASS** |
| Unit cash-flow + invariants + routes + wrappers | `npm run test:unit -- --run …` | local vitest | pass | 21 passed | No | **PASS** |
| Routes smoke | `npm run test:routes` | local | pass | 9 passed | No | **PASS** |
| Migration list local | `npx supabase migration list` | local Docker | connected | **ECONNREFUSED** | No | **BLOCKED** |
| DB metadata + aggregates | `BEGIN READ ONLY` via `pg` + `TEST_DATABASE_URL` | linked project | readable | RPC/columns/snapshot OK | No | **PASS** (read-only) |
| Mutating POS/Purchase/Deposit e2e | would need fixtures | — | — | — | — | **BLOCKED** (no disposable confirmed session; would write) |
| Browser UI / responsive | browser → `:5173` | — | render | chrome-error | No | **BLOCKED** |
| Role RBAC live | — | — | — | — | — | **NOT RUN** |
| Playwright e2e | `test:e2e` | — | — | — | — | **NOT RUN** (mutating risk) |
| `db:test:*` suites | package scripts | — | — | — | — | **NOT RUN** (may mutate; not confirmed safe this session) |

---

## REPORT L — Release Decision

### **CONDITIONALLY READY**

**Why not READY FOR CONTROLLED RELEASE**

1. No authenticated browser regression of the three hubs.
2. No disposable mutating smoke for deposit / collect / pay / POS void after migration.
3. Open P2 KPI truncation + due SSOT labeling gaps.
4. Frontend still uncommitted while DB already has `00146`/`00147`.

**Why not NOT READY**

1. Migrations applied; critical RPC definitions match plan (POS FA credit, non-P&L cash move, closing collections, aging + P&L report).
2. Navigation/routes/sidebar match Accounts 2.0 contract.
3. Automated static/unit/build gates pass.
4. No verified P0 ledger corruption in this audit.

**Controlled release gate (minimum):** commit FE → staging UI smoke of three hubs → disposable deposit+POS sale/void+collect → fix or accept A2-REG-001/002 with labels → then GO.

---

## FINAL DECISION PACKAGE FOR CHATGPT

### A. Verified Migration Status

Implemented and DB-applied: Phase 0 POS FA `apply_balance=true`, `post_account_cash_movement`, closing `customer_collection`, Daily Closing blank-vs-zero UX/perms; Phase 1–5 hubs/contracts/nav; Phase 3b `due_date` + `get_party_due_aging`; Phase 4 `get_profit_loss_report` + margin tabs. FE currently uncommitted on `main`.

### B. Financial Source of Truth

Yes for balances (FA), cash book (FT), P&L other income/expense (income/expense entries), COGS (sale_items snapshots), party dues (`current_due`). Aging uses invoice `due_total`/`due_date` (orthogonal to party SSOT).

### C. Confirmed Defects

- A2-REG-001 hub KPI 200-row truncation (P2)
- A2-REG-002 unexplained party vs invoice due gaps in UI (P2)
- A2-REG-003 no invoice detail on dues hub (P2 gap)
- A2-REG-004/005 minor UX/chart-range (P3)
- A2-REG-006 process: DB ahead of committed FE (P2 process)

### D. Accounting Risks

Supplier/customer due gaps; FA↔FT identity not proven; no live deposit samples; concurrent allocation untested; long P&L ranges chart-capped.

### E. Legacy Compatibility

Legacy due/collection/payment URLs redirect; CashBank/Income/Expenses/Transactions/Closing/Recon/Settings remain reachable; existing money RPCs reused (not replaced).

### F. Database Changes

**No additional migrations required** for the verified defects above (read aggregates / UI labels). Optional later: period cash KPI RPC; invoice due UX writers for `due_date`.

### G. Recommended Fix Order

1. Commit/PR FE to match applied DB  
2. Fix or server-aggregate hub cash KPIs (A2-REG-001)  
3. Label dues KPIs party vs invoice / document gap (A2-REG-002)  
4. Disposable smoke: deposit, POS sale/void FA, collect/pay, closing  
5. Optional invoice table on dues (A2-REG-003)

### H. Test Evidence

PASS: tsc, lint, build, unit/route tests, read-only DB migration/RPC/definition/snapshot.  
BLOCKED: UI, e2e mutating, local supabase, role matrix.  
NOT RUN: full `db:test:*` / Playwright.

### I. Release Readiness

**CONDITIONAL GO** (staging-only until gates in Report L complete). **NO-GO** for unsupervised production cutover.

### J. Recommended Next Cursor Task (do not execute here)

> Minimal fix prompt: (1) Replace Accounts hub period Money In/Out/Transfer/Net Cash Flow client `listTransactions(limit:200)` aggregation with a read-only SQL aggregate RPC or unbounded paginated sum over the selected BD date range and branch scope, with vitest coverage. (2) On `/accounts/dues`, clearly label party `current_due` KPI vs invoice aging totals and show a one-line note when they differ. (3) Commit Accounts 2.0 FE to match applied `00146`/`00147`. No posting-logic rewrites; no balance backfills.

---

*End of report. No application code was modified during this audit.*
