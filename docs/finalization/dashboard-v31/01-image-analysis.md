# Dashboard V3.1 — Image Analysis

**References inspected:**
- Desktop: `Glamorous_Gallery_Executive_Dashboard-1`
- Mobile: `Glamorous_Gallery_Mobile_Dashboard-2`

Reference KPI figures (৳58,750 etc.) are **design examples only** — never hardcode.

## Desktop hierarchy

1. Navy sidebar (~260px), pink active Dashboard
2. TopHeader greeting + branch + date label + notifications/profile
3. Date preset pills (Today active pink) + Quick Actions
4. Four primary KPI cards (horizontal icon | amount)
5. Six secondary KPI cards (compact)
6. Sales/Collection dual-line chart (8 cols) + Category donut (4 cols)
7. Recent Sales (5) / Low Stock (4) / Quick Actions 3×2 (3)

## Mobile hierarchy

1. MobileTopBar (menu, brand, bell, avatar)
2. Greeting + soft pink wash
3. Branch + date selectors
4. 2-column KPI grid
5. Full-width chart with empty state “No sales data in this period.”
6. Recent Sales / Low Stock link rows
7. Quick Action tiles (2×2 preferred)

## Visual checklist (implementation targets)

| Item | Target |
|------|--------|
| KPI icon left of amount | Required |
| Soft tinted primary cards | rose/green/amber/blue |
| Duplicate greeting | Remove from DashboardPage on desktop |
| Date presets URL-backed | Keep `date_from`/`date_to` |
| Sales chart | Pink + blue lines; premium empty |
| Category chart | Real categories only; no channel relabel |
| Mobile 2-col KPIs | No zoomed desktop |
| Quick Actions permission-gated | No dead buttons |
