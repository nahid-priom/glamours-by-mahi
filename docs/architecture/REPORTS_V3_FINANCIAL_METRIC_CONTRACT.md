# REPORTS V3 — Financial Metric Contract

Labels must match Accounts semantics. Database recognition rules remain authoritative.

| Label | Definition | Authority |
|---|---|---|
| Gross Sales | Sum of completed sales `grand_total` in period/branch | `sales` |
| Sales Returns | Approved/completed `sale_returns.total` in period | `sale_returns` |
| Net Sales | Gross Sales − Sales Returns | `get_profit_loss_report.net_sales` |
| COGS | Σ `sale_items.qty * cost_price` for completed sales in period | RPC `product_cost` |
| Gross Profit | Net Sales − COGS | RPC `gross_profit` |
| Other Income | Posted `income_entries` (not pure deposits) | RPC `other_income` |
| Expenses | Posted `expense_entries` (not pure withdrawals) | RPC `expenses` |
| Net Profit | Gross Profit + Other Income − Expenses | RPC `net_profit` |
| Gross Margin % | Gross Profit / Net Sales | FE derived |
| Net Margin % | Net Profit / Net Sales | FE / RPC margin |
| Customer Due | Party `current_due` | customers table / ledger |
| Supplier Due | Party `current_due` | suppliers table / ledger |
| Money In / Out | Posted `financial_transactions` | FT list / cash flow helpers |
| Collection | AR settlement FT; **not** a second sale | `collect_customer_due` |
| Supplier Payment | AP settlement; **not** a second purchase expense | pay supplier RPC |
| Internal Transfer | FA↔FA; P&L-neutral | transfer RPC |
| Inventory Qty | On-hand balances | `inventory_balances` |
| Inventory Cost Value | qty × WAC (when permitted) | valuation RPC / `average_unit_cost` |

## Non-equivalence rules

- Sales amount ≠ cash received  
- Purchase completion ≠ OpEx  
- Courier return request ≠ posted sale return  
- FT row ≠ mandatory journal line  
