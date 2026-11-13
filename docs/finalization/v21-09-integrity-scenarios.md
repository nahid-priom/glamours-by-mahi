# V2.1 — Integrity Scenarios

| # | Scenario | Result | Evidence / blocker |
|---|----------|--------|--------------------|
| 1 | Employee create → login → staff workspace | **Partial** | Create/detail/invite wired; live staff login not exercised (admin e2e only) |
| 2 | POS → inventory → accounting → dashboard | **Working (read path)** | POS/dashboard screenshots + cache invalidation; no new production sale forced |
| 3 | Staff sale → commission → approve → pay | **Partial** | Accrual path on `complete_pos_sale`; Approve/Pay UI + RPCs; live payout skipped |
| 4 | Return → reversal/commission adjust | **Working (code)** | Existing reverse RPCs; not re-run on prod |
| 5 | Purchase → stock → supplier due | **Working (code)** | Existing RPCs; no prod write |
| 6 | Collection → AR | **Working (code)** | Existing collection RPCs |
| 7 | Advance → payroll deduction | **Partial** | Create/approve/disburse live; calculate_payroll_run recovers disbursed/recovering; full payroll run not forced |
| 8 | Branch-scoped dashboard | **Working** | Dashboard branch filter + RPC 125 |
| 9 | Role change nav/RLS | **Partial** | Owner/SA hide My Workspace verified; staff linked-employee hide verified in code |

**Policy:** No production reseed / truncate / demo seed.
