# REPORTS V3 — Final Acceptance

**Status:** Implemented locally (code + docs + unit/smoke tests).  
**Production deployed:** No (not claimed).  
**Historical data modified:** No.

## Checklist

### Financial

- [x] `/reports/profit` uses canonical P&L (`SimpleProfitLossPage` / `get_profit_loss_report`)
- [x] Duplicate `profitReport` removed
- [x] Finance permission gate on `/reports/profit`
- [x] Cash book via `/reports/cash-book` → `/accounts/transactions`
- [x] Customer/supplier due keep `current_due` + aging RPC
- [x] Inventory cost uses WAC, not selling price
- [x] Courier returns remain operational-only

### Operational / UX

- [x] Report Center hub with groups + search + permission tiles
- [x] `/reports/dues` registered
- [x] `/reports/hr` → `/hr/payroll/reports`
- [x] Dead SalesReportsHub links retargeted
- [x] Breadcrumbs for dues/customer-due/supplier-due/top-customers/cash-book
- [x] Legacy mock `/print/reports/:type` retired

### Engineering

- [x] Shared filter contract module
- [x] Route smoke coverage for new paths
- [x] Vitest authority tests (P&L fixture, cash classification, no profitReport)

## Commands (executed 2026-11-22)

```bash
npx vitest run src/features/reports/__tests__/reports-v3-authority.test.ts src/app/routes/routes.smoke.test.ts
# → 2 files, 17 tests passed

npx tsc --noEmit -p tsconfig.json
# → exit 0
```

## Remaining / out of scope

- Full mutating E2E fixtures B–G against live Supabase (needs staging gate)
- Accounts deposit/withdraw P&L UX defect (documented earlier; not rewritten here)
- Production deploy
