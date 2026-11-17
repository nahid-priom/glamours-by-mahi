# REPORT 5 — Cross-Module Financial Integration Audit

## Financial event integration matrix

| Business event | Source module | Ledger / FA impact | Due impact | Inventory | P&L impact | Risk | Status |
|---|---|---|---|---|---|---|---|
| POS cash/bank/mixed sale | POS / sales | FT yes; **FA balance not credited** (`apply_balance=false`); void still debits FA | Due if underpaid | Stock consume + WAC COGS on lines | Revenue via sales totals; COGS via `sale_items.cost_price` | **P0 cash SSOT gap** | VERIFIED |
| Credit / due sale | POS | Partial or no FA in | ↑ `customers.current_due` | Same | Revenue recognized on completed sale (accrual-like for sales total) | Policy: revenue ≠ cash | VERIFIED |
| Due collection | Sales / Accounts | FA ↑ via `_post_financial_txn(true)` | ↓ due + FIFO alloc | None | **Should not** add sales revenue | Duplicate revenue if misclassified | VERIFIED correct intent |
| Purchase receive | Purchases | FA ↓ on paid amount | ↑ supplier due if unpaid | Stock ↑ | Not OpEx; inventory/asset | FA update asymmetric vs FT wrapper | VERIFIED |
| Supplier payment | Purchases / Accounts | FA ↓ | ↓ supplier due + alloc | None | **Should not** re-expense COGS | — | VERIFIED |
| Sale return | Sales | Reverse money / due paths | Adjust AR | Stock restore | Reduces net sales in P&L calc | Period mismatch (return `created_at` vs sale `completed_at`) | VERIFIED / INFERRED |
| Purchase return | Purchases | Reverse payables / stock | Adjust AP | Stock ↓ | Cost reversal via inventory | Uses approve RPC | VERIFIED |
| Manual income | Accounts | FA ↑ | — | — | Other income | Distinct from sales | VERIFIED |
| Manual expense | Accounts | FA ↓ | — | — | Operating expense | — | VERIFIED |
| Account transfer | Accounts | FA A↓ B↑ | — | — | Should be P&L-neutral | If mis-tagged as income/expense elsewhere | VERIFIED transfer RPC; deposit UX risk |
| Deposit/Withdraw UI | CashBank | FA move via income/expense RPCs | — | — | **Incorrectly hits P&L** | P1 | VERIFIED |
| Inventory adjustment | Inventory | Usually stock/WAC only | — | Qty/value | Not auto OpEx | Don’t treat as P&L expense | VERIFIED / INFERRED |
| Courier COD settlement | Courier migrations | Settlement accounting RPCs | — | — | Possible income/cash | Separate module | VERIFIED exists |
| Exchange | Exchanges | Sale/return composite | Possible | Stock swap | Composite | Needs care in P&L | INFERRED |
| Online order fulfil | Storefront/sales | FA post with apply_balance true on fulfil path | — | Reserve→deduct | Revenue timing | Different from POS | VERIFIED (prior report) |
| Daily closing | Accounts | Closing record; variance reason | — | — | Not P&L by itself | Empty counted UX | VERIFIED |
| Void financial txn | Accounts | Reverse FT/balance | — | — | Removes income/expense effects when voided | Permission `transactions.void` | VERIFIED |

## POS & sales notes

- Collection must reduce AR and increase FA **without** creating a second sales invoice — `collect_customer_due` design matches this (VERIFIED).  
- Accounts P&L uses **completed sales grand_total** minus returns, not cash collections (VERIFIED) → credit sales affect profit when completed.  
- COGS from **stored** `sale_items.cost_price` × qty (VERIFIED) — good vs live product cost, contingent on WAC snapshot at sale.

## Purchase notes

- `complete_purchase` + `pay_supplier` separate goods receipt liability from cash settlement (VERIFIED).  
- Supplier payment should not create another purchase expense line in OpEx tables (VERIFIED intent).

## Inventory notes

- WAC engine migrations (`00039`, `00041`) feed valuation and sale cost snapshots.  
- Not every stock movement is an OpEx posting (VERIFIED architectural intent).

## Branch notes

- Reporting/P&L/dashboard filters often use `activeBranchId`.  
- Shared expenses allocation policy: **not found** as automated allocator — **UNVERIFIED / open question**.

## Double-posting controls

| Path | Control | Gap |
|---|---|---|
| POS/purchase | Required `client_txn_key` | — |
| Income/expense/transfer | Optional `client_txn_key` → `CTX:` reference | FE may omit keys on some forms — INFERRED |
| Collection/pay | Idempotent reference lookup | Party ledger unique weaker — VERIFIED gap |
| Journals | Soft dedupe by source | No hard unique — INFERRED race |
