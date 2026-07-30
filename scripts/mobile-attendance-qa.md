# Phase I — Mobile attendance validation checklist

## ERP
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test` (includes attendance-geo + existing suites)
- [ ] `npm run build`
- [ ] `/hr/attendance` loads (Daily / Devices / Attempts / Corrections / QR tabs)
- [ ] `/hr/payroll` still loads; `calculate_payroll_run` unchanged

## Database
- [ ] Apply migrations `086`–`090` (`supabase db push` or linked migrate)
- [ ] Configure `attendance_locations` for each branch (lat/lng, radius 50m)
- [ ] Assign `work_shifts` / `employee_shift_assignments` (DEFAULT seed exists)
- [ ] Link employee Auth via `link_employee_profile`
- [ ] Grant self permissions (seeded for common roles)

## Edge Functions
Deploy: `attendance-device-register`, `attendance-device-approve`, `attendance-challenge`, `attendance-submit`, `attendance-device-change-request`, `attendance-correction-request`

Secrets:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or publishable)
- `ATTENDANCE_INTEGRITY_MODE=dev_bypass` (use `enforce` only with Play Integrity secrets)

## Mobile (`apps/attendance-mobile`)
```bash
cd apps/attendance-mobile
cp .env.example .env
# set EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npx expo prebuild
npx expo run:android
```

Never set service-role key in the mobile app.

## Rollback
Disable Edge Functions; revoke RPC EXECUTE; mass-revoke devices; keep tables.
