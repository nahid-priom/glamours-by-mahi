# SQL smoke checklist (non-prod only)

Run after applying `20260315000146` and `20260315000147` on a staging/dev database. Do **not** run destructive cleanup in production.

## A. POS FA credit vs void

1. Complete a POS sale paid to a financial account (non-due method).
2. Assert `financial_accounts.current_balance` increased by payment amount.
3. Assert a posted `financial_transactions` row exists (`sale_payment`, direction `in`).
4. Void the sale.
5. Assert FA balance restored and FT marked voided (no second balance debit beyond the void path).

## B. Deposit non-P&L

1. Call `post_account_cash_movement` with `direction=in`.
2. Assert FT type `cash_deposit` and FA balance up.
3. Assert **no** new `income_entries` row.
4. Assert `get_profit_loss_report` / client `getProfitLoss` other income unchanged for that amount.

## C. Closing collections

1. Post a `customer_collection` (or collect due) on a business day.
2. Run `close_business_day` for that day.
3. Assert expected cash includes collection amounts (type filter includes `customer_collection`).

## D. Due aging honesty

1. With no `sales.due_date` / `purchases.due_date` set, `get_party_due_aging` returns `undated ≈ total`, `overdue = 0`.
2. Set one invoice `due_date` in the past with `due_total > 0`; overdue increases only for that row.
