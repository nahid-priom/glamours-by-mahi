# V2.1 — Database Migration Report

**Project:** `vahqinuminrcjpussimn`  
**Date:** 2026-11-14

## Dry-run / apply (122–126 baseline)
Earlier in this pass, `122`–`126` were already on remote (`db:push:dry` → up to date). Activity `list_activity_feed` and `get_dashboard_overview` smoke checks passed (`activity_fixed`, `dashboard_v125`).

## Additive apply (127–129)
```
npm run db:push:dry
→ Would push:
  • 20260315000127_list_staff_sales_channel_filter.sql
  • 20260315000128_employee_advance_rpcs.sql
  • 20260315000129_list_staff_targets.sql

npm run db:push
→ Applied all three successfully.
```

Remote verify: `list_staff_sales`, `create/approve/disburse_employee_advance`, `list_staff_targets` all present.

## Migrations of interest
| Migration | Purpose | On apply behavior |
|-----------|---------|-------------------|
| 122 | `preview/execute_data_reset` catalog wipe support | Function replace only (no auto-reset) |
| 123 | QA harness for data reset | Function + sandbox role_perm insert |
| 124 | Fix `list_activity_feed` CTE `scoped` | Function replace |
| 125 | Dashboard net profit + category + Dhaka bounds | Function replace |
| 126 | Employees SELECT privacy RLS | Policy replace |
| 127 | `list_staff_sales` `order_only` / `channel` filters | Function replace |
| 128 | Create / approve / disburse employee advances | New SECURITY DEFINER RPCs |
| 129 | `list_staff_targets` history + achievement | New SECURITY DEFINER RPC |

## Rollback
- Functions: restore bodies from `098` / `115` / `108` via SQL editor; drop `create/approve/disburse_employee_advance` and `list_staff_targets` if needed.
- Employees RLS: restore `employees_org_all` from `017`.

## Safety
No truncate/reset/seed executed against production data in this pass.
