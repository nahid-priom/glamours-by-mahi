# Dashboard V3.1 — KPI Reconciliation

## Status: BLOCKED (no isolated seed)

Without posted local demo transactions, full expected-vs-actual ledger reconciliation cannot be completed this pass.

## Method (when unblocked)

1. Run `scripts/demo/seed-glamorous-dashboard.mjs` on local
2. Call `get_dashboard_overview` for Today and Last 7 Days
3. Compare Sales to sum of eligible posted net sales in window
4. Compare Collection to posted receipts (no double-count)
5. Compare Expenses / Profit per mig 125 definition
6. Compare dues to party balances
7. Compare Low Stock / products to inventory RPCs
8. Compare category totals to line-item category aggregates

## UI labeling

Secondary cards show “current balance” / “current” / “active catalog” / “in range” to avoid implying period filters rewrite balances.
