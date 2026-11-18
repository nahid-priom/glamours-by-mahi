# QA Evidence — Supplier Management 360

**Date:** 2026-11-18

## Commands executed

| Command | Result |
|---------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (pre-existing warnings only; no new errors) |
| `npm run build` | Pass |

## Not executed in this session

- Live Supabase migration apply against production
- Browser visual screenshot comparison vs reference image
- End-to-end Playwright supplier flows
- SQL smoke `supabase/tests/sql/supplier_360_smoke.sql` against live DB

## Unverified / blocked until migration

1. Directory/card RPCs require `00155` applied
2. Ledger statement RPC requires `00154` applied
3. Document upload requires storage bucket from `00155`
4. Opening-sign / party-sync apply requires accounts.manage + explicit confirmation
5. Velocity badges empty until `get_supplier_stock_velocity` deployed

## Production readiness

**Requires Migration** + **Requires Manual Verification** after migrate:
- Apply `20260315000154_supplier_360_financial_integrity.sql`
- Apply `20260315000155_supplier_360_profile_directory_stock.sql`
- Dry-run then apply supplier repairs in Reconciliation Center
- Spot-check Directory, Ledger, Stock, Details at 1366px and mobile
