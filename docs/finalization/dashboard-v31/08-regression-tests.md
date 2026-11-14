# Dashboard V3.1 — Regression Tests

| Suite | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (warnings only) |
| `npm run test` | 190/190 |
| `npm run build` | Pass |
| Playwright `authenticated-smoke` + `dashboard-v31-visual` | 4/4 pass |

## Smoke adjustment

`authenticated-smoke` now asserts TopHeader greeting (`header` + Good Morning) instead of page `h1` (mobile-only after V3.1).

## Not run

- Staff restricted dashboard negative e2e (no staff creds)
- Live POS → dashboard money reconciliation (local DB down; prod seed forbidden)
