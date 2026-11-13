# V2.1 — QA Evidence

| Check | Result |
|-------|--------|
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (warnings only) |
| `npm run test` | Pass — 190/190 |
| `npm run build` | Pass — integrity OK |
| Playwright `authenticated-smoke` (desktop) | Pass — 3/3 |
| Playwright `v21-visual-qa` (desktop) | Pass — 48 screenshots |
| `db:push` 127–129 | Applied + RPC verify |
| Super Admin hides My Workspace | Asserted in smoke + visual |

## Role / branch notes
- Super Admin / Owner: My Workspace hidden.
- Nested employee routes + refresh covered by app router + detail page `useParams`.
- Staff-only RLS / My Workspace linked-employee filter: code path live; staff session not in e2e secrets.
