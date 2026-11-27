# V6 permission matrix

This matrix combines inspected source with a read-only live metadata query. It is **not** an action test using a named user token.

| Action | Application permission observed | Server control observed | Live outcome |
| --- | --- | --- | --- |
| Pay supplier | `supplier_due.pay`, `accounts.post`, `purchases.create`, or `accounts.manage` in UI | Live `pay_supplier(jsonb)` is executable by authenticated; function checks permission and branch access | Caller outcome unverified |
| Update employee | HR route guard and form | Live `employees_update_hr` RLS checks organization and HR/settings permission; authenticated UPDATE grant exists | Reported 403; cause unverified |
| Create employee login | Administration flow | Edge Function validates JWT and `administration.users.create`, with role fallback | Reported CORS failure; deployment unverified |
| Update supplier status | Profile action now gates on `suppliers.manage` | Live `suppliers_update` requires `suppliers.manage` and same organization; authenticated UPDATE grant exists | Former profile action used soft delete; named caller's 403 remains unverified |
| Update courier parcel | Courier UI | Live `update_courier_parcel_status(uuid,text,text)` is executable by authenticated and checks courier permission and branch access | Reported 403; cause unverified |
| Archive store | Store route admitted `stores.read`, `stores.manage`, or `settings.manage`; mutation controls now require `settings.manage` | Live `branches_update` requires `settings.manage` and same organization; authenticated UPDATE grant exists | UI/server mismatch confirmed; failing caller identity unverified |

RLS is enabled on the five inspected tables. Authenticated UPDATE and SELECT grants are present on them. The live Owner and Super Admin roles carry the relevant inspected permissions; this does not establish the role or branch membership of the user who saw a 403. No grants or policies were broadened. Required follow-up: inspect the failing caller profile, organization and branch access, function deployment, and positive/negative requests for each action. An intentional 403 for an unauthorized caller remains correct.

The existing `user_has_permission` and organization helpers read `profiles.is_active`, so deactivating a linked profile revokes backend operations for an existing JWT. Prepared migration `20260315000163_employee_access_revocation.sql` performs that revocation for future inactive, terminated, or archived employee transitions. It is unapplied; a read-only live aggregate found no existing linked inactive/terminated employees with active profiles.

The live `branches_select` policy excludes `deleted_at` rows for all roles, which prevents the existing Store “Show archived” and Restore UI from loading archived records. Prepared migration `20260315000164_store_archive_visibility.sql` permits same-organization `settings.manage` users to inspect archived branches while keeping ordinary branch access scoped to non-deleted rows. It is unapplied.
