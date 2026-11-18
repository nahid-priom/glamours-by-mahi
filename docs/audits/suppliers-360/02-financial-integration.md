# Financial Integration Report

## SSOT

| Concern | Source |
|---------|--------|
| Party AP | `suppliers.current_due` via `supplier_ledger` |
| Invoice open | `purchases.due_total` + `payment_allocations` |
| Cash | `financial_accounts` / `financial_transactions` |
| Optional GL | `journal_entries` when CoA roles exist |

## Posting paths

1. **Purchase** — `complete_purchase` → `purchase_invoice` (+ `purchase_payment` if cash)
2. **Pay** — `pay_supplier` → FT out + `supplier_payment` ledger + FIFO allocate
3. **Return** — `approve_purchase_return` → `return_credit` via `_post_supplier_ledger_entry` (00154)
4. **Void return** — `void_purchase_return` → `reversal`

## Idempotency (00154)

`pay_supplier` no longer returns early on FT alone. Matching `supplier_ledger` required; orphan FT triggers repair of ledger + allocation.

## Repair RPCs (1B)

| RPC | Purpose |
|-----|---------|
| `recon_supplier_financial_dry_run` | Report wrong openings, party vs ledger, party vs invoices, orphan FT |
| `repair_supplier_opening_sign` | Soft-delete credit openings; post debit openings; sync |
| `repair_supplier_party_sync` | Rebuild `current_due` from ledger sum |

UI: Reconciliation Center → Supplier 360 audited repairs (accounts.manage).

## Statement math

`get_supplier_ledger_statement` computes:
- Opening = Σ(debit−credit) before `p_from`
- Period lines with running balance ordered by `occurred_at, id`
- Closing from last running balance in window
