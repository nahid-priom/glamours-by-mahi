# Payment Account V4 — Financial Reconciliation

Historical records are **not** rewritten. Reconciliation compares live postings after V4 UI/RPC changes.

## Safety confirmation

| Action | Done? |
|---|---|
| Delete / reclassify historical FAs | No |
| Move posted money between accounts automatically | No |
| Reset opening balances | No |
| Silent wrong-kind client fallback | Removed |

## Post-change spot checks (staging)

1. **Customer collection** — Customer due ↓, selected FA balance ↑, FT + party ledger reference match.
2. **Supplier payment** — Supplier due ↓, selected FA balance ↓, payment row FA id matches UI.
3. **Purchase pay-now** — Purchase + payment share branch; FA matches method kind.
4. **POS multi-tender** — Each tender line posts to its FA; invoice paid/due correct.
5. **Income / Expense** — P&L and Cash/Bank move only for explicit FA.
6. **Courier / Payroll / Commission** — Payable status only after successful RPC; FA = selected.
7. **Sale edit** — Original sale payments reversed to original FA; replacement uses newly selected FAs.

## Discrepancy report (read-only)

If historical cash/mobile mismatches exist from pre-V4 silent fallbacks, export:

- `sale_payments` / `purchase_payments` where method kind ≠ FA `account_kind`
- Do **not** auto-correct; use authorized reversal / transfer / adjustment.

## Data safety statement

V4 implementation is future-write correctness only. No production destructive migration runs as part of this change set. Migration `20260315000160_payment_account_v4_eligibility.sql` adds assert helpers and strengthens `complete_pos_sale` pre-validation only.
