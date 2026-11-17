# REPORT 9 — Migration Blueprint, Problem Register & Roadmap

## Prioritized problem register

| ID | Severity | Module | Finding | Root cause | Evidence | Business impact | Recommended fix |
|---|---|---|---|---|---|---|---|
| A2-000 | P0 | POS/FA | Sale payments write FT with `apply_balance=false`; core no longer credits FA; void still debits FA | Wrapper/core divergence after early `008` behavior | `00066` core, `00133` wrapper, void paths — VERIFIED | Cash & Bank missing POS cash; voids worsen balances | Unify apply_balance on post/reverse; recon assert |
| A2-001 | P1 | CashBank | Deposit/withdraw posted as income/expense | UI calls `createIncome`/`createExpense` | `CashBankPage.tsx` ~70–92 | Distorts P&L | Non-P&L money-move RPC/types |
| A2-002 | P1 | Daily Closing | Collection component misses `customer_collection` type | Close filter string set outdated vs collect RPC | `00121` vs `065`/`066` | Expected cash undercounts collections | Expand type filter + test |
| A2-003 | P2 | Daily Closing | Empty counted shows full shortage | `Number('')\|\|0` in difference KPI | `DailyClosingPage.tsx` ~42–78 | Operator confusion | Hide diff until input |
| A2-004 | P2 | Nav | Dual collect/pay routes; `/sales/:id/collections` ignores id | Dual mounts; no `useParams` | routes + DueCollectionPage | Confused bookmarks / dead deep link | Redirect; wire or remove `:id` route |
| A2-005 | P2 | Permissions | Closing nav vs button mismatch; coarse `accounts.read` tree | Nav `daily_closing.create`; button manage/post | Sidebar + DailyClosingPage + accounts.routes | False access expectation | Align gates |
| A2-006 | P2 | Due Mgmt | No aging/overdue | No due_date/aging RPC/UI | dues audit | Cannot ship design overdue | Additive due_date + aging view |
| A2-007 | P2 | P&L | No product/invoice drill-down; margin is net; branch KPI ≠ org formula | Client summary; dashboard `collection−cogs` | getProfitLoss; `00125` | Incomplete / inconsistent analytics | Unify formulas; breakdowns RPC |
| A2-008 | P2 | Dashboard | Fallback profit ignores COGS | Client fallback sales−expenses | `dashboard.repository.ts` ~374 | Misleading KPIs if RPC fails | Fail closed or compute COGS |
| A2-009 | P2 | Security | RLS allows UPDATE of FA including balance | Policy `00005` | migration | Client could forge balances | Lock balance to DEFINER helpers |
| A2-010 | P3 | P&L | `gross` deprecated alias includes otherIncome | Historical field | ProfitLossResult | Confusing consumers | Stop using alias |
| A2-011 | P3 | Tests | Sparse accounts E2E | Coverage gap | e2e inventory | Regressions in migration | Add acceptance suite |
| A2-012 | P2 | History | Opening AR/AP/stock recon gaps | Cutover without docs | unified-core report | Party due ≠ open docs | Authorized recon apply when approved |
| A2-013 | P3 | Reports | Dual live vs demo reporting stacks | `reporting.service.ts` peekDatabase vs Supabase repos | sales reports pages | Fake “profit by product” if wrong path | Remove/flag demo paths |

## Strategy comparison

| | Strategy A — UI façade + redirects | Strategy B — New financial read models first |
|---|---|---|
| Speed to Accounts Management UX | Faster | Slower |
| Risk to posting engines | Lower | Lower if read-only RPCs |
| Due overdue design | Incomplete until Phase 1 schema | Better if aging RPC first |
| Rollback | Easy (routes/components) | Easy for reads; harder if writes change |
| **Choice** | **Preferred for Phases 2–3** | Use for P&L/aging analytics pieces |

## Proposed architecture (PROPOSED)

1. Keep posting SSOT: existing RPCs + tables.  
2. Hub pages compose `simpleAccountingRepository`, sales/purchases due pages, recon hooks.  
3. Additive only: money-move types, `due_date`, aging/P&L RPCs.  
4. Compatibility: retain `/accounts/transactions`; Navigate redirects for retired sidebar leaves.  
5. Branch: continue `activeBranchId` + org-wide FA.  
6. RBAC: reuse catalog; fix page gates.  

### Schema changes

| Change | Class |
|---|---|
| Deposit/withdraw FT type or `transaction_type` + P&L exclusion | Optional → Recommended |
| `due_date` on sales/purchases | Optional → Required for overdue UI |
| Aging / P&L report RPCs | Optional → Recommended |
| Drop FT/journals / rebuild balances | **Unnecessary / unsafe** |

### Rollback

- Feature-flag hubs; keep old routes live.  
- Redirect-only changes reversible.  
- Never destructive backfill without dry-run + backup.  
- Money-move RPC changes: feature flag FE callers.

## Implementation roadmap

### Phase 0 — Critical financial defect resolution

- Scope: **A2-000** (POS FA credit/void), A2-001 (deposit/withdraw), A2-002 (closing collection types), A2-003, A2-005, A2-009 (RLS balance)  
- DB: sale FA apply_balance alignment; close type filter; optional deposit/withdraw RPC; tighten FA UPDATE  
- Risk: **Critical** if A2-000 skipped  
- Effort: M–L  
- Exit: Cash POS sale credits FA; void restores; deposit ≠ Other Income; close counts `customer_collection`; closing UI honest  
- Rollback: revert RPC/FE flags  

### Phase 1 — Shared contracts & validation

- Scope: Document SSOT; unify cache keys; P&L field definitions; recon dry-run on staging  
- DB: none mandatory  
- Exit: Written contracts + failing tests listed as tickets  

### Phase 2 — Accounts Management UI migration

- Scope: Hub composing CashBank + KPIs + ledger link + actions; secondary links to closing/recon/settings  
- Files: new hub page, `accounts.routes.tsx`, `AppSidebar.tsx`, extract list/ledger components  
- Risk: Medium  
- Exit: Sidebar shows simplified Accounts entry; all money actions reachable; transactions kept  

### Phase 3 — Due Management UI migration

- Scope: `/accounts/dues` tabs; reuse collect/pay; redirects from old due routes  
- DB: due_date + aging if product requires overdue chips  
- Exit: Customer/supplier dues operable; no duplicate balance tables  

### Phase 4 — Profit & Loss analytics migration

- Scope: Fix margin labels; breakdowns; charts; align dashboard profit  
- DB: optional `get_profit_loss_report`  
- Exit: Overall + branch + product + invoice GP available for a date range  

### Phase 5 — Integration & regression testing

- Scope: Matrix in report 08; SQL smokes; Playwright money flows  
- Exit: Critical invariants automated  

### Phase 6 — Controlled release

- Scope: Redirect cutover; monitor recon; dual-run bookmarks  
- Exit: Legacy URLs redirect; no posting downtime  

## Dependency-aware sequence

Phase 0 → Phase 1 → (Phase 2 ∥ start Phase 3 without aging) → Phase 3 aging → Phase 4 → Phase 5 → Phase 6.
