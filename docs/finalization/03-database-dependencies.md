# 03 — Database Dependencies

## Linked project
- Ref: `vahqinuminrcjpussimn`
- Migrations: 120 files (`20260315000001`–`00123`, gaps 018/020/021)

## Critical posting RPCs
| RPC | Role |
|-----|------|
| `complete_pos_sale` | Client POS wrapper → `_complete_pos_sale_core` + commission |
| `_complete_pos_sale_core` | Atomic sale/stock/ledger/journal |
| `complete_purchase` | Purchase + stock in + supplier ledger |
| `collect_customer_due` / `pay_supplier` | Party settlements |
| `approve_sales_return` | Return + restock + reverse |
| `get_dashboard_overview` | Dashboard KPIs |
| `list_activity_feed` | Activity UI (broken until 124) |
| Staff workspace RPCs (108) | `get_staff_dashboard_summary`, commissions |

## Canonical tables
Sales: `sales`, `sale_items`, `sale_payments`  
Inventory: `products`, `product_variants`, `inventory_balances`, `stock_ledger`  
Accounting: `journal_*`, `financial_*`, `customer_ledger`, `supplier_ledger`, `expense_entries`  
HR: `employees`, `payroll_*`, `staff_targets`, `salesman_commissions`  
Audit: `audit_logs` (canonical); `activity_logs` largely unused

## Safety
- No production reset/truncate
- Additive `CREATE OR REPLACE` preferred for function fixes
