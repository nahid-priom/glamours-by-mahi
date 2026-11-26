# Reports V4 — Release Report

## Verdict

**READY FOR STAGING ONLY**

Local typecheck, lint (warnings only), reports unit tests (8/8), and production build passed. Staging financial spot-checks, operator browser matrix, and any production migration apply (none in this change set) remain pending.

## Delivered

- Fresh system audit + SSOT + architecture docs
- Registry-driven hub with period + as-of KPIs (WAC cost, not sell-value mislabel)
- Shared filter presets, URL sync, mobile filter sheet, export menu
- Deepened sales/purchases/inventory/dues/returns/channels/COD/courier/product pages
- Inventory pagination with full-set qty/cost totals (no silent 500-only KPI)
- Channels use `order_source` only
- Courier gated on `courier.read`; COD ≠ delivered
- Stock aging remains gated
- Variant performance alias preserved
- Compatibility redirects preserved
- Removed mock OMS: `ReportsPage`, `reports.service`, mock filters/preview, `report-print.service`, `PrintReportA4`

## Not claimed

- Full EXPLAIN ANALYZE in production
- Historical stock-aging SSOT
- Production migration apply (none added)
- Full E2E browser matrix / Scenario A–H live DB
- Bangla cash-statement UI (not in repo)

## Commands executed

```text
npm run typecheck   # pass
npm run lint        # pass (pre-existing warnings)
npm run test:unit -- src/features/reports  # 8 passed
npm run build       # pass + integrity
```
