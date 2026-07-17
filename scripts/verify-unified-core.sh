#!/usr/bin/env bash
# Local verification for unified finance/inventory core.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> supabase db reset (local)"
npx supabase db reset --yes

echo "==> typecheck"
npm run typecheck

echo "==> lint"
npm run lint

echo "==> unit tests"
npm test

echo "==> build"
npm run build

echo "==> optional: generate types"
if npx supabase status >/dev/null 2>&1; then
  npx supabase gen types typescript --local > src/types/database.generated.ts || true
fi

echo "Verification complete."
