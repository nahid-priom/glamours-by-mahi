# Accounts & Finance 2.0 — Implementation Report

**Date:** 2026-03-15 (local implementation)  
**Verdict:** **CONDITIONAL READY**

## Summary

Phase 0–5 hubs and contracts are implemented in-repo. Migrations are prepared locally and **must not be applied to production without explicit approval**. No parallel ledger; no silent recon repair.

| Phase | Status | Evidence |
|---|---|---|
| 0 POS FA apply_balance + void FT helper | Done (migration) | `supabase/migrations/20260315000146_accounts_finance_2_phase0.sql` |
| 0 Non-P&L `post_account_cash_movement` | Done | Same migration + `CashBankPage` → `postCashMovement` |
| 0 Closing `customer_collection` + UX/perms | Done | Migration + `DailyClosingPage` |
| 1 financial-commands / queries + cash KPIs | Done | `src/features/accounting/lib/financial-*.ts`, `cash-flow-metrics.ts` |
| 2 Accounts Management hub | Done | `SimpleAccountsDashboardPage.tsx` |
| 3 Due Management (2A undated honesty) | Done | `/accounts/dues` + redirects |
| 3b nullable `due_date` + aging RPC | Done (additive migration) | `20260315000147_accounts_finance_2_dues_pnl.sql` |
| 4 P&L tabs + snapshot COGS report RPC | Done | `SimpleProfitLossPage` + `get_profit_loss_report` |
| 5 Slim sidebar + legacy redirects | Done | `AppSidebar`, `accounts.routes.tsx` |
| 6–7 Invariant tests + this report | Done | Vitest below; SQL smoke pending non-prod apply |

## Locked decisions honored

- **1B Deposit/Withdraw:** FT types `cash_deposit` / `cash_withdrawal` via RPC; not written to `income_entries` / `expense_entries`.
- **2A Aging:** UI shows **Due Date Not Set** / undated bucket; overdue is **0 / N/A** until dated invoices exist. No fabricated overdue from sale date.

## Production gate

| Item | Gate |
|---|---|
| Apply `00146` / `00147` | Explicit approval required |
| Historical income/expense “deposits” | Left as-is (documented; no silent rewrite) |
| Balance backfill / recon apply | Out of scope |

## Tests run (local)

- `src/features/accounting/lib/cash-flow-metrics.test.ts`
- `src/features/accounting/lib/accounts-finance-2.invariant.test.ts`

SQL smoke (sale → FA↑ → void restores; deposit excluded from P&L other income; close counts `customer_collection`) requires a non-prod DB after migration apply.

## Residual risks → CONDITIONAL

1. Migrations not yet applied to any environment in this session.
2. `get_profit_loss_report` trend series capped (~62 days) for performance.
3. Invoice `due_date` is nullable and unused by POS/purchase writers until a follow-up UX sets dates — aging overdue stays empty by design.
4. Dashboard client fallback now uses `getProfitLoss` (COGS-aware) instead of sales−expenses; depends on sale_items snapshots being populated.

## READY checklist (when migrations applied + smoke pass)

- [ ] Apply `00146` + `00147` on staging
- [ ] SQL: POS payment credits FA; void restores
- [ ] Deposit does not change `income_entries` / P&L other income
- [ ] `/accounts`, `/accounts/dues`, `/accounts/profit-loss` render with live data
- [ ] Sidebar shows three Accounts & Finance primaries
