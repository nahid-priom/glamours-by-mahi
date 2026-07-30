# Mobile Attendance Final Hardening Audit

**Date:** 2026-07-30  
**Scope:** Evidence-based gaps vs 10/10 production readiness (post 086–090)

## 1–11. Implementation map (verified)

| Area | Status |
|------|--------|
| Migrations 086–090 | Present; schema + RPCs + Edge wrappers |
| Expo app | Present; SecureStore exportable keys |
| ERP `/hr/attendance` | Tabs for devices/attempts/corrections/QR |
| Payroll | Still reads approved `attendance_records` only |
| One-device unique index | Exists on `employee_id` (approved+active) |
| Challenge FOR UPDATE | Yes in submit |
| Haversine server-side | Yes |
| Self-scope RLS | **Promised in 089 title; never applied** |

## 12. Confirmed working
Challenge flow, device register/approve RPCs, Haversine reject outside radius, idempotency key unique on events, online-only mobile NetInfo gate, ERP build green.

## 13–19. Incomplete / vulnerabilities

| ID | Severity | Issue |
|----|----------|-------|
| C1 | CRITICAL | Client `biometric_verified: true` trusted by RPC |
| C2 | CRITICAL | Client/Edge `device_signature_valid` boolean; authenticated can call submit RPC directly |
| C3 | CRITICAL | Exportable PKCS8 in SecureStore |
| C4 | CRITICAL | Thin signed message (challenge.nonce.event only) |
| C5 | CRITICAL | Org-wide FOR ALL on attendance_records |
| C6 | CRITICAL | Integrity default `dev_bypass`; no production fail-closed |
| H1 | HIGH | Play Integrity stub |
| H2 | HIGH | QR nonce hash not HMAC-signed; issue allowed with read perm |
| H3 | HIGH | Overnight work_date = calendar date only |
| H4 | HIGH | Idempotency ignores payload hash conflict |
| H5 | HIGH | Corrections mutate daily rows without adjustments/recalc |
| M1 | MEDIUM | Rate limits / app version / secret scan / deploy scripts missing |
| M2 | MEDIUM | database.ts stale |

## 20. Implementation plan
Additive migrations 091–095; Edge service-role submit + attestation HMAC; react-native-biometrics hardware keys; canonical payload contract; RLS lockdown; docs; verdict **CODE COMPLETE — DEPLOYMENT PENDING**.

## 21. Remediation status (code complete)

| ID | Remediation |
|----|-------------|
| C1–C4 | Hardware `createSignature` + canonical payload; no client biometric/signature booleans; Edge attestation HMAC |
| C5 | Migration `093` RLS lockdown |
| C6 / H1 | Production fail-closed + Play Integrity API path |
| H2 | HMAC QR in `092`; ERP gate manage/device.approve |
| H3–H5 | Overnight work_date; idempotency payload hash; adjustments + payroll recalc flag |
| M1 | Rate limits, app version policy, secret scan, deploy scripts |
| M2 | Still pending `db:types` after push |

**Final verdict:** `CODE COMPLETE — DEPLOYMENT PENDING` (see `scripts/mobile-attendance-final-delivery.md`).
