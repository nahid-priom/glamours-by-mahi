# Payment Account Posting Security

1. Client eligibility is UX — RPC must validate FA exists, active, org, branch, kind vs method.
2. Reject inactive / wrong-kind / unauthorized branch accounts.
3. Idempotency: keep existing `client_txn_key` / reference uniqueness.
4. Never rewrite historical `financial_account_id` on nonfinancial sale edits.
5. Displayed confirmation account id must equal submitted id.

## Shared DB helpers (V4)

### Migration `20260315000160_payment_account_v4_eligibility.sql`

| Object | Role |
|---|---|
| `_payment_method_expected_kind(method)` | Maps method → `cash` / `bank` / `mobile_money` / `other` |
| `_assert_payment_account_eligible(org, branch, method, fa_id)` | Exists + active + org + branch scope + kind |
| `complete_pos_sale` | Calls assert on each non-due tender **before** `_complete_pos_sale_core` |

`edit_sale` posts the replacement via `complete_pos_sale`, so sale corrections inherit the same kind check.

### Migration `20260315000161_payment_account_v4_collect_pay_assert.sql`

| Object | Role |
|---|---|
| `_validate_money_payment_accounts(org, branch, payments)` | Loops normalized money lines → `_assert_payment_account_eligible` |
| `collect_customer_due` | Performs validate after `_normalize_money_payments` |
| `pay_supplier` | Performs validate after `_normalize_money_payments` |

No historical rows rewritten; posting semantics unchanged aside from stricter eligibility rejects.
