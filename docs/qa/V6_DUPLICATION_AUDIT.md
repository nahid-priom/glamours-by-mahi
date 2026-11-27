# V6 duplication audit

This is an initial source audit. No historical database object or financial row was removed.

| Finding | Existing implementations | Authoritative owner / action | Verification needed |
| --- | --- | --- | --- |
| Date shortcuts | `reports.filters.ts` presets and `AppDatePicker.tsx` shortcuts | Shared Dhaka calendar utility; customer/supplier ledger custom fields now use shared picker and bounds; broader consolidation pending | Compare all report, account, and export paths |
| Route definitions and labels | Router modules and breadcrumb registry | Router remains route authority; registry contains presentation trails | Full route-to-breadcrumb comparison |
| Supplier payment revisions | Multiple historical `pay_supplier(jsonb)` migration definitions | Latest deployed version must be determined from live migration history; do not edit old migrations | Function body/signature, dependencies, grants, reconciliation |
| Store lifecycle | Direct `branches` updates in `stores.service.ts` | Needs a server-side, dependency-aware operation | Cross-org and race tests |
| Employee lifecycle | Direct `employees` update in repository | Needs linked-account and historical dependency handling | RLS and session revocation tests |

No component, hook, service, package, migration, RPC, trigger, policy, or record was deleted. Similar names alone are not evidence of unnecessary duplication.

A read-only live aggregate check found 3 repeated posted courier-settlement journal source groups and 3 repeated supplier-ledger reference groups; see [V6_ACCOUNTING_RECONCILIATION.md](./V6_ACCOUNTING_RECONCILIATION.md). These are investigation candidates, not confirmed erroneous duplicates. No historical row was changed.
