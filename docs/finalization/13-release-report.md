# 10 — Release Report

**Date:** 2026-11-13  
**Project:** Glamorous Gallery By Mahi ERP V2 finalization

## Implemented
- Audit docs `docs/finalization/01–05`
- Migrations 124–126 authored (activity CTE fix, dashboard net profit/category, employees RLS)
- Dashboard V2 layout + Quick Actions + Recent Sales + category chart
- POS card/checkout polish; My Workspace hidden for Super Admin/Owner
- Activity URL canonicalize; Roles/Permissions deep-links; Staff Targets copy
- E2E env via `.env.e2e.local` (gitignored); Playwright authenticated smoke expanded

## Verified
- `npm run typecheck` — pass
- `npm run lint` — pass (pre-existing warnings only)
- `npm run test` — 190/190 pass
- `npm run build` — pass
- Playwright desktop authenticated smoke — 3/3 pass
- Screenshots: `docs/finalization/screenshots/{dashboard,pos,activity}-1366.png`

## Not verified / blocked
- **Linked DB migration apply** — CLI account 403 on `vahqinuminrcjpussimn`. Owner must run SQL 124→126 in dashboard.
- Until 124 applied: Activity RPC still returns `relation "scoped" does not exist` on production.
- Until 125 applied: category series + authoritative net profit rely on client/channel fallback.
- Historical recon apply (1,153 gaps) — deferred by design
- Full payroll↔attendance rewrite — deferred
- Mobile viewport screenshot suite — not fully run (desktop smoke only)

## Production readiness verdict
**Not fully production-ready for Activity Logs / authoritative Dashboard profit until migrations 124–125 are applied on the linked project by an owner account.**

Application UI/code changes are built, tested, and ready to deploy behind that DB apply step.
Rollback for app: redeploy previous frontend. Rollback for SQL: restore prior function/policy definitions from migrations 098/115/017.
