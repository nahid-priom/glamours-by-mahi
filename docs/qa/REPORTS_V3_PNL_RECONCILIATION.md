# REPORTS V3 — P&L Reconciliation

## Authority

Both `/reports/profit` and `/accounts/profit-loss` render `SimpleProfitLossPage` → `financialQueries.getProfitLossReport` → RPC `get_profit_loss_report`.

Duplicate `reportsRepository.profitReport` removed.

## Fixture (Test A)

| Line | Amount |
|---|---|
| Gross sales | 1,000 |
| Returns | −200 |
| Net sales | 800 |
| COGS | 480 |
| Gross profit | 320 |
| Other income | 30 |
| Expenses | −100 |
| Net profit | 250 |

Vitest: `src/features/reports/__tests__/reports-v3-authority.test.ts` asserts this formula and absence of `profitReport`.

## Runtime check (manual / staging)

1. Open `/accounts/profit-loss` with branch + date range.  
2. Open `/reports/profit` with the same header branch + same dates.  
3. Compare Net sales, COGS, Gross profit, Other income, Expenses, Net profit.

Expected: identical totals. Users without `accounts.read` / `profit_loss.read` are redirected from `/reports/profit` to `/reports`.

## Data protection

No historical sales, returns, FT, or journals were rewritten for this alignment.
