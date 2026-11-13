# 06 / POS V2

## Route
`/sales/pos` → [`PosPage.tsx`](../../src/features/pos/pages/PosPage.tsx)

## Layout
- Desktop: catalog + right cart (`lg`+)
- Mobile: cart sheet + sticky bar
- Product cards: image, stock badge, SKU, pink price, + Add
- Checkout: `Pay & Complete (F8)` with busy/idempotent guard (`client_txn_key`)

## Posting
`complete_pos_sale` → `_complete_pos_sale_core` (unchanged authoritative path)
