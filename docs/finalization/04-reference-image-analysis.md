# 04 — Reference Image Analysis

Images inspected: Dashboard (Reference A), POS (Reference B).

## Reference A → components
| Region | Target |
|--------|--------|
| Navy sidebar + pink active | `AppSidebar.tsx` |
| Greeting / branch / date / search | `TopHeader` + Dashboard header |
| 4 primary KPIs | `DashboardPage` row 1 + `DashboardKpiCard` |
| 6 secondary KPIs | `DashboardPage` row 2 |
| Sales & Collection chart | `SalesOverviewChart` |
| Sales by Category | New category series (not channel) |
| Recent Sales | Dedicated table (from recent sales RPC) |
| Low Stock | `LowStockCard` |
| Quick Actions | Mount `QuickActions` (update actions to match ref) |

## Reference B → components
| Region | Target |
|--------|--------|
| Catalog + search/barcode | `PosPage`, `PosBarcodeInput` |
| Category filters | POS category chips |
| 4-col product grid | `PosProductCard` grid |
| Right cart | `PosCartPanel` |
| Payment + Hold/Print/Pay | Cart footer + `complete_pos_sale` |

## Non-data
Sample ৳ amounts, invoice IDs, and product names in mockups are illustrative only.
