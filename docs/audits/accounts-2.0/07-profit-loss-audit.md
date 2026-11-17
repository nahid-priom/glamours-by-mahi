# REPORT 7 — Profit & Loss Calculation Audit

## Current Accounts P&L (VERIFIED)

**Page:** `SimpleProfitLossPage.tsx`  
**Function:** `simpleAccountingRepository.getProfitLoss` (~836–870)

```
netSales     = sum(sales.grand_total where completed) − sum(sale_returns.total)
productCost  = sum(sale_items.cost_price * qty) for those sale IDs
grossProfit  = netSales − productCost
otherIncome  = sum(income_entries.amount posted)
expenses     = sum(expense_entries.amount posted)
netProfit    = grossProfit + otherIncome − expenses
margin       = netProfit / netSales * 100   // net margin, despite some UX wording
```

Branch filter: optional `activeBranchId` on sales/returns/income/expense queries.

## Recognition policy (VERIFIED)

- **Revenue:** Completed sales totals (not cash collected). Credit sales count when completed.  
- **Collections:** Do not appear as sales in this formula.  
- **Other income / expenses:** Manual posted entries (includes deposit/withdraw misposts).  

## COGS method (VERIFIED / INFERRED)

| Question | Answer | Status |
|---|---|---|
| Method | Moving Weighted Average engine in inventory migrations; snapshot on sale lines | VERIFIED WAC migrations; INFERRED always populated |
| Historical vs current cost | Uses `sale_items.cost_price` (transaction snapshot) — correct approach if populated | VERIFIED formula |
| Reconstruct from stock movements? | Accounts P&L does **not**; uses line cost | VERIFIED |
| Zero/null cost lines | Treated as 0 via `n()` — understates COGS | INFERRED risk |

## Reports module profit (VERIFIED)

`reports.repository.ts` `profitReport`: revenue vs COGS/gross — lighter than Accounts P&L (may omit other income/expenses). Dashboard uses `get_dashboard_overview` with its own profit fields; client fallback approximates sales − expenses **without COGS** (`dashboard.repository.ts` comment ~374) — **P1 consistency risk** if RPC fails over.

## Target capability gap

| Target | Current | Gap |
|---|---|---|
| Overall business P&L | Yes (summary) | OK base |
| Branch-wise P&L | Filter by active branch only | No multi-branch comparison table |
| Product-wise GP | No on Accounts P&L | Need aggregation of sale_items |
| Variant-wise GP | No | Need variant join |
| Invoice-wise GP | No | Need per-sale rollup |
| Gross margin % | Not shown as GP/NS; margin is net | Fix definition in UI |
| Trends / rankings | No on Accounts page | Charts missing |
| Export | Reports profit CSV exists | Wire into Accounts P&L |

## Recommended reconciliations (PROPOSED tests)

1. Σ sale-line net ≈ invoice net (same sale).  
2. Σ sale-line COGS ≈ invoice COGS.  
3. Σ invoice GP ≈ report GP (same filters).  
4. Branch GP sum vs consolidated with shared-expense policy explicit.  
5. Product GP sum vs sale GP same scope.  
6. Net profit vs income_entries + expense_entries + GP.  
7. Returns spanning periods.  
8. After purchase cost changes, historical GP unchanged (snapshot test).

## Deposit/withdraw contamination

Any CashBank deposit/withdraw posted via income/expense **directly distorts** otherIncome/expenses and netProfit — see ledger audit.

## Branch / product formula inconsistencies (VERIFIED)

| Surface | Formula | Evidence |
|---|---|---|
| Accounts P&L | `grand_total − returns − COGS + otherIncome − expenses` | `getProfitLoss` |
| Dashboard org net (RPC) | `(sales − COGS) − expenses` | `00125` `get_dashboard_overview` |
| Dashboard branch_perf | **`collection − COGS`** (not sales−COGS) | `00125` L279–283 |
| Reports `/reports/profit` | revenue − COGS (gross only) | `reports.repository.ts` |
| Sales “profit by product” (some pages) | **Local demo DB** `reporting.service.ts` | Not live Supabase |

## Implementation readiness for P&L 2.0

| Piece | Ready? |
|---|---|
| KPI summary | Yes — reuse |
| Overall / branch filter | Partial — unify branch vs org definitions first |
| Product / variant / invoice drill-down | Needs new queries/RPC (live path incomplete) |
| Charts | Reuse dashboard chart shell |
| Shared COGS contract with dashboard | Needs unification; remove/flag demo reporters |

**PROPOSED:** Introduce `get_profit_loss_report(payload)` RPC returning overall + optional breakdowns from sale_items snapshots; keep Accounts page as consumer. Avoid recomputing from live `products` cost.
