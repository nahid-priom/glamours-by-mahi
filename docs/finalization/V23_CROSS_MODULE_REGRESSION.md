# V2.3 Cross-Module Regression

## Executed

| Area | Command / method | Result |
|------|------------------|--------|
| Typecheck | `npm run typecheck` | Pass |
| Lint | `npm run lint` | Pass (warnings only) |
| Unit | `npm run test` | 190/190 |
| Build | `npm run build` | Pass |
| Auth smoke | Playwright authenticated-smoke | 3/3 |
| Module smoke | Playwright v22-module-smoke (V2.3) | 1/1 |
| Migration dry-run | `npm run db:push:dry` | 130–131 pending (not applied) |

## Not executed (documented limitations)

| Scenario | Reason |
|----------|--------|
| A POS live sale + journal | No supervised prod money write |
| B Commission approve→pay live | Same |
| C Purchase receiving | Same |
| D Collection | Same |
| E Staff employee login workspace | No staff e2e credentials |
| F Full RBAC escalation against live DB | Needs migration 130 applied + non-SA fixture |
| G Full accounting balance walk | Destructive risk on prod |

## Sync map (code-level)

- Commission mutations invalidate sales-commissions, staff commission keys, employee-commissions, staff-dashboard, dashboard
- Target assign invalidates staff-dashboard, target history, employee-targets
- Role updates return refreshed settings + invalidate admin-settings-roles / permissions from AdminPermissionsPage
