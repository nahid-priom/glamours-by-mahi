# V6 system ownership map

This map describes inspected repository ownership; live database ownership remains to verify.

| Responsibility | Current owner | Important dependent callers |
| --- | --- | --- |
| Route registration | `src/app/routes/*.routes.tsx` | Router, permission routes, direct navigation |
| Breadcrumbs | `src/components/breadcrumbs/breadcrumb-registry.ts` and label context | Dashboard layout, entity detail pages |
| Auth session | `src/features/auth/auth-session` | Permission gates, protected routes |
| Supplier payment UI | `src/features/purchases/pages/SupplierPaymentsPage.tsx` | Supplier due and account queries |
| Supplier payment mutation | `purchases.repository.ts` → `public.pay_supplier(jsonb)` | Supplier ledger, journal, financial transactions |
| Payment account resolution | `src/lib/payments/resolve-payment-account.ts` | Supplier and other payment forms |
| Courier parcel status | Courier repository → `update_courier_parcel_status` | Tracking, linked sales/orders |
| Employee records | `employees.repository.ts` | HR list/detail, payroll and auth provisioning |
| Employee login provisioning | `supabase/functions/admin-create-user/index.ts` | Administration user creation |
| Store records | `src/features/stores/stores.service.ts` → `branches` | Store UI, operational branch choices |
| Report filters | `use-report-filters.ts`, `reports.filters.ts`, shared picker | Report query keys, repositories, exports |
| Business calendar | `src/lib/datetime/bd.ts` | Report and accounting timestamp bounds |
| Query keys | `src/lib/query/keys.ts` plus feature keys | TanStack Query cache |

Confirmed architecture gaps: the employee list defaulted to all statuses; several registered routes lacked breadcrumb entries; the date picker changed the displayed month on a controlled value update; the shared Dhaka bounds omitted 00:00–00:00:59.999; the reports hub held a separate local range and discarded it on navigation. These date and navigation paths were corrected locally. Store archive and employee archive still use direct table updates. The reported 403 causes cannot be assigned without live response bodies, grants, policies, and caller context.

Customer and supplier ledger tabs also used independent native date inputs and JavaScript local/UTC conversions. They now use the shared date range picker and Dhaka bounds. Account overview and Profit & Loss held isolated local date state; both now use the existing report URL filter hook. The deployed supplier payment function and aggregate records confirmed a chart-account anomaly for bank/mobile supplier payments; see the reconciliation report.
