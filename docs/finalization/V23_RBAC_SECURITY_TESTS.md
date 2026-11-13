# V2.3 RBAC Security Tests

## Implemented controls

| Control | Where |
|---------|--------|
| Atomic role+permissions write | RPC 130 |
| `settings.manage` required | RPC + AdminPermissions PermissionGate |
| Owner / Super Admin locked | `update_role_with_permissions` |
| Privilege subset (no self-escalation for non-SA) | `_assert_assignable_permission_keys` |
| Audit | `admin.role.create` / `admin.role.update_permissions` via `write_audit_log` |
| Tenant scope | `roles.organization_id = current_organization_id()` |

## Tests executed

| Test | Result |
|------|--------|
| Contract smoke file present (`role_permissions_rpc_smoke.sql`) | Added; listed in `db:test:p0` |
| Live RPC auth matrix against local DB | **Not run** — migrations not applied to local in this pass |
| Privilege escalation live attempt | **Blocked** pending migration apply + staff/non-SA fixture |
| E2E `/administration/permissions` + `/administration/roles` shells | Passed (Playwright V2.3 smoke) |
| Typecheck / unit suite | Pass (190) |

## Residual risk

Until **130** is applied remotely, production still uses prior RLS table writes if an old client is deployed; **new app build requires the RPCs** for create/update role. Coordinate app deploy with migration apply.
