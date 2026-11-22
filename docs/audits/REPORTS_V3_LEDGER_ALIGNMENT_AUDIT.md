# REPORTS V3 — Ledger Alignment Audit

**Project:** Glamorous Gallery by Mahi  
**Date:** 2026-11-22  
**Authority:** `reports.routes.tsx`, `reports.repository.ts`, Accounts 2.0 RPCs  
**Canvas baseline:** `reports-routes-ledger-audit.canvas.tsx`

## Classification legend

| Class | Meaning |
|---|---|
| Operational | Document/ops SSOT (sales, stock, courier) |
| Financial | Accounting authority (P&L, FT, party due) |
| Mixed | Operational register with financial fields |
| Redirect | Alias to another surface |
| Broken | Dead route / orphan UI |
| Incomplete | Live but missing required authority/filters |

---

## Route inventory

### `/reports` — Hub

| Field | Value |
|---|---|
| Component | `ReportsHubPage` |
| Source | `src/features/reports/pages/ReportsHubPage.tsx` |
| Query/RPC | None (links only) |
| Class | Incomplete → Report Center |
| Permission | `reports.read` |
| Gaps | Flat tiles; no finance permission gating; no cash-book entry |
| Fix | Categorized hub; permission-aware tiles |
| Risk | Low |

### `/reports/sales`

| Field | Value |
|---|---|
| Component | `SalesReportPage` |
| Repository | `reportsRepository.salesReport` → `sales` completed |
| Class | Operational / Mixed |
| Authority | Completed sales documents |
| Filters | Date range (BD bounds) |
| Export | CSV via `exportReportCsv` |
| Gaps | Client load of period rows; no returns view; settlement ≠ cash book |
| Fix | Keep docs SSOT; KPI from full filter; credit ≠ cash note |
| Risk | Medium (pagination) |

### `/reports/purchases`

| Field | Value |
|---|---|
| Component | `PurchasesReportPage` |
| Repository | `purchases` completed |
| Class | Operational / Mixed |
| Gaps | No payment register; purchase ≠ OpEx |
| Fix | Status columns; link payments elsewhere |
| Risk | Low |

### `/reports/inventory`

| Field | Value |
|---|---|
| Component | `InventoryReportPage` |
| Repository | `inventory_balances` qty>0 |
| Class | Operational / Incomplete |
| Gaps | No WAC valuation; selling price must not be GL |
| Fix | Qty + optional `get_inventory_valuation_summary` when permitted |
| Risk | Medium |

### `/reports/customer-due`

| Field | Value |
|---|---|
| Component | `CustomerDueReportPage` |
| Repository | `customers.current_due` |
| Class | Financial |
| Authority | Party AR posting |
| Gaps | No aging; no ledger drill-down |
| Fix | Reuse `get_party_due_aging` + deep links |
| Risk | Low |

### `/reports/supplier-due`

| Field | Value |
|---|---|
| Component | `SupplierDueReportPage` |
| Repository | `suppliers.current_due` |
| Class | Financial |
| Gaps | Same as customer due |
| Fix | Aging + deep links |
| Risk | Low |

### `/reports/top-customers`

| Field | Value |
|---|---|
| Component | `TopCustomersReportPage` |
| RPC | `list_top_customers` |
| Class | Operational / Mixed |
| Gaps | Rating vs spend must stay labeled |
| Fix | Preserve metrics; customer links |
| Risk | Low |

### `/reports/profit` — **P0**

| Field | Value |
|---|---|
| Component | `ProfitReportPage` |
| Current | `reportsRepository.profitReport` = sales − line COGS |
| Class | Financial / Broken calculation |
| Canonical | `get_profit_loss_report` |
| Gaps | Ignores returns, other income, expenses; conflicts with `/accounts/profit-loss` |
| Fix | Reuse Accounts P&L + finance permission gate |
| Risk | High (user trust) |

### `/reports/branch` / `/reports/salesperson` / `/reports/product-performance`

| Field | Value |
|---|---|
| Class | Operational / Incomplete |
| Authority | Completed sales / sale_items |
| Gaps | UUID labels; no returns; product page lacks margin |
| Fix | Name resolution; historical cost margin; return handling where reliable |
| Risk | Medium |

### `/reports/courier` / `/reports/courier-returns`

| Field | Value |
|---|---|
| Class | Operational |
| Authority | `get_courier_report` / `courier_return_requests` |
| Gaps | Must not auto-post AR/stock/P&L |
| Fix | Keep ops; link sale return when related |
| Risk | Low |

### Redirects

| Route | Target | Class |
|---|---|---|
| `/reports/products` | product-performance | Redirect |
| `/reports/branches` | branch | Redirect |
| `/reports/accounts` | `/accounts/profit-loss` | Redirect (preserve query) |
| `/reports/hr` | was `/hr/payroll` → should be `/hr/payroll/reports` | Redirect / Incomplete |
| `/reports/dues` | **missing** (breadcrumb only) | Broken |
| `/reports/cash-book` | **missing** | Incomplete |

### Related (outside reportsRoutes)

| Route | Class | Notes |
|---|---|---|
| `/accounts/profit-loss` | Financial | Canonical P&L |
| `/accounts/transactions` | Financial | Cash book SSOT |
| `/accounts/dues` | Financial | Due management |
| `/hr/payroll/reports` | Operational | HR payroll report |
| `/print/sales/report` | Operational | Live sales repo |
| `/print/reports/:type` | Broken/Legacy | Mock `reports.service` |

### Orphans

| Artifact | Class |
|---|---|
| `SalesReportsHubPage` + 7 nested `/reports/sales/*` links | Broken (unmounted) |
| `ReportsPage` + `reports.service` mock hub | Broken (unmounted UI; print still wired) |

---

## Posting vs report visibility (summary)

| Event | Posts to | Seen by |
|---|---|---|
| Complete sale | sales, due, FT (± FA) | sales/profit/dues |
| Collection | ↓ due, FT in | dues; cash book (Accounts) |
| Purchase | purchases, AP, stock | purchases/supplier-due/inventory |
| Income/expense | entries + FT | Accounts P&L only (until profit aligned) |
| Journal | optional | Not under `/reports` |
| Courier return request | ops table | courier-returns only |

## Verdict

Reports is a **document + party-due** layer. P0 blocker: `/reports/profit` ≠ Accounts P&L. Cash book absent from Reports. Dues breadcrumb broken. Mock print path still live.
