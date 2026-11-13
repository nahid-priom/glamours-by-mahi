# 02 — Image Fidelity

## References inspected
- Dashboard Reference A (attached JPG)
- POS Reference B (attached JPG)

## Implementation mapping
| Reference element | Implementation | Evidence |
|-------------------|----------------|----------|
| Navy sidebar + pink active | `AppSidebar` gradient `#0f172a`→`#1e2139`, pink active | e2e screenshot |
| 4 primary KPIs | Dashboard row 1 | `dashboard-1366.png` |
| 6 secondary KPIs | Dashboard row 2 | same |
| Sales & Collection chart | `SalesOverviewChart` | same |
| Category donut | `SalesByCategoryChart` (channel fallback until mig 125) | same |
| Recent Sales / Low Stock / Quick Actions | mounted on Dashboard | same |
| POS grid + right cart | `PosPage` + `PosCartPanel` | `pos-1366.png` |
| Pay & Complete | POS checkout CTA | same |

## Notes
Mock ৳ values in references were not imported as data.
