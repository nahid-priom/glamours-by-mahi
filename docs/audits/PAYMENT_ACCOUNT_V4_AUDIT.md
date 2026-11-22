# PAYMENT ACCOUNT V4 — Audit

**Date:** 2026-11-22  
**Resolver:** `src/lib/payments/resolve-payment-account.ts`  
**Shared UI:** `src/components/payments/ResolvedPaymentAccountField.tsx` (+ new select/summary in V4)

## Resolver baseline (pre-V4 completion)

| Behavior | Status |
|---|---|
| Wrong-kind `fallback` source | Already removed — returns `null` |
| Method link kind check | Present |
| Settings kind check | Present (mobile must not accept bank-only default without kind match) |
| Kind-specific missing copy | `missingPaymentAccountMessage` |

## Live workflow matrix

| # | Workflow | Pattern | Pre-submit account visible | Risk | V4 action |
|---|---|---|---|---|---|
| 1 | SupplierPaymentsPage | Method → resolve | Yes | Low | Keep; use summary in confirm if needed |
| 2 | DueCollectionPage | Method → resolve | Yes | Low | Keep |
| 3 | CollectDueDialog | Method → resolve (sale branch) | Yes | Low | Keep |
| 4 | CustomerDuePage | Method → resolve | Yes | Low | Keep |
| 5 | SupplierDuePage | Method → resolve | Yes | Low | Keep |
| 6 | DueManagementPage | Method → resolve | Yes | Low | Keep |
| 7 | PurchaseNewPage | Method → resolve when pay>0 | Yes | Low | Keep credit without FA |
| 8 | PosPage | Account-first | Yes chips | **High** — complete uses `is_default ?? [0]` | Remove silent fallback |
| 9 | SimpleIncomePage | Account select | Partial (“Default”) | **High** — first active | Require explicit FA |
| 10 | SimpleExpensePage | Account select | Partial | **High** — first active | Require explicit FA |
| 11 | PurchaseReturnsPage | Account select | Yes | Low | Keep |
| 12 | Exchange | Account select | Yes when cash | Medium — org-wide list | Keep; document scope |
| 13 | CourierSettlementsPage | Account select | Yes | **High** — `accounts[0]` | Empty option + require select |
| 14 | PayrollRunDetailPage | Account select | Yes | Low | Keep |
| 15 | SalesCommissionsPage | Account select | Yes | **High** — `payAccountId \|\| [0]` | Require explicit |
| 16 | CashBankPage | Account is subject | Yes | Medium — auto first | Keep auto only as visible default |
| 17 | DailyClosingPage | Cash-only | Yes | Medium — auto cash[0] | Keep cash filter; visible |
| 18 | SaleEditPage (pages) | Method only | **No** | Medium — omit FA on new pay | Show existing FA; no silent reassign |

## Historical data

No automatic reclassification or rewrites of posted FA links. Discrepancies → read-only report only.
