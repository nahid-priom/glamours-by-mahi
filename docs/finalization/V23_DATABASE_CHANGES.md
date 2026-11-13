# V2.3 Database Changes

**Linked project:** `vahqinuminrcjpussimn`  
**Prior remote head:** through migration **129** (`list_staff_targets`)  
**Activity mig 124:** already applied (prior V2.2 verification)

## New migrations (not pushed to production this pass)

| File | Purpose |
|------|---------|
| `20260315000130_role_permission_rpcs.sql` | Atomic `create_role_with_permissions` / `update_role_with_permissions`; privilege subset; Owner/Super Admin lock; `write_audit_log` |
| `20260315000131_bulk_approve_sales_commissions.sql` | `bulk_approve_sales_commissions(uuid[])` wrapping `approve_sales_commission`; per-id ok/fail |

## Dry-run evidence (2026-11-14)

```
npm run db:push:dry
Would push:
 • 20260315000130_role_permission_rpcs.sql
 • 20260315000131_bulk_approve_sales_commissions.sql
```

**No live push executed.** App bulk-approve falls back to sequential `approve_sales_commission` until 131 is applied.

## Security notes (130)

- `SECURITY DEFINER` + `SET search_path = public, pg_temp`
- Requires `settings.manage`
- Org scoped via `current_organization_id()`
- Actor may only assign keys they hold unless Owner/Super Admin
- Internal helpers not granted to `authenticated`

## Prerequisites for production apply

1. Explicit authorization from owner
2. Staging or maintenance window preferred
3. Re-run `role_permissions_rpc_smoke.sql` and commission approve smoke after apply
4. Confirm Settings role create/edit still works post-apply
