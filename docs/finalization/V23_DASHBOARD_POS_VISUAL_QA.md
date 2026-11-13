# V2.3 Dashboard & POS Visual QA

## Dashboard

| Item | Status |
|------|--------|
| Presets: Today, Yesterday, Last 7 Days, This Month, Last Month | Implemented (URL `date_from`/`date_to`) |
| Custom via date pickers | Implemented |
| Dynamic primary KPI titles | Implemented (Today’s … vs Sales/Collection/Expenses/Profit with period) |
| Balance metrics labeled current / catalog | Customer Due, Supplier Due, Low Stock, Total Products |
| Layout / navy-pink branding | Preserved |
| Playwright: Last 7 Days visible | Passed |
| Screenshots | `docs/finalization/screenshots/v23/dashboard.png` (from smoke) |

Approved reference image pixel compare: **not re-run**; prior V2.1/V2.2 refs still apply. Missing dedicated visual-diff report → do not claim pixel-perfect fidelity.

## POS

| Item | Status |
|------|--------|
| Category chips + All Products | Implemented |
| Clear search on category change | Implemented |
| Mobile cart / payment / hold / `client_txn_key` | Unchanged (preserved) |
| Screenshot | `docs/finalization/screenshots/v23/sales_pos.png` |

## Responsive

Full multi-viewport Playwright matrix (360–1920) **not re-executed** this pass; desktop smoke only. Prior `e2e/v21-visual-qa.spec.ts` remains available.
