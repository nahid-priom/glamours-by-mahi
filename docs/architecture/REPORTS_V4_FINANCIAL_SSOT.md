# Reports V4 — Financial Single Source of Truth

## Canonical authorities

| Metric | Authority | Notes |
|---|---|---|
| Net sales / Gross profit / Net profit (Hub + P&L page) | `get_profit_loss_report` | Never duplicate in Reports |
| Sales register document totals | completed `sales` | Paid/due are settlement fields |
| Sales returns | `sale_returns` status ∈ approved/completed | Not courier return requests |
| Channel revenue | `sales.order_source` | Free-text `channel` ignored for SSOT totals |
| Product COGS / margin | `sale_items.cost_price` × qty at sale time | Not current catalog purchase price |
| Party receivables / payables lists | `customers.current_due` / `suppliers.current_due` | As-of balances |
| Due aging buckets | `get_party_due_aging` | Invoice due-date semantics; may ≠ party total |
| Inventory WAC value | `total_stock_purchase_cost` / `average_unit_cost` | Not sell value |
| Inventory sell value | `total_stock_value` | Catalog sell × qty; label distinctly |
| Courier ops | `get_courier_report` | Delivered COD ≠ settled |
| COD settlement | `courier_settlements` | Pending vs settled statuses |
| Purchases | completed `purchases` | Payments settle AP, not OpEx |

## Conceptual formulas (document authority)

```
Net Sales (register KPI) =
  Σ completed sales.grand_total
  − Σ posted sale_returns.total (same filter range)

Gross Profit (P&L) = Net Sales (P&L recognition) − Net COGS (P&L)

Net Profit (P&L) = Gross Profit + Other income − Operating expenses
```

Register net sales and P&L net sales can differ by recognition timing and COGS rules — both are valid; do not force equality without documenting adjustments.

## Scenario A (regression fixture)

- Gross 10,000 − discount 1,000 → document net 9,000
- Posted return 2,000 → net sales 7,000
- COGS 5,000 − returned COGS 1,000 → net COGS 4,000
- Gross profit 3,000

## Hard rules

- Never silently return zero on RPC failure
- Never export cost/margin without cost permissions
- Never treat courier return requests as financial returns
- Never equate delivered COD with settled COD
- Stock aging remains gated without remaining-stock age SSOT
