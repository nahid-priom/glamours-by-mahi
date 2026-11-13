# 05 / Dashboard V2

## Components
- [`DashboardPage.tsx`](../../src/features/dashboard/DashboardPage.tsx) — Reference A layout
- Primary KPIs: Sales, Collection, Expenses, Net Profit
- Secondary KPIs: Customer Due, Supplier Due, Low Stock, Online Orders, Returns, Total Products
- Charts: Sales & Collection Overview, Sales by Category (falls back to channel until migration 125 applied)
- Panels: Recent Sales table, Low Stock, Quick Actions (permission-filtered)

## Metric sources
- RPC `get_dashboard_overview` (migration 125 updates Net Profit = Gross − expenses)
- Client fallback when RPC unavailable

## Sync
- `invalidateSaleCompletionCaches` / purchase / collection → `invalidateDashboardCaches`
