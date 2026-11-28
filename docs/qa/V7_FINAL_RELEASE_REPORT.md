# V7 Final Release Report — Glamorous Gallery by Mahi ERP

## A. Executive Summary

| Metric | Count |
| --- | --- |
| Remaining reported issues | 5 |
| Source implemented this pass | 5 |
| FIXED AND VERIFIED (prod smoke) | 0 |
| IMPLEMENTED — VERIFICATION PENDING | 5 |
| Blocked on authorized deploy | Migrations `00162`–`00165`, Edge `admin-create-user` |

**Verdict: READY FOR AUTHORIZED PRODUCTION RELEASE** (DB push + Edge deploy + Vercel), then post-deploy smoke.

V6 regressions were not re-run end-to-end in this pass; breadcrumb unit tests for V7 stores trail passed (5/5); `tsc -b` clean after `orders.fulfil` spelling align.

## B. Root Cause Report

| FIX | Confirmed cause | Why unresolved after V6 |
| --- | --- | --- |
| FIX-01 | Live `pay_supplier` (`00161`) credits cash COA; UI allowed `purchases.create` | Journal fix `00162` never applied; UI/RPC permission skew |
| FIX-02 | RPC requires book/settle/cancel/fulfill; route was `courier.read` | No courier status follow-up work in V6 |
| FIX-03 | Edge Function missing on gateway (OPTIONS 404) | CORS existed only in source; not deployed |
| FIX-04 | Direct `PATCH employees` + RLS | No archive RPC; `00163` unapplied |
| FIX-05 | Breadcrumb parent = Settings while sidebar is top-level | V6 cemented Settings trail; ungated desktop store mutations |

## C. Implementation Summary

### Frontend
- Supplier payment PermissionGate → `purchases.pay` (not `purchases.create`) on SupplierPayments / DueManagement / SupplierDue
- Delivery Tracking Mark Delivered permissions match RPC; sidebar tracking allows mutate perms
- `softDeleteEmployee` → `archive_employee` RPC
- Stores breadcrumb → `[{ Stores }]` (Home icon + Stores)
- StoreFormDialog courier query `enabled: open`
- Desktop store Edit/Archive/Restore gated by `settings.manage`
- `admin-create-user` CORS: Allow-Methods, Max-Age, OPTIONS 204

### Database (local migrations; apply pending)
- Existing: `00162` supplier journal account, `00163` employee access revocation, `00164` store archive visibility
- New: `00165_archive_employee_rpc.sql`

### Docs
- `docs/qa/V7_FINAL_BUG_REGISTER.md`
- `docs/qa/V7_DEPLOY_COMMANDS.md`
- This report

## D. Database Report

| Object | State |
| --- | --- |
| Applied live (per V6) | Through `00161` |
| Pending apply | `00162`, `00163`, `00164`, `00165` |
| New RPC | `archive_employee(uuid)` |
| Updated RPC (on apply) | `pay_supplier` via `00162` |
| RLS | Unchanged (no blanket grants) |

## E. Edge Function Report

| Item | Result |
| --- | --- |
| Function | `admin-create-user` |
| Local CORS | Hardened (OPTIONS 204 + Allow-Methods) |
| Deploy | **NOT DONE** — requires `npx supabase functions deploy` (see V7_DEPLOY_COMMANDS.md) |
| OPTIONS / login smoke | **NOT TESTED** against live gateway |

## F. Accounting Verification

Not executed against live DB (no authorized mutation test). After `00162` apply, required smoke:

- Bank partial payment: FA chart credit, supplier due −amount, balanced journal
- Cash / mobile paths same kind mapping
- Duplicate `client_txn_key` idempotent

COD delivery remains idempotent via `_apply_courier_cod_accounting` (existing `00047`).

## G. QA Results

```
npx vitest run src/components/breadcrumbs/breadcrumb-registry.test.ts
→ 5 passed

npx tsc -b
→ exit 0
```

Browser matrix / E2E / production build: **NOT RUN** in this pass.

## H. Deployment Alignment

| Layer | State |
| --- | --- |
| Frontend source | Updated on `main` working tree (commit pending) |
| Remote DB | Still at `00161` until authorized push |
| Edge | Undeployed / outdated until deploy |
| Vercel | Must ship matching frontend after DB+Edge |

## I. Remaining Blockers

1. Authorized `supabase db push` (or equivalent) for `00162`–`00165`
2. Authorized `functions deploy admin-create-user`
3. Post-deploy browser smoke for all five routes
4. Named-user permission matrix for courier Mark Delivered if still 403 after UI align (branch access)

## J. Final Release Verdict

**READY FOR AUTHORIZED PRODUCTION RELEASE**

Not **PRODUCTION VERIFIED** — deploy and smoke still required.
