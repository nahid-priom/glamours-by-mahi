# Dashboard V3.1 — Transactions & RPC

## Authoritative overview

- Hook: `useDashboardOverview`
- Client: `getDashboardOverview` in `dashboard.repository.ts`
- RPC: `get_dashboard_overview` (mig 100 + 125 net profit/category)

## Period vs balance

| Metric | Scope |
|--------|-------|
| Sales / Collection / Expenses / Profit / Online / Returns | Selected `date_from`–`date_to` (Asia/Dhaka) |
| Customer Due / Supplier Due | Current outstanding balances |
| Low Stock / Total Products | Current catalog/stock state |

## Migration note (2026-11-14)

`npm run db:push:dry` against linked remote reported **Remote database is up to date** (migrations 130/131 no longer pending). No push performed this pass.

## Transactions executed this pass

**None** — local DB unavailable; production seeding refused by policy.
