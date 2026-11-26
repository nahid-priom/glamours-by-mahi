# Reports V4 — System Audit (Full Re-Implementation)

**Date:** 2026-11-26  
**Scope:** Glamorous Gallery By Mahi ERP — `src/features/reports`, Accounts/Inventory/Courier authorities, migrations/types  
**Stance:** Prior V4 landing treated as draft; this audit drives the rebuild.

---

## 1. Route inventory (mounted)

Parent gate: `PermissionRoute permission="reports.read"`.

| Route | Component | Purpose |
|---|---|---|
| `/reports` | `ReportsHubPage` | BI hub |
| `/reports/sales` | `SalesReportPage` | Sales register |
| `/reports/purchases` | `PurchasesReportPage` | Purchase register |
| `/reports/inventory` | `InventoryReportPage` | Stock balance |
| `/reports/customer-due` | `CustomerDueReportPage` | Receivables |
| `/reports/supplier-due` | `SupplierDueReportPage` | Payables |
| `/reports/top-customers` | `TopCustomersReportPage` | Customer ranking |
| `/reports/profit` | `ProfitReportPage` | P&L (+ nested accounts/profit_loss gate) |
| `/reports/branch` | `BranchReportPage` | Branch sales volume |
| `/reports/salesperson` | `SalespersonReportPage` | Staff sales volume |
| `/reports/product-performance` | `ProductPerformanceReportPage` | Product/variant margin |
| `/reports/courier` | `CourierReportPage` | Parcel ops KPIs |
| `/reports/courier-returns` | `CourierReturnsReportPage` | Courier return **requests** |
| `/reports/returns` | `SalesReturnsReportPage` | Posted sale returns |
| `/reports/channels` | `ChannelsReportPage` | `order_source` performance |
| `/reports/inventory-valuation` | `InventoryValuationReportPage` | WAC valuation |
| `/reports/cod-settlement` | `CodSettlementReportPage` | Courier settlements |
| `/reports/variant-performance` | Navigate → product-performance?level=variant | Alias |
| `/reports/products` | → product-performance | Compat |
| `/reports/branches` | → branch | Compat |
| `/reports/accounts` | → `/accounts/profit-loss` | Compat |
| `/reports/hr` | → `/hr/payroll/reports` | Compat |
| `/reports/dues` | → `/accounts/dues` | Compat |
| `/reports/cash-book` | → `/accounts/transactions` | Compat |

**Not mounted:** `/reports/stock-aging` (registry gated). Bangla cash “হিসাব স্টেটমেন্ট” UI **not in this repo**.

---

## 2. Ownership matrix

| Report | Route | Data authority | Date semantics | Branch | Permissions | Export | Issues → resolution |
|---|---|---|---|---|---|---|---|
| Hub KPIs | `/reports` | `get_profit_loss_report`; `customers.current_due`; valuation summary | Period (P&L) vs as-of (dues/stock) | Active branch for P&L/valuation | reports.read + domain extras | — | Mislabel sell value as WAC → use purchase cost |
| Sales | `/reports/sales` | completed `sales` + posted `sale_returns` for KPI | `completed_at` / return `created_at` | Filterable | reports.read | CSV+print | Filters unwired → wire branch/search/status |
| Returns | `/reports/returns` | `sale_returns` approved/completed | `created_at` | Filterable | reports.read | CSV | Thin → deepen filters + line detail where columns exist |
| Purchases | `/reports/purchases` | completed `purchases` | `completed_at` | Filterable | reports.read | CSV | Wire search/supplier filters |
| Inventory | `/reports/inventory` | `inventory_balances` | As-of | Filterable | reports.read; cost gated | CSV | Silent limit 500 → paginate + totals |
| Valuation | `/reports/inventory-valuation` | `get_inventory_valuation_*` | As-of | Active/optional | valuation/price/accounts | CSV | Label cost vs sell value correctly |
| Stock aging | (gated) | None reliable for remaining-stock age | — | — | — | — | Remain gated |
| Customer due | `/reports/customer-due` | `customers.current_due` + `get_party_due_aging` | As-of | Org | reports.read | CSV | Label dual metrics; add search |
| Supplier due | `/reports/supplier-due` | `suppliers.current_due` + aging RPC | As-of | Org | reports.read | CSV | Same |
| P&L | `/reports/profit` | `get_profit_loss_report` | Period | Branch | accounts/profit_loss | Accounts UI | Keep canonical |
| Branch / Salesperson | `/reports/branch|salesperson` | Aggregate completed sales | Period | Attribution | reports.read | CSV | Include unassigned; full-set agg |
| Product / Variant | `/reports/product-performance` | `sale_items` × sales historical cost | Period | Filterable | cost columns gated | CSV | Returns netting; weighted margin |
| Channels | `/reports/channels` | `sales.order_source` | Period | Filterable | reports.read | CSV | Drop free-text `channel` fallback |
| Courier | `/reports/courier` | `get_courier_report` | Period | Org | reports.read + courier.read | CSV | Align perms; COD ≠ settlement |
| Courier returns | `/reports/courier-returns` | `courier_return_requests` | Period | Org | reports.read | CSV | Ops ≠ financial returns |
| COD settlement | `/reports/cod-settlement` | `courier_settlements` | Period | Org | reports.read | CSV | Status filter; delivered ≠ settled |
| Payroll / Commissions | redirects | HR / commission modules | — | — | module perms | Module | Hub deep-links only |

---

## 3. Authority verification

| Domain | Canonical | Notes |
|---|---|---|
| P&L | `get_profit_loss_report` | Do not duplicate |
| Party aging | `get_party_due_aging` | Invoice due buckets ≠ party `current_due` |
| Courier ops | `get_courier_report` | Delivered COD ≠ settled |
| Reconciliation | `get_reconciliation_report` | Accounts only |
| Inventory valuation | `get_inventory_valuation_summary` (+ branch) | `total_stock_value` = sell; `total_stock_purchase_cost` = WAC |
| Channel | `sales.order_source` | Enum SSOT |
| Returns (financial) | `sale_returns` approved/completed | Not courier requests |
| COD settle | `courier_settlements` | Read model |

Stock aging: provenance tables exist under inventory/supplier 360 but **no remaining-stock age report SSOT** — feature stays gated.

---

## 4. Orphans / legacy

| Artifact | Status | Action |
|---|---|---|
| `ReportsPage.tsx` + `reports.service.ts` + mock `ReportFilters` / `reports.types` | Unmounted mock OMS | Remove after verifying no live imports |
| `report-print.service.ts` + `PrintReportA4` | Mock print builders | Quarantine/remove if only mock consumers |
| `features/sales/SalesReportsPages.tsx` + `erp/ErpRoutes.tsx` | Not in app router | Leave or delete if unused |
| `services/reporting.service.ts` | Used by dashboard | Keep; do not wire to `/reports` hub |

---

## 5. Priority defects for rebuild

1. Hub inventory KPI uses sell-value field labeled as WAC  
2. Channel aggregator falls back to free-text `channel`  
3. Inventory report silent `.limit(500)`  
4. Registry `supportedFilters` mostly unwired; no mobile filter sheet  
5. Courier page lacks export; RPC needs `courier.read`  
6. Cost columns must not export without cost permissions  
7. Stock-aging remains gated (correct)

---

## 6. Non-goals confirmed

- No second accounting engine / reporting DB  
- No fabricated stock age or Bangla cash-statement UI  
- No destructive migrations / production apply without auth  
- No fake financial seeds in live client DB
