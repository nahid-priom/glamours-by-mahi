# V7 Final Bug Register — Glamorous Gallery by Mahi ERP

Baseline: [`V6_BUG_REGISTER.md`](./V6_BUG_REGISTER.md). Status reflects **source changes in this pass** plus known deploy gates. Production verification requires authorized migration/Edge deploy.

| ID | V6 ID | Issue | Why V6 failed in prod | V7 work | Status |
| --- | --- | --- | --- | --- | --- |
| FIX-01 | BUG-01 | Supplier payment 400 / chart account | Live DB at `00161`; `00162` unapplied; UI allowed `purchases.create` | Align UI perms to RPC; keep `00162` as authoritative journal mapping | IMPLEMENTED — VERIFICATION PENDING (migration apply) |
| FIX-02 | BUG-03 | Mark Delivered 403 | No fix; route `courier.read` vs mutate book/settle | Align tracking route/sidebar + page gates; COD idempotency check | IMPLEMENTED — VERIFICATION PENDING |
| FIX-03 | BUG-09 | admin-create-user CORS/404 | Function undeployed (OPTIONS 404) | Harden CORS headers; document deploy command | IMPLEMENTED — VERIFICATION PENDING (Edge deploy) |
| FIX-04 | BUG-12 | Terminated employee delete 403 | Direct PATCH + RLS; `00163` unapplied | Archive RPC + wire repository; keep `00163` | IMPLEMENTED — VERIFICATION PENDING |
| FIX-05 | BUG-14 | Stores breadcrumb Settings→Stores | IA mismatch cemented | Dashboard→Stores; console fixes | IMPLEMENTED — VERIFICATION PENDING |

## Failure-mode legend (Phase 0)

1. Unapplied migration (`00162`, `00163`, `00164`)
2. Undeployed Edge Function (`admin-create-user`)
3. Incorrect UI permission gate vs RPC
4. Route/sidebar vs mutate permission skew
5. Breadcrumb registry vs sidebar ownership

## Stop gates

- Do not claim FIXED AND VERIFIED until authorized DB/Edge deploy + browser smoke.
- Do not mutate production financial data without authorization.
