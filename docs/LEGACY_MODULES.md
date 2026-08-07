# Legacy / unmounted modules

Supabase is the single production source of truth. The following islands remain in the repo for reference but must not be remounted.

## `src/features/fraud`

- **Status:** Incomplete client-only demo (localStorage rules/API).
- **Action:** Do not mount admin UI. Storefront checkout no longer calls the mock fraud engine.
- **Future:** Server-side fraud review would need tables, RLS, RPCs, and permissions — out of current readiness scope.

## `src/features/invoices`

- **Status:** Duplicate of sales detail + `/print/sales/*` + `/public/invoice/:token`.
- **Action:** Do not mount. Prefer sales history and print routes.

## `src/features/erp` + `src/database`

- **Status:** Legacy localStorage “ERP DB” (comments may say IndexedDB; implementation is localStorage).
- **Action:** Not wired into `src/app/routes`. Do not remount. Delete only after zero production imports.

## `src/features/storefront/legacy-oms` + `@/services/*` peekDatabase consumers

- **Status:** Mostly dead; account orders were rewired to `track_online_order`.
- **Action:** Prefer Supabase repositories for any remaining live callers.

## Print report mock path

- `/print/reports/:reportType` remains permission-gated (`reports.read` / `reports.print`).
- Prefer Supabase-backed report print services over `reports.service` mock builders.
