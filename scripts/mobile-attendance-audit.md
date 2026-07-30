# Mobile Attendance Audit Lock — Glamours by Mahi ERP

**Date:** 2026-07-30  
**Scope:** Secure React Native attendance app + additive backend (migrations 086–090)  
**Status:** Architecture locked; implementation follows this document.

## 1. Current Attendance Architecture

- Canonical daily truth: `attendance_records` (`first_in`/`last_out`, late/OT minutes, `is_approved`).
- Status CHECK: `present|absent|leave|holiday|weekly_off|half_day|missing_checkout`.
- Raw punches: `attendance_raw_logs` (often `pending`; no summarizer RPC).
- Hardware: `attendance_devices` + `employee_device_mappings` (ZKTeco/manual/csv/webhook).
- Ingest: `supabase/functions/attendance-webhook` → raw logs only.
- ERP: `/hr/attendance` read-only via `attendance.repository.ts`.

## 2. Current HR Architecture

- `employees` with optional `profile_id`, text `shift_name` (no shift master).
- `leave_requests` for leave.
- Routes under `/hr/*`.

## 3. Current Payroll Architecture

- RPCs in 070/071: `create_payroll_run`, `calculate_payroll_run`, review/approve/pay.
- Consumes **only** `attendance_records` where `is_approved = true`.
- Late: `late_minutes > 0` → 10% daily rate. Absences/unpaid leave → daily rate.

## 4. Employee ↔ Auth Mapping

```
auth.users.id = profiles.id → employees.profile_id
```

Mobile requires active employee + linked profile (`link_employee_profile`).

## 5–7. Tables / RPCs / RLS

- No check-in/out RPCs today.
- HR RLS is org-wide `FOR ALL` (unsafe for employee JWT self-access).
- Permissions: `hr.attendance.read|manage`, `hr.device.manage`, payroll keys.

## 8–9. Calculation Flows

Hardware/webhook → raw logs (gap) → daily records → payroll.  
Manual/seed → daily records → payroll.

Mobile must upsert `attendance_records` (not invent a second pay input).

## 10. Gaps

No mobile devices/crypto/challenges/geo/QR; no branch lat/lng; no shift windows; no punch→daily RPC; org-wide RLS; optional profile links; no PostGIS (use Haversine); not a monorepo.

## 11. Conflict Mitigations

| Risk | Mitigation |
|------|------------|
| Reuse hardware `attendance_devices` | New `employee_attendance_devices` |
| Duplicate truth | Upsert existing `attendance_records` only |
| Unapproved ignored by payroll | Auto-approve low-risk; high-risk `is_approved=false` |
| Status enum rewrite | Prefer existing statuses + `late_minutes` |
| Direct mobile inserts | RLS deny + Edge Function + SECURITY DEFINER RPC |
| Break webhook | Leave `attendance-webhook` untouched |

## 12. Safe Reuse

`attendance_records`, optional raw-log mirror, unchanged `calculate_payroll_run`, `employees.profile_id`, permission helpers, `/hr/attendance` route.

## 13–15. New Assets

- Migrations `086`–`090` (additive).
- Edge Functions: device register/approve, challenge, submit, change request, correction.
- App: `apps/attendance-mobile/` (Expo Dev Build).

## 16. Phases

A audit → B schema → C RPCs/Edge → D–F RN → G ERP workspace → H monthly summary → I tests/build.

## 17. Acceptance

Master prompt criteria 1–25 (ERP intact, one device, biometric+geo, server time, RLS self-only, no service-role in mobile, payroll via approved daily rows).

## 18. Rollback

Disable Edge Functions; revoke new RPC EXECUTE; mass-revoke devices; do not drop tables with production data; keep ERP read path.
