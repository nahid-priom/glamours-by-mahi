# Dashboard V3.1 — Responsive QA

## Captures (inspected)

| File | Viewport | Notes |
|------|----------|-------|
| `screenshots/dashboard-360.png` | 360 | Captured |
| `screenshots/dashboard-390.png` | 390 | 2-col KPIs; pink greeting; presets; bottom nav clear |
| `screenshots/dashboard-430.png` | 430 | Captured |
| `screenshots/dashboard-768.png` | 768 | Captured |
| `screenshots/dashboard-1024.png` | 1024 | Captured |
| `screenshots/dashboard-1366.png` | 1366 | Horizontal tinted KPIs; empty chart state; category empty |
| `screenshots/dashboard-1440.png` | 1440 | Captured |
| `screenshots/dashboard-1920.png` | 1920 | Captured |
| `screenshots/dashboard-custom-range.png` | 1366 | URL date persistence |

## Comparison vs references

| Check | Desktop | Mobile |
|-------|---------|--------|
| Icon-left KPI | Pass | Pass |
| Soft card tints | Pass | Pass |
| Date presets pink active | Pass | Pass |
| Premium empty chart | Pass | Pass (period dependent) |
| No hardcoded ৳58,750 | Pass (live ৳0 / real dues) | Pass |
| Duplicate greeting | Fixed (TopHeader desktop-only) | Pass after TopHeader change |

## Overflow

No horizontal page overflow observed in Playwright captures. KPI labels may truncate on 360px (“Tod…”) — acceptable per plan readability rule.
