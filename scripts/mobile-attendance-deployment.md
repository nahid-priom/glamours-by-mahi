# Mobile Attendance Edge Function Deployment

## Prerequisites

- Supabase CLI linked to the project (`npx supabase link`)
- Migrations `091`–`095` applied (`npx supabase db push --linked`)
- Secrets configured (see below)

## Secrets

```bash
npx supabase secrets set APP_ENV=production
npx supabase secrets set ATTENDANCE_INTEGRITY_MODE=enforce
# Play Integrity (Android enforce)
npx supabase secrets set PLAY_INTEGRITY_PACKAGE_NAME=com.yourorg.attendance
npx supabase secrets set PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER=...
npx supabase secrets set PLAY_INTEGRITY_API_KEY=...
```

`SUPABASE_SERVICE_ROLE_KEY` is provided by the Edge runtime for service-role RPC calls.
Never put the service role key in the Expo app.

HMAC submit secret lives in Postgres `app_runtime_secrets` (seeded in migration `091`).

## Deploy

```bash
bash scripts/deploy-mobile-attendance-functions.sh
```

Or individually:

```bash
npx supabase functions deploy attendance-submit
npx supabase functions deploy attendance-challenge
npx supabase functions deploy attendance-device-register
npx supabase functions deploy attendance-device-approve
npx supabase functions deploy attendance-device-change-request
npx supabase functions deploy attendance-correction-request
```

## Production fail-closed

If `APP_ENV=production` and `ATTENDANCE_INTEGRITY_MODE=dev_bypass`, functions throw at request time.
Play Integrity without API credentials returns `integrity_not_configured` and rejects punches.

## Verify

1. Issue challenge with employee JWT → 200 + nonce + integrity_nonce
2. Submit without Edge attestation (direct RPC as authenticated) → permission denied
3. Submit via Edge with valid hardware signature → accepted / flagged / pending_review
