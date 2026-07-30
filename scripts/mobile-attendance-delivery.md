# Mobile Attendance — Final Delivery Report

**Date:** 2026-07-30  
**Product:** Glamours by Mahi ERP + `apps/attendance-mobile`

## 1. Audit findings
See [scripts/mobile-attendance-audit.md](mobile-attendance-audit.md).

## 2. Architecture implemented
Mobile app (JWT) → Edge Functions → SECURITY DEFINER RPCs → `attendance_events` / `attendance_attempts` → upsert `attendance_records` (`source=mobile`, `is_approved` for low risk) → existing `calculate_payroll_run`.

## 3–5. Files / migrations
| Migrations | Purpose |
|------------|---------|
| `086` | work_shifts, assignments, attendance_locations, attendance_records extensions |
| `087` | employee_attendance_devices, requests, device audit |
| `088` | challenges, events, attempts, corrections, branch QR tokens |
| `089` | permissions, Haversine, register/challenge/submit/approve/correction RPCs |
| `090` | monthly summary + finalize/recalculate |

## 6–9. Tables / RPCs / Edge / RLS
- New tables as above (hardware `attendance_devices` untouched).
- RPCs: `get_mobile_attendance_context`, `register_attendance_device`, `approve_attendance_device`, `create_attendance_challenge`, `submit_mobile_attendance`, `request_attendance_correction`, `review_attendance_correction`, `issue_attendance_branch_qr`, `build_monthly_attendance_summary`, `finalize_attendance_period`, `recalculate_employee_attendance_range`.
- Edge: `attendance-device-register|approve|challenge|submit|device-change-request|correction-request`.
- RLS: org policies on new tables; mutations via RPCs.

## 10–12. RN screens / ERP / Payroll
- App screens: Login, Home, History, Device, Requests, Profile.
- ERP `/hr/attendance`: Daily, Mobile devices, Attempts, Corrections, Branch QR.
- Payroll: unchanged RPC; monthly summary is additive report layer.

## 13–16. Security / env / build
- No service-role in mobile; ECDSA device signatures verified in Edge Function; biometric required; server time; challenge nonce; geo Haversine; integrity mode server-only (`ATTENDANCE_INTEGRITY_MODE`).
- Mobile env: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_ENV`, `EXPO_PUBLIC_ATTENDANCE_FUNCTION_URL`.
- ERP: `typecheck` / vitest geo tests / `build` passed.
- Android: Expo Dev Build (`expo prebuild` + `run:android` / EAS). Package `com.glamours.attendance`.

## 17–20. Tests / limitations / next / rollback
- Unit: `attendance-geo.test.ts` (geofence, late, duplicate punch rules).
- **Database-verified pending** until `db push` of 086–090.
- **Live A–H / device QA pending** (operator): link profiles, set locations, approve devices, punch.
- Next: Play Integrity enforce mode, offline pending sync, richer holiday calendar, QR scanner in mobile.
- Rollback: disable Edge Functions; revoke RPC grants; mass-revoke devices; do not drop tables.
