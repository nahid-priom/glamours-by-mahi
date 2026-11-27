# V6 release report — interim

## Executive result

**Overall status: PARTIALLY COMPLETE. Release readiness: blocked.** Local checkout on `main`; frontend and linked Supabase reference both point to `vahqinuminrcjpussimn`. Read-only production metadata and aggregate checks were performed; no production mutation was performed. The E2E configuration claims `staging-isolated` while its database URL points to the same project reference and enables mutating tests. A distinct staging database, Edge Function deployment status, backup strategy, business UAT, and production authorization have not been verified.

## Bug resolution summary

The 18 individually tracked items in [V6_BUG_REGISTER.md](./V6_BUG_REGISTER.md) total: **0 fixed and verified, 5 implemented with verification pending, 10 partially fixed, 0 blocked, 3 not fixed**. The missing safe verification environment is a release blocker; individual unfinished items retain their implementation status.

## Confirmed causes and code changes

- Calendar month reset on controlled start-date update: corrected `src/components/date-picker/AppDatePicker.tsx`.
- First minute of a Dhaka calendar day omitted from timestamp bounds: corrected `src/lib/datetime/bd.ts` and its unit test.
- Reports hub, account overview and Profit & Loss kept separate local date ranges: connected them to the shared URL filter hook and added date-aware report and transaction links. Date parsing now rejects impossible calendar dates.
- Customer and supplier ledger tabs used native date inputs and mixed local/UTC conversion; both now use the shared picker and Dhaka bounds. A category duplicate error is mapped to actionable text while coded Postgres 23505 errors retain generic safe copy.
- Supplier payment UI now respects the configured advance policy. Prepared `supabase/migrations/20260315000162_supplier_payment_journal_account.sql` for future payment posting; it is not deployed.
- Courier settlements now expose the existing reversal RPC for settled records with a required reason and server permission checks. Staging accounting tests are still required.
- Prepared `supabase/migrations/20260315000163_employee_access_revocation.sql` to revoke linked profile access on future employee inactivity, termination, or archive; it is not deployed.
- Prepared `supabase/migrations/20260315000164_store_archive_visibility.sql` so settings administrators can view archived branches; store mutation controls now match the live `settings.manage` RLS requirement. Server-side archive dependency checks remain absent.
- Supplier profile deactivation used soft deletion and hid its own historical dues through RLS. It now toggles active/inactive status through the existing authorized supplier update, preserving history and allowing reactivation.
- Missing breadcrumbs for employee detail, commission settings, inventory valuation, and COD settlement: corrected `src/components/breadcrumbs/breadcrumb-registry.ts`; employee detail now publishes its name through `src/features/hr/pages/EmployeeDetailPage.tsx`.
- Employee default list included terminated records: default filter changed to active in `src/features/hr/pages/EmployeesPage.tsx`.
- Added breadcrumb and date picker component tests. No implementations were removed or consolidated; no dependencies were changed.

The reported 400/403 causes remain hypotheses until actual response bodies, SQLSTATE, and caller identity are examined. The `admin-create-user` preflight returned HTTP 404 `NOT_FOUND` from the live gateway, confirming the endpoint is unavailable despite source code. Read-only live metadata verified RLS and authenticated UPDATE grants on relevant tables. The deployed supplier payment function and aggregate accounting rows confirmed a bank/mobile chart-account mismatch. No database migration, policy, grant, function, or Edge Function was applied or deployed.

## Security and accounting

Source and live policies/RPC privileges were inspected. No named-user authorized/unauthorized action matrix or cross-organization test was run. No production financial transaction was changed. Aggregate read-only results: 7 bank and 3 mobile posted supplier payments lack a matching chart-account journal credit; 0 supplier-payment journals were unbalanced. Three courier-settlement journal source groups and three supplier-ledger reference groups warrant reviewed investigation. See [V6_PERMISSION_MATRIX.md](./V6_PERMISSION_MATRIX.md) and [V6_ACCOUNTING_RECONCILIATION.md](./V6_ACCOUNTING_RECONCILIATION.md).

## Automated QA and browser QA

Cursor's Node 24 binary ran TypeScript `tsc -b --pretty false` successfully. Full Vitest: **63 files and 296 tests passed**. Full oxlint exited 0 with existing warnings; focused changed-file lint was clean. Vite production build and build-integrity check passed (312 assets, 6.74 MB). npm and node were absent from shell PATH, so equivalent installed CLIs were invoked with Cursor's Node binary. A repository Playwright route-smoke attempt ran 18 cases; **all 18 failed before application assertions** because the Chromium headless-shell executable was missing. The suite's obsolete `/login` paths were corrected to `/admin/login` afterward; the browser executable remains unavailable, so it has not yielded acceptance evidence. No test was disabled. DB/integration/E2E, authenticated browser workflows, all requested responsive viewports, and performance comparisons are pending.

Integrated-browser checks reached the local `/admin/login` page and confirmed unauthenticated direct navigation to `/stores`, `/reports/cod-settlement?from=2024-02-29&to=2024-03-01&status=pending`, and `/hr/employees/:id` redirects to the admin login page. This confirms only the unauthenticated guard, not the protected page content or breadcrumb. At 390px and 1440px the admin login page had no document-level horizontal overflow. The public home page loaded at desktop width. No authenticated mutation or production browser transaction was attempted. No test outcome has been inferred from source inspection.

## Change inventory and duplication cleanup

Modified code: shared date picker and Dhaka date utility, report filter hook, report hub, account overview and Profit & Loss pages, customer and supplier ledger tabs, breadcrumb registry and employee detail page, employee list, supplier profile status controls, supplier payment page, courier settlement page, stores page, RPC error text, and the route smoke test. Added focused tests for breadcrumbs, date picker behavior, report URL persistence, and Dhaka dates. Added three **unapplied** versioned migrations and seven V6 audit documents. No code implementation, RPC, dependency, or historical migration was removed; suspected duplication remains listed in [V6_DUPLICATION_AUDIT.md](./V6_DUPLICATION_AUDIT.md).

## Database and Edge Function changes

`20260315000162_supplier_payment_journal_account.sql` prepares a correction to `pay_supplier` journal account mapping and transaction-key concurrency control; an orphaned prior financial transaction now raises an error for reviewed reconciliation instead of silently reconstructing ledger effects. `20260315000163_employee_access_revocation.sql` prepares linked-profile deactivation on employee lifecycle changes. `20260315000164_store_archive_visibility.sql` prepares admin visibility for archived branches. **All three exist only in the local checkout.** No table, function, policy, trigger, index, constraint, or Edge Function was changed in a database environment. The source `admin-create-user` Edge Function was not deployed; its live gateway preflight remains 404.

## Performance

The local production bundle completed at 6.74 MB across 312 assets. No baseline request count, comparable prior bundle, database execution timing, or authenticated route trace was collected, so no performance improvement is claimed.

## Deployment and recovery

Do not deploy this release. First replace the mislabeled E2E target with a distinct verified staging project. Verify the backup, test both prepared migrations there, including cash/bank/mobile and concurrent payment retries plus employee access revocation. Deploy any required Edge Functions with correct secrets, deploy frontend to staging, complete the 18-item acceptance register and business UAT, then obtain production authorization. Historical supplier journal corrections require separate review. Recovery must use forward migrations or a verified backup according to the affected operation; no database change was applied here.

## Remaining issues and verdict

Three items have no implementation, ten are partial, and five await environment/browser verification. The functional, security, accounting, architecture, UI, engineering, and deployment gates remain open. **Final verdict: PARTIALLY COMPLETE.**
