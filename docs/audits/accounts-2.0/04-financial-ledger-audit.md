# REPORT 4 — Financial Ledger Architecture, Source of Truth & Integrity

## Architecture verdict

**Hybrid cash-book + party ledger + optional journals** — not a pure CoA-only GL UI.

| Layer | Mechanism | Authoritative for |
|---|---|---|
| FA balance | Stored `financial_accounts.current_balance` | Cash/bank wallet totals |
| Cash-book | `financial_transactions` + `balance_after` | Account statements |
| Journals | `_post_journal` | Accrual/recon companion |
| AR/AP | `current_due` + `*_ledger` | Party outstanding |
| Docs | sales/purchases due fields + `payment_allocations` | Invoice-wise open items |

## Integrity Q&A (evidence-based)

| # | Question | Answer | Status |
|---|---|---|---|
| 1 | Where is account balance calculated? | Applied as delta under lock (`_adjust_financial_account_balance` / `_post_financial_txn`) to `current_balance` | VERIFIED |
| 2 | Stored, derived, or both? | **Stored** primary; recon can rebuild running balances | VERIFIED |
| 3 | Authoritative balance source? | `financial_accounts.current_balance` for wallet UI | VERIFIED |
| 4 | Branch-specific balances? | FA may be branch-scoped or org-wide (`branch_id` null) | VERIFIED |
| 5 | Cross-branch FA access? | Org-wide FA visible; payments validate org+active, not always FA.branch=sale.branch | VERIFIED |
| 6 | Shared bank across branches? | Supported via null `branch_id` | VERIFIED |
| 7 | Opening balances? | `opening_balance` on FA; party opening via recon/opening docs | VERIFIED |
| 8 | Double post prevention? | `client_txn_key` / `CTX:` references + unique FT soft keys; closing unique per day | VERIFIED |
| 9 | Reversals? | `void_financial_transaction`; sale/purchase void paths | VERIFIED |
| 10 | Direct edit/delete posted? | Soft void pattern preferred; FE uses void RPC | VERIFIED / INFERRED |
| 11 | Audit trail? | FT + ledgers + journals + allocations | VERIFIED |
| 12 | Transfers linked? | `transfer_account_balance` posts paired movements | VERIFIED |
| 13 | Transfers inflate company cash? | Should net zero across FAs if both legs post | INFERRED (needs runtime pair check) |
| 14 | Income vs deposit? | **UI conflates** deposit→`create_income` | VERIFIED defect |
| 15 | Expense vs withdrawal? | **UI conflates** withdraw→`create_expense` | VERIFIED defect |
| 16 | Entries without source doc? | Manual income/expense allowed | VERIFIED |
| 17 | Failed posting recovery? | Transactional RPC; client retries use idempotency keys when provided | VERIFIED / INFERRED |
| 18 | Atomic posting? | SECURITY DEFINER RPCs in single DB txn | VERIFIED |
| 19 | Concurrent payment races? | FA row lock; unique idempotency; journal unique weaker | VERIFIED / INFERRED risk |
| 20 | Corrections traceable? | Void + recon tools; party ledger helpers lack unique on reference in some paths | VERIFIED gap |

## Debit/Credit labeling

Cash-book UI uses **direction `in` / `out`**, not classic CoA debit/credit labels on simple pages. Reconciliation center shows journal Debit/Credit. Using “Debit (In) / Credit (Out)” universally would be **misleading for liability/equity accounts** if introduced without CoA class awareness — **PROPOSED:** keep money-in/out for FA cash-book; reserve Debit/Credit for journal views.

## Running balance

- Stored per FT as `balance_after` (mapped in `mapFinancialTxn`).  
- List order is typically `transaction_date DESC`.  
- Recon tool: `recon_rebuild_financial_running_balances`.  
**INFERRED risk:** displaying `balance_after` in descending order is correct only if `balance_after` was computed chronologically at post time; do not re-sum visible rows bottom-up without reversing order.

## Closing identity

`Closing ≈ Opening + signed net movements` is the intended cash-book invariant; prior unified-core dry-run reported **0** financial running-balance deltas at that time (`docs/unified-core-implementation-report.md`). **UNVERIFIED** for current production without a fresh dry-run.

## Negative balances

`AccountSettings.allowNegativeBalance` exists (`simple-accounting.repository.ts`). Negative bank balances may be **policy-allowed**, not automatically defects. **PROPOSED:** treat screenshot negatives as investigate-first, not auto-zero.

## Specific defect: Deposit / Withdraw

**Finding:** Cash & Bank deposit/withdraw post operating income/expense.  
**Status:** VERIFIED  
**Evidence:** `CashBankPage.tsx` ~70–92 → `createIncome` / `createExpense`.  
**Impact:** Inflates Other Income / Expenses and distorts Accounts P&L and “money movement vs performance.”  
**Recommended resolution:** Dedicated transfer-like RPCs or FT types excluded from P&L income/expense sums; stop calling create_income/expense for pure cash moves.  
**Validation:** Post deposit ৳1000 → P&L Other Income unchanged; FA balance +1000; FT shows movement.

## Specific defect: Daily Closing empty counted

**Finding:** Difference KPI uses `Number(counted)||0`, so empty input shows full shortage; button correctly disabled when `counted === ''`.  
**Status:** VERIFIED  
**Evidence:** `DailyClosingPage.tsx` ~42–48, 74–78, 116–118.  
**Recommended resolution:** Hide difference until counted is non-empty; do not treat blank as zero for display.

## POS / sale FA posting asymmetry (integrity risk)

**Finding:** POS completion posts FT via `_post_financial_txn(..., apply_balance=false)` while `_complete_pos_sale_core` no longer increments `current_balance`. Void/edit paths still `current_balance -= payment.amount`. Net: sale cash missing from Cash & Bank; voids can debit money that was never credited. Online fulfilment (`085`) uses `apply_balance=true` (correct for that path only).  
**Status:** VERIFIED (SQL: `00066` core, `00133` wrapper, void/edit paths). Runtime sample on production balances: UNVERIFIED this session.  
**Recommended resolution:** Align post and reverse — credit FA on sale payment (or stop debiting on void if FT-only); recon FA vs FT for `sale_payment`.  
**Validation:** Complete cash POS sale → FA `current_balance` increases by paid amount; void restores prior balance; recon running-balance delta for that account is 0.

## Daily closing collection type mismatch

**Finding:** `close_business_day` (`00121`) filters collection txn types `customer_due_collection|due_collection|collection`, but `collect_customer_due` posts `transaction_type = 'customer_collection'`.  
**Status:** VERIFIED  
**Impact:** Expected cash / cash_collections component undercounts collections.  
**Recommended resolution:** Include `customer_collection` (and any aliases) in close filters; add regression SQL test.

## RLS: direct FA balance updates

**Finding:** Policy on `financial_accounts` allows UPDATE for users with manage/post-class permissions (`00005`), so clients could patch `current_balance` despite app repository avoiding it.  
**Status:** VERIFIED policy text; exploit attempt not performed.  
**Recommended resolution:** Restrict column updates / force balance changes only through SECURITY DEFINER helpers.
