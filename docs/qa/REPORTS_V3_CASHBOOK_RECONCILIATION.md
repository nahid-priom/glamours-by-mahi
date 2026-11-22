# REPORTS V3 — Cash Book Reconciliation

## Authority

- Cash book SSOT: `financial_transactions` via `simpleAccountingRepository.listTransactions`
- UI: `/accounts/transactions`
- Reports entry: `/reports/cash-book` → query-preserving redirect to `/accounts/transactions`

## FT vs journals

Journals are optional companions. Cash book accuracy does **not** require a 1:1 journal for every FT. Reconciliation center exposes gaps via existing recon views/RPCs — reports do not fabricate journals.

## Classification rules (verified in vitest)

| Movement | Money in/out | P&L |
|---|---|---|
| Customer collection | Yes (in) | Not revenue |
| Supplier payment | Yes (out) | Not purchase OpEx |
| Internal transfer | Excluded from in/out | Neutral |
| Deposit / withdraw | Cash move | Non-P&L (must not enter other income/expense) |

## Manual check

1. Post a known collection; confirm FT appears under transactions.  
2. Confirm customer due decreases.  
3. Confirm P&L net sales unchanged by the collection alone.
