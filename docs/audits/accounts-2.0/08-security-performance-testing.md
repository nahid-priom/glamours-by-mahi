# REPORT 8 — Security, Performance & Testing

## Existing RBAC matrix (Accounts-relevant)

| Permission | Typical use | UI gate | Backend |
|---|---|---|---|
| `accounts.read` | View accounts area | Parent `PermissionRoute` | RLS + `user_has_permission` in RPCs |
| `accounts.post` | Post money / collect-pay | Many mutate buttons | RPC checks |
| `accounts.manage` | Admin/settings/closing | Settings, some closes | RPC checks |
| `income.create` / `expense.create` | Create IE | Nav + pages | RPC |
| `customer_due.collect` / `supplier_due.pay` | Due actions | Nav + row actions | RPC |
| `daily_closing.create` | Close day | Nav only (page gate mismatch) | RPC |
| `profit_loss.read` | P&L | Nav | Page has no extra gate |
| `reconciliation.*` | Recon tools | Sidebar | RPC |
| `transactions.void` | Void FT | Expense voids etc. | RPC |

**VERIFIED:** Catalog in `src/lib/permissions/catalog.ts`; SQL permission seeds in early org migrations; RPC denial patterns in simple accounting / party RPCs.

**Gap:** Page-level permission sometimes weaker than nav (P&L, Transactions, Reconciliation pages rely on parent `accounts.read` only). Closing button ignores `daily_closing.create`.

## Recommended target RBAC (PROPOSED)

Keep existing permission strings; map hubs:

| Hub action | Permissions (any-of) |
|---|---|
| View Accounts Management | `accounts.read` |
| Mutate FA / transfer | `accounts.post` or `accounts.manage` |
| Income/Expense | `income.create` / `expense.create` |
| Due Management view | `accounts.read` + (`customer_due.collect` \| `supplier_due.pay` \| manage) |
| Collect / Pay | existing collect/pay + post |
| P&L view | `profit_loss.read` (enforce on page, not only nav) |
| Daily close | `daily_closing.create` **or** manage/post (align) |
| Recon apply | `reconciliation.apply` |

## Audit trail assessment

| Trail | Present |
|---|---|
| Financial transactions | Yes |
| Party ledgers | Yes |
| Journals | Yes |
| Payment allocations | Yes |
| Daily closing records | Yes |
| Recon dry-run logs | Partial / tool-based |

## Performance risks (INFERRED from code)

| Risk | Evidence | Severity |
|---|---|---|
| P&L loads all completed sales in range then chunks sale_items by 200 | `sumCompletedSales` + `sumSaleItemsCost` | P2 for large orgs |
| Transactions default limit 100; client search filter | `listTransactions` | P2 |
| Dashboard fallback without COGS | `dashboard.repository.ts` | P1 correctness if used |
| Due lists select all parties with due>0 | simple repo | P2 at scale |
| N+1 uncommon in accounts (batch selects) | repo patterns | Low |
| Missing indexes | Existing FT branch_date indexes in `00011` | Monitor aging queries when added |

**PROPOSED:** Server-side P&L RPC with date/branch indexes; paginate dues; never ship unpaginated lifetime FT dumps on hub.

## Test coverage matrix

| Area | Tests found | Executed this audit? | Classification |
|---|---|---|---|
| Payment account resolve | `src/lib/payments/__tests__/resolve-payment-account.test.ts` | No | Existing, not executed |
| Permissions catalog | `src/lib/permissions/catalog.test.ts` | No | Existing, not executed |
| Accounting unified wrappers | `src/features/accounting/repositories/unified-core-wrappers.test.ts` | No | Existing, not executed |
| Routes smoke includes accounts | `src/app/routes/routes.smoke.test.ts` | No | Existing, not executed |
| DB recon / party ledger smokes | `supabase/tests/**`, scripts | No | Existing, not executed |
| E2E accounts flows | **None named** under `e2e/**account*` | — | Missing |
| Deposit ≠ income invariant | — | — | Missing |
| Transfer P&L-neutral | — | — | Missing |
| Collect does not increase sales revenue | — | — | Missing |
| Pay supplier does not create expense_entry | — | — | Missing |
| P&L GP reconciliations | — | — | Missing |
| Aging buckets | — | — | Missing (feature missing) |
| Daily closing blank counted | — | — | Missing |
| Mobile accounts UX | — | — | Missing |

**Rule honored:** No claim that tests pass; none were executed in this audit session.
