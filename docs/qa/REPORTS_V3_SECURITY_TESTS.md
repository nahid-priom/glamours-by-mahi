# REPORTS V3 — Security Tests

## Gates

| Surface | Gate |
|---|---|
| `/reports/*` tree | `reports.read` |
| `/reports/profit` | Nested `accounts.read` \| `profit_loss.read` (fallback `/reports`) |
| `/reports/cash-book` → Accounts | Outer `reports.read`; destination `accounts.read` |
| `/reports/dues` → Accounts | Same |
| Hub finance tiles | Hidden unless `can(require)` |
| RPC `get_profit_loss_report` | Server: accounts.read \| profit_loss.read \| accounts.manage |
| Print `/print/reports/:type` | Still permission-gated; content retired (no mock financial dump) |
| Inventory WAC columns | `inventory.valuation` \| `products.manage_prices` \| `accounts.read` |

## Direct URL checks

1. User with only `reports.read`: `/reports/sales` OK; `/reports/profit` → `/reports`; `/accounts/transactions` denied by Accounts.  
2. User with `reports.read` + `accounts.read`: profit + cash-book redirects work.  
3. Branch-scoped RPC still enforces `user_has_branch_access`.

## RLS

No RLS policies removed. No report page mutates `current_due`, FT, or journals.
