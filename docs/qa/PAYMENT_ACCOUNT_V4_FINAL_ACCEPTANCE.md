# Payment Account V4 — Final Acceptance

## Acceptance criteria

- [x] Shared resolver cannot silently select wrong-kind account
- [x] Method-linked / settings defaults validated for kind
- [x] Generic wrong-kind fallback removed (`source` no longer includes unsafe `fallback`)
- [x] DueManagement / supplier / customer / purchase pay-now show resolved FA
- [x] POS multi-tender preserved; no invent `is_default` / `accounts[0]` on complete or invalidation
- [x] Income / Expense / Courier / Commission / CashBank / Payroll use shared `FinancialAccountSelectField`
- [x] Daily Closing cash-only + explicit select
- [x] Sale Edit shows FA; requires kind-matched FA for money lines
- [x] Server `_assert_payment_account_eligible` on POS path
- [x] Server `_validate_money_payment_accounts` on `collect_customer_due` / `pay_supplier`
- [x] Historical records unchanged by design
- [ ] Staging E2E money-in/out signed off (operator)
- [ ] Production deploy authorized separately

## Deployment state

| Layer | State |
|---|---|
| Local code | Implemented |
| Migration `00160` | Added — apply on staging before QA sign-off |
| Migration `00161` | Added — collect/pay kind assert |
| Staging verification | Pending operator |
| Production | Not deployed by this change set |

## Remaining risks

1. Exchange accounts remain org-wide list (authorized by existing RPC); branch narrowing is a product decision.
2. Pre-V4 historical method/kind mismatches need a read-only audit if business requests cleanup.
3. Staging / production apply of `00160` + `00161` still required before live enforcement.
