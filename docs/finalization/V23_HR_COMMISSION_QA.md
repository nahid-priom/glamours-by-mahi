# V2.3 HR & Commission QA

## Employee Detail

| Check | Result |
|-------|--------|
| Routes `/hr/employees/new` and `/:id` | Present |
| Tabs: Overview, Attendance, Leave, Salary, Commission, Targets, Advances, Activity | Implemented |
| Lazy tab queries (`enabled: tab === …`) | Yes |
| `?tab=` deep-link | Yes |
| Salary / advances PermissionGate | Yes |
| Commission link with `?employee=` | Yes |
| E2E open employee detail from list | Passed when list has rows |

## Commissions

| Check | Result |
|-------|--------|
| Date from/to (created_at, Asia/Dhaka, exclusive end) | Implemented |
| Pagination (page size 50, count) | Implemented — no silent `limit(200)` cutoff |
| Reject dialog + optional reason → `reject_sales_commission` | Implemented |
| Bulk approve ConfirmDialog + per-id summary | Implemented (RPC 131 or sequential fallback) |
| Detail overlay + reject when pending | Implemented |
| Cache invalidation includes staff + employee keys | Implemented |
| Live Sale→Approve→Pay on production | **Not executed** (policy) |

## KPI note

Commission page KPI strip is **page-scoped** (labeled “(page)”) after pagination; full filtered totals would need a separate aggregate RPC (not added this pass).
