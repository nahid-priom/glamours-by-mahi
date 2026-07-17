# Unified Finance / Inventory / Sales / Purchase Core — Implementation Report

Date: 2026-07-17  
Org: Glamourous by Mahi (`aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa`)  
Linked project: `vahqinuminrcjpussimn`

## What shipped

### Schema / RPC migrations (additive)
Already on remote before this push (029–032):
- Internal helper EXECUTE revoked from `anon` / `authenticated`
- Foundations: `qty_reserved`, FT idempotency/reversal columns, ecommerce sale columns, allocations / reservations / opening docs / recon tables, Opening Balance Equity CoA
- Hardened `_adjust_inventory`, `_post_financial_txn`, `_post_journal`
- Hardened `approve_sales_return` + partial-sale `complete_pos_sale` wrapper

Pushed this session (033–035):
- `20260315000033_purchase_return_and_collection_allocation.sql` — FIFO collection/payment allocations, `approve_purchase_return`, purchase FT sync wrapper, hardened `pay_supplier`
- `20260315000034_online_order_reserve_and_fulfil.sql` — `place_online_order` (draft + reserve), `fulfil_online_order`, `cancel_online_order`, `expire_online_reservations`, `list_online_orders`
- `20260315000035_reconciliation_dry_run_and_reports.sql` — recon views + dry-run/apply RPCs + `get_reconciliation_report`

### Frontend
- Online Orders queue: `/sales/online-orders`
- Reconciliation Center: `/accounts/reconciliation` (apply button disabled)
- Purchase returns go through `approve_purchase_return` (no direct inserts)
- Storefront checkout persists idempotency key; success screen says reserved / awaiting fulfilment
- Query keys, permissions, typed RPC stubs in `database.ts`
- Verification scripts: `scripts/verify-unified-core.ps1`, `npm run verify:unified-core`

### Gates
| Check | Result |
|-------|--------|
| `npm run typecheck` | pass |
| `npm run lint` | pass (warnings only) |
| `npm test` | 37 passed |
| `npm run build` | pass |
| `supabase db push` (schema/RPC only) | applied 033–035 |
| Production repair apply | **not run** (per plan) |

## Production dry-run reconciliation (read-only)

| Metric | Value |
|--------|------:|
| Inventory balances without ledger | **1,153** |
| Qty on those balances | **14,935** |
| Customer due deltas (vs open sales) | **10** parties · **৳12,400** |
| Supplier due deltas (vs open purchases) | **10** parties · **৳185,000** |
| Financial running-balance deltas | **0** |
| Unbalanced journals | **0** |
| Active reservations | **0** |
| `authenticated` can execute `_post_financial_txn` | **false** |
| `authenticated` can execute `place_online_order` | **true** |

Sales present: `INV-000001` (paid 90 / due remaining), `INV-000002` (paid 1450).

## Exceptions still requiring a separately authorized apply

These are **reported only** — balances were not repaired:

1. **Opening stock ledger** for 1,153 balances (qty unchanged backfill via `recon_opening_stock_ledger` apply).
2. **Opening AR documents** for seeded customer dues (~৳12,400 without sale documents) via `recon_opening_party_balances`.
3. **Opening AP documents** for seeded supplier dues (~৳185,000 without purchase documents) via same RPC.
4. Optional **partial-sale summary** dry-run/apply for historical invoice alignment (`recon_repair_partial_sale_summaries`).

Use Accounts → Reconciliation Center dry-run buttons, then a later authorized apply run if business approves.

## Guardrails honored
- No parallel ledgers/balances
- Frontend does not mutate live `current_balance` after account create
- Production apply repairs not invoked
- Online orders: reserve at checkout, deduct at fulfilment
