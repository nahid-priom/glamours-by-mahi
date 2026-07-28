# Phase A live QA checklist (A–H)

Operator-run after applying migrations `00075`–`00085` (`supabase db push` or equivalent).

Mark each step when verified. Do not assume agent has live DB credentials.

## Prerequisites

- [ ] Migrations `20260315000075` … `20260315000085` applied
- [ ] Signed in as org admin / sales+accounts capable user
- [ ] At least one branch, payment method (cash + due), refund financial account

## Scenarios

### A — New customer baseline

1. Create a new customer (no sales).
2. Open POS / customer summary (or customer detail).
3. Expect: `current_due = 0`, `current_advance = 0`, rating **unrated** (not shown as 3.0).

### B — Cash sale (settled)

1. Complete a fully paid POS cash sale for that customer.
2. Expect: due 0, advance 0, ledger has `sale_invoice` debit + `sale_payment` credit(s).
3. Rating becomes **provisional** after first completed order.

### C — Due sale

1. Complete a sale with unpaid / due remainder (e.g. ৳500 due).
2. Expect: `current_due` increases by due amount; advance stays 0.
3. Ledger: invoice debit + payment credits for non-due methods only.

### D — Collection (exact)

1. Collect exactly the open due via customer collection / POS collection path.
2. Expect: due → 0, advance → 0, ledger `collection` credit.

### E — Excess collection (advance)

1. With due 0 (or collect more than due), post excess payment.
2. Expect: `current_advance` = excess; due 0 (never both due and advance).

### F — Sales return paths

Use `approve_sales_return` (real UI or RPC).

| Case | Setup | Expect |
|------|--------|--------|
| F1 Return ≤ open due | Sale with due ≥ return | `return_credit` only; due decreases; no cash refund |
| F2 Paid sale + cash refund | Fully paid sale, return with `refund_account_id` | `return_credit` + `refund` debit; settled; cash out posted |
| F3 Partial due + excess | Due 300, return 500 | Full credit; refund debit 200; settled / no phantom advance |

### G — Void / cancel completed sale

1. Void a completed sale that posted customer ledger.
2. Expect: customer due/advance restored consistently; rating refresh may run.

### H — Org / branch isolation

1. As user in org A, confirm cannot see org B customers / top list rows.
2. Branch-scoped list (if used) only includes allowed branch activity.

## Online fulfilment (canonical AR)

1. Create online/draft order with customer; fulfil via `fulfil_online_order`.
2. Expect: **no** direct-only `current_due` bump without payments path — customer balance via `_apply_customer_sale_canonical_ledger` (`sale_invoice` + `sale_payment` credits).
3. COD / due payment methods leave due; cash methods leave settled or partial accordingly.

## Top customers date range

1. Open `/reports/top-customers`, set from/to.
2. Expect: ranking uses period spend/orders; subtitle notes rating is lifetime.
3. Clear/widen range: more rows / lifetime-style totals when range omitted at RPC (UI always sends range).

## SQL probes (read-only)

```sql
-- Customer balance never both due and advance
SELECT id, name, current_due, current_advance
FROM customers
WHERE deleted_at IS NULL
  AND current_due > 0
  AND current_advance > 0;

-- Recent return should have return_credit; cash cases also refund debit
SELECT entry_type, debit, credit, reference_type, reference_id, created_at
FROM customer_ledger
WHERE customer_id = '<customer_uuid>'
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 20;

-- Fulfilment sales should have sale_invoice for completed online fulfilments
SELECT cl.entry_type, cl.debit, cl.credit, s.invoice_no
FROM customer_ledger cl
JOIN sales s ON s.id = cl.reference_id
WHERE cl.reference_type = 'sale'
  AND s.channel IN ('ecommerce', 'online')
  AND s.status = 'completed'
ORDER BY cl.created_at DESC
LIMIT 20;
```

## Verification labels

| Layer | Status |
|-------|--------|
| Code (migration + UI + unit tests) | Agent completes in PR |
| Database-verified (`db push` / migrate) | Operator / linked project |
| Live A–H interactive | Operator after migrate |

When DB is not linked in CI/agent: report **Database-verified pending** and **Live A–H pending**.
