# 04 — RPC Posting

Authoritative POS path unchanged:
`complete_pos_sale` → `_complete_pos_sale_core` (sale, items, payments, inventory WAC, customer ledger, journal, audit).

Related: `complete_purchase`, `collect_customer_due`, `pay_supplier`, `approve_sales_return`, `void_sale`.

UI double-submit: POS `busy` guard + `client_txn_key` idempotency.
