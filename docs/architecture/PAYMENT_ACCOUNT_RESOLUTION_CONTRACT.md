# Payment Account Resolution Contract

**Authority:** `resolvePaymentAccount` in `src/lib/payments/resolve-payment-account.ts`

## Eligibility

An account is eligible only if active, kind-matched (for method-driven flows), and visible for branch (`branch_id === txnBranch` OR `branch_id == null`).

## Resolution order (method-driven)

1. Branch kind default (`is_default`)
2. First branch kind match
3. Org-wide kind default / first
4. Method-linked FA **if kind matches**
5. Settings default **if kind matches**
6. Else `null` — never wrong-kind fallback

## Account-first flows

User selects FA → derive method via `methodFromAccountKind` (exported from resolver module). No silent `accounts[0]` on submit.
