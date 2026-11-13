# 05 — Release Risk Register

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | Activity feed SQL CTE bug | P0 | Migration 124; verify UI |
| R2 | Wrong profit definition | P0 | Migration 125 + UI labels |
| R3 | Super Admin My Workspace nav | P1 | Hide staff group for Owner/Super Admin |
| R4 | Linked DB mutation | P0 | Additive migrations only; no reset |
| R5 | Employee/payroll RLS org-wide | P1 | Tighten select for non-HR |
| R6 | Creds in chat | P1 | `.env.e2e.local` only; never commit |
| R7 | Historical recon gaps | P2 | Deferred; dry-run only |
| R8 | Thin authenticated E2E | P1 | Expand Playwright with env creds |
| R9 | Dual activity URLs | P2 | Redirect `/activity-logs` → admin activity |
| R10 | Fabricated +0% trends | P2 | Null trends when no prior period |
