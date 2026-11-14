# Dashboard V3.1 — Staging Data Plan

## Environment policy

- **Allowed:** local Supabase (`127.0.0.1:54321`) or explicitly approved isolated staging with `ALLOW_NONLOCAL_DEMO=1`
- **Forbidden:** linked production `vahqinuminrcjpussimn` / pooler host

## Script

`scripts/demo/seed-glamorous-dashboard.mjs` → guards URL → runs `scripts/seed-sales-demo.mjs` (complete_pos_sale only).

## Desired scenario (when local is up)

1. Multiple POS cash sales across categories
2. At least one credit sale + collection
3. Expense + return if RPC paths available in extended seed
4. Low-stock condition via sales/stock threshold

## This pass status

**BLOCKED** — local Supabase was unreachable (`127.0.0.1:54321`). No production seed attempted.
