# Inventory Attribution Report

## Model

Supplier-origin stock is **purchase-receipt provenance**, not product-master supplier:

`purchases.supplier_id` → `purchase_items` → `inventory_receipt_sources` → `inventory_source_positions` / `inventory_source_allocations`

There is **no** `products.supplier_id`.

## FIFO consume / transfer

- Sales and outbound movements consume lots via `_inventory_source_consume_fifo`
- Transfers preserve `receipt_source_id` when matching works; unmatched → `unknown_legacy`
- Sale returns (00155): `_inventory_source_restore_sale_return` restores prior sale lots when possible; residue stays `unknown_legacy`

## Reporting

| RPC | Use |
|-----|-----|
| `get_supplier_stock_kpis` / `_summary` / `_breakdown` / `_movements` | Inventory + Stock tab |
| `get_supplier_stock_velocity` | 30D sold, avg daily, days cover, fast/slow/dead |

## Honest gaps

- Pre-cutover residue may be `unknown_legacy` (never guessed)
- Cost KPIs use WAC, not true lot P&L
- `verified` status exists but is not auto-written
- Units sold on directory cards come from sale allocations only when attributable
