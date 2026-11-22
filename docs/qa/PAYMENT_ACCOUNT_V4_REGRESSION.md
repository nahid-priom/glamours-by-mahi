# Payment Account V4 — Regression Checklist

## Resolver (unit)

```bash
npx vitest run src/lib/payments/__tests__/resolve-payment-account.test.ts
```

| # | Case | Expect |
|---|---|---|
| 1 | Cash + Cash FA | Resolve cash |
| 2 | Cash method, only Bank FA | `null` |
| 3 | Mobile + Mobile FA | Resolve mobile |
| 4 | Mobile + only Bank default | `null` |
| 5 | Method-link wrong kind | `null` |
| 6 | Settings bank default for mobile | `null` |
| 7 | Inactive FA | `null` |
| 8 | Other-branch FA | `null` |
| 9 | Org-wide same kind | Allowed when policy permits |
| 10 | Method change clears stale FA | Client `isAccountEligibleForMethod` |

## Method-driven UI

- [ ] SupplierPayments — account visible; confirm shows same FA
- [ ] DueCollection / CollectDueDialog — sale branch scope
- [ ] CustomerDue / SupplierDue / DueManagement — account before submit
- [ ] PurchaseNew — pay=0 no FA; pay>0 requires FA

## Account-first / explicit

- [ ] POS multi-tender — no `accounts[0]` / `is_default` invent
- [ ] Income / Expense — explicit FA required
- [ ] Courier settlements — Select account… (no first-row default)
- [ ] Commissions — no `payAccountId \|\| accounts[0]`
- [ ] Payroll — Select account required
- [ ] Daily Closing — cash-only, explicit select
- [ ] Purchase return refund — cash/bank explicit
- [ ] Exchange pay/refund — explicit
- [ ] CashBank — source/destination unchanged

## Sale edit

- [ ] Nonfinancial field-only correction preserves original payment FA on reversed invoice
- [ ] New money lines require kind-matched FA
- [ ] Confirm dialog lists method → account

## Negative (API / RPC)

- [ ] Wrong-kind FA rejected by `_assert_payment_account_eligible` (POS / edit_sale path)
- [ ] Inactive FA rejected
- [ ] Cross-branch FA rejected when FA is branch-bound
- [ ] Duplicate `client_txn_key` remains idempotent

## Build

```bash
npx tsc --noEmit
npm run build
```
