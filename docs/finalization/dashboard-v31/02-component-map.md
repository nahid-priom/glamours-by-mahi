# Dashboard V3.1 — Component Map

| UI region | Component / file | Change |
|-----------|------------------|--------|
| Shell sidebar | `AppSidebar` | Unchanged (preserve RBAC) |
| Shell header | `TopHeader` | Primary desktop greeting (unchanged) |
| Mobile bar | `MobileTopBar` | Unchanged |
| Page | `DashboardPage.tsx` | Mobile greeting + pink wash; desktop no duplicate greeting; preset toolbar; 2/4/6 grids |
| KPI | `DashboardKpiCard.tsx` | Horizontal icon \| amount; soft card tints |
| Sales chart | `SalesOverviewChart.tsx` | Pink/blue dual line + empty/error |
| Category chart | `SalesByCategoryChart.tsx` | Donut; no channel fallback relabel |
| Recent sales | `RecentSalesTable.tsx` | Invoice pills; compact mobile row |
| Low stock | `LowStockCard.tsx` | Qty badge; compact mobile row |
| Quick actions | `QuickActions.tsx` / `QuickActionCard.tsx` | Featured POS tile; 2–3 col grid |
| Section chrome | `DashboardSectionCard.tsx` | `title` accepts ReactNode |
| Data | `use-dashboard-overview.ts` + repository | Unchanged RPC contract |

## Removed anti-patterns

- Vertical KPI icon-above-amount stack
- Channel data labeled as Category Sales
- Dual greeting on desktop page body
