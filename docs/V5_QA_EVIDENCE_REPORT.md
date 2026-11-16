# V5.1 Automated QA — Evidence Report

**Date:** 2026-11-16  
**Scope:** Blocker resolution & test integrity (staging `TEST_DATABASE_URL`, no production reset)

## Root causes (confirmed)

1. **Database BLOCKED:** Docker not installed (`docker: command not found`); local `:54322` unreachable. Prior smoke runner never executed via `TEST_DATABASE_URL`.
2. **Production URL risk:** `.env.local` `DATABASE_URL` matches production project ref `vahqinuminrcjpussimn` — **refused** as QA target (never silent fallback).
3. **Cross-module BLOCKED:** Mutating flows require `ALLOW_MUTATING_E2E=true` + safe staging DB; prior suite was mostly navigation shells.
4. **Misleading PASS:** Inventory UI smoke was labeled “reconciliation”; component/integration overlapped unit Vitest; skipped RBAC cashier counted as soft skip.

## Files modified (high level)

- `scripts/run-db-smoke.mjs`, `scripts/qa/db-url-safety.mjs`, `scripts/qa/preflight.mjs`
- `scripts/qa/seed-staging-fixtures.mjs`, `scripts/qa/cleanup-staging-fixtures.mjs`, `scripts/qa/inventory-db-recon.mjs`
- `scripts/qa/run-full-suite.mjs`, `package.json`, `.env.e2e.example`, `playwright.config.ts`
- `e2e/helpers/db.ts`, `e2e/critical-flows/*`, `e2e/rbac/*`, `e2e/auth/owner-login.spec.ts`, `e2e/sales/exchange-cases.spec.ts`
- Lint/hooks: `StockLedgerPage.tsx`, `ProductForm.tsx`, `ProductCreateWizard.tsx`, `VariantOpeningStockTable.tsx`, `PWAProvider.tsx`, `usePWAInstall.ts`
- `pg` added as devDependency for staging SQL

## Database connection result

| Check | Result |
|-------|--------|
| Docker / local Supabase | **Unavailable** |
| `TEST_DATABASE_URL` | **Unset** at evidence time → DB phase **BLOCKED** |
| Production `DATABASE_URL` | Detected + **refused** for QA |
| `npm run test:db` without staging URL | Exit **nonzero** (honest) |

**Operator action for green DB phase:** set isolated staging `TEST_DATABASE_URL` + `TEST_ENVIRONMENT_ID=staging-…` in `.env.e2e.local`, then `npm run test:db` / `npm run qa:seed`.

## Migration / SQL tests

- Existing P0/RLS/acceptance scripts unchanged; runner now prefers safe `TEST_DATABASE_URL`.
- Inventory SSOT contract SQL retained; recon script `scripts/qa/inventory-db-recon.mjs` compares balances/ledger when DB ready.

## Transaction E2E / RLS

- Critical flows: read-only shells execute when OWNER auth ready; mutating subset **BLOCKED** without staging gate.
- DB helper queries `inventory_balances` / `stock_ledger` when URL safe.
- Cashier seed creates disposable auth user + role **without** `inventory.valuation` / admin permissions; cleanup is `TEST_RUN_ID`-scoped.
- RLS not disabled.

## Inventory reconciliation

- Phase **14** = Inventory **UI smoke** (honest label).
- Phase **14b** = Inventory **DB reconciliation** (BLOCKED without `TEST_DATABASE_URL`).

## Exchange cases

- `e2e/sales/exchange-cases.spec.ts` covers TC-SALE-EXCH-E / N / R.

## Remaining skips / blockers

| Item | Status |
|------|--------|
| DB SQL against staging | BLOCKED until `TEST_DATABASE_URL` provided |
| Mutating E2E-02/04/22 full posting | BLOCKED / NOT TESTED without mutating gate + form seed |
| Supplier `view=suppliers` | NOT IMPLEMENTED / BLOCKED |
| Print output accuracy | Shell smoke only — not proof of PDF/receipt bytes |
| Extra personas (accountant, etc.) | NOT TESTED |

## Lint

Prioritized hook dependency warnings addressed in listed files. Remaining repo-wide oxlint warnings (export-components, seed unused vars) are non-blocking noise — not claimed zero.

## Latest full-suite snapshot (V5.1 orchestrator)

Honest overall: **FAIL** while staging DB URL unset (expected).

| Phase | Status |
|-------|--------|
| 01–07, 09, 11–12, 14, 16–17 | PASS (after responsive/RBAC fixes) |
| 08 Database | **BLOCKED** — no safe `TEST_DATABASE_URL` |
| 10 RBAC cashier matrix | **BLOCKED** — seed requires staging DB |
| 13 Cross-module mutating | **BLOCKED** — `ALLOW_MUTATING_E2E` + DB gate |
| 14b Inventory DB recon | **BLOCKED** — same DB prerequisite |
| 15 Responsive | PASS (retest: single-project viewport loop) |

Exchange TC-SALE-EXCH-E/N/R: **PASS** on desktop retest.

## Production readiness recommendation

**Not release-ready as a green `npm run test` gate** until:

1. Isolated staging `TEST_DATABASE_URL` is configured and `npm run test:db` + `14b` PASS  
2. `ALLOW_MUTATING_E2E=true` on that staging tenant and critical mutating flows assert ledger/balance deltas  
3. Cashier seed succeeds and RBAC denial matrix PASS  

Until then, overall **FAIL/BLOCKED is the correct trustworthy signal** — do not treat UI shell PASS as business-integrity proof.

## How to unlock

```bash
# .env.e2e.local (gitignored)
TEST_ENVIRONMENT_ID=staging-isolated
TEST_DATABASE_URL=postgresql://…   # staging only — never production ref
ALLOW_MUTATING_E2E=true
OWNER_EMAIL=…
OWNER_PASSWORD=…

npm run qa:seed
npm run test:db
npm run test:inventory:db
npm run test
npm run qa:cleanup
```
