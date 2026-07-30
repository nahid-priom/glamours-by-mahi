# Mobile Attendance — Rollback

## Database

Migrations `091`–`095` are additive. Rollback is operational, not automatic reverse migrations:

1. Temporarily `GRANT EXECUTE ON FUNCTION public.submit_mobile_attendance(jsonb) TO authenticated` **only** if emergency legacy path needed (not recommended).
2. Prefer: redeploy previous Edge Function revision that still called submit with user JWT **only if** `092` not applied; once `092` is applied, old Edge without attestation will fail closed (safe).
3. To disable mobile punches: set all devices `revoked` / deactivate `attendance_app_version_policy` by raising `minimum_version` unrealistically.

## Edge

```bash
# Redeploy prior known-good function bundle from git tag
git checkout <tag> -- supabase/functions/attendance-* supabase/functions/_shared/attendance-auth.ts
bash scripts/deploy-mobile-attendance-functions.sh
```

## Mobile

Ship previous EAS build; legacy exportable keys are wiped on new register — users may need re-approval after rolling forward again.

## Payroll

If `recalculation_required` was set, do **not** delete adjustments; run an explicit payroll adjustment workflow.
