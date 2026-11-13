# 03 / Database Migration (implementation)

## Authored (safe additive)
| File | Purpose |
|------|---------|
| `20260315000124_fix_list_activity_feed_scoped_cte.sql` | Fix activity feed CTE bug |
| `20260315000125_dashboard_net_profit_and_category.sql` | Net profit + category sales + Dhaka day bounds |
| `20260315000126_employees_privacy_rls.sql` | Employees SELECT privacy |

## Apply status
**Blocked on this workstation:** Supabase CLI account lacks privileges on linked project `vahqinuminrcjpussimn` (403 access-control).

### How to apply (project owner)
1. Open Supabase SQL Editor for project `vahqinuminrcjpussimn`
2. Run each migration file in order 124 → 125 → 126
3. Or: `npx supabase link --project-ref vahqinuminrcjpussimn` with an owner token, then `npx supabase db push`

### Rollback
Replace functions/policies with prior bodies from migrations 098 / 115 / 017 `employees_org_all`.

### Safety
No truncate, reset, or seed applied to production.
