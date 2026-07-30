#!/usr/bin/env bash
# Deploy mobile attendance Edge Functions (requires supabase CLI + linked project)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

FUNCTIONS=(
  attendance-device-register
  attendance-device-approve
  attendance-challenge
  attendance-submit
  attendance-device-change-request
  attendance-correction-request
)

echo "Deploying attendance functions..."
for fn in "${FUNCTIONS[@]}"; do
  npx supabase functions deploy "$fn" --no-verify-jwt=false
done

echo "Set secrets (example):"
echo "  npx supabase secrets set ATTENDANCE_INTEGRITY_MODE=enforce APP_ENV=production"
echo "  npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ATTENDANCE_SUBMIT uses service role from platform"
echo "Done."
