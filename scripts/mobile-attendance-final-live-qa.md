# Mobile Attendance — Live QA Matrix

| # | Scenario | Expected | Status |
|---|----------|----------|--------|
| 1 | Direct RPC `submit_mobile_attendance` as authenticated | Denied | Pending external environment (db push) |
| 2 | Employee INSERT `attendance_records` | RLS deny | Pending external environment |
| 3 | Challenge expiry >90s | Reject | Pending external environment |
| 4 | Idempotency same key + different hash | Conflict error | Pending external environment |
| 5 | Idempotency same key + same hash | Replay OK | Pending external environment |
| 6 | Overnight shift early-morning checkout work_date | Previous calendar date | Pending external environment |
| 7 | QR issue with `hr.attendance.read` only | Denied | Pending external environment |
| 8 | Correction approve after finalized payroll | `recalculation_required`, no silent pay mutate | Pending external environment |
| 9 | Android hardware biometric punch | Accepted / flagged with attestation | **Pending external environment** — no physical device here |
| 10 | `APP_ENV=production` + `dev_bypass` | Edge throws | Pending Edge deploy |
| 11 | Production without Play Integrity secrets | Punch rejected | Pending Edge deploy |
| 12 | Exportable legacy key still on device | Force re-register | Pending device build |

**Rule:** Never mark Passed without executed evidence in the target environment.
