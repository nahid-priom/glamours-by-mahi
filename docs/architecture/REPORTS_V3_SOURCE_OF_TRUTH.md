# REPORTS V3 — Source of Truth

Reports are **read models**. Posting stays in existing RPCs.

| Metric | Canonical authority | Implementation |
|---|---|---|
| Completed sales | `sales` status=completed, not deleted | `reportsRepository.salesReport` / sales history |
| Sale quantities | `sale_items` | product performance |
| Sales returns | `sale_returns` approved/completed | P&L RPC; ops reports when applicable |
| COGS | Historical `sale_items.cost_price × qty` | `get_profit_loss_report` |
| Net profit | `get_profit_loss_report` | `financialQueries.getProfitLossReport` |
| Cash/bank movements | `financial_transactions` | `/accounts/transactions` |
| Journal balances | `journal_entries` (optional) | recon; not cash-book SSOT |
| Customer due | `customers.current_due` + `customer_ledger` | dues reports + Accounts dues |
| Supplier due | `suppliers.current_due` + `supplier_ledger` | same |
| Purchases | completed `purchases` | purchases report |
| Purchase payments | authorized payment / FT paths | Accounts / purchases payments — not second OpEx |
| Inventory qty | `inventory_balances` | inventory report |
| Inventory valuation | WAC `average_unit_cost` / `get_inventory_valuation_summary` | never selling price as GL |
| Branch / salesperson | sale branch_id / salesperson_id | analytics reports |
| Courier | `get_courier_report` | courier report |
| Courier returns | `courier_return_requests` | ops only |

## Layer diagram

```text
Posting RPCs → Operational docs + Party ledgers + FT (+ optional journals)
                         ↓
              Reports / Accounts shared read layer
                         ↓
                    UI / Print / CSV
```
