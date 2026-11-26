# Reports V4 — Architecture

## Goals

Unified retail analytics experience over existing ERP authorities. No second accounting engine. Permission-aware hub + report pages with shared filters and export.

## Structure

```
src/features/reports/
  config/report-registry.ts     # Hub cards, search, visibility, exports
  reports.filters.ts            # Filter contract, presets, query keys
  hooks/use-report-filters.ts   # URL-synced filters
  hooks/use-report-hub-summary.ts
  components/ReportShell.tsx    # Shared header/filters/export
  components/ReportMobileFilters.tsx
  components/ReportExportMenu.tsx
  components/ReportKPIGrid.tsx
  repositories/reports.repository.ts
  pages/*                       # Mounted report UIs
```

## Hub summary

Parallel lightweight queries (not every report):

1. P&L → Net Sales + Gross Profit (`get_profit_loss_report`) when permitted
2. Customer receivables → sum `customers.current_due`
3. Inventory value → `total_stock_purchase_cost` (WAC), not sell value
4. Secondary: supplier payables, outstanding COD (pending settlements)

## Filters

- Default period: This Month (Asia/Dhaka)
- Presets: Today, Yesterday, Last 7, This Month, Last Month, This Year, Custom
- Desktop: preset chips + date range + search/status/branch
- Mobile: full-width search + Filters sheet (Apply/Reset via clear)

## Export

`reportsRepository.exportReportCsv` — same filter set as screen, formula-injection sanitized, cost columns omitted by page when unauthorized. Print via `PrintPreviewDialog` on Sales Register. Legacy `/print/reports/:type` remains a retired stub.

## Gated

`/reports/stock-aging` — no remaining-stock age SSOT.

## Compatibility redirects

`/reports/products|branches|accounts|hr|dues|cash-book` preserved.
