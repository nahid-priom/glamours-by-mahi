# Commission Engine V4 — Staging reconciliation notes

**Status:** dry-run only. Do **not** auto-apply repairs in production.

## RPC

```sql
SELECT public.audit_commission_discrepancies(200);
```

Returns:

- `dry_run: true`
- `discrepancy_count`
- `total_exposure` (sum of numeric differences where present)
- `items[]` with categories:
  - `voided_with_active_commission`
  - `corrected_with_active_commission`
  - `unresolved_attribution`

App path: `commissionsRepository.auditCommissionDiscrepancies(limit)`.

## Staging apply (manual follow-up — not shipped)

Only after reviewing dry-run output on a staging clone:

1. Snapshot `salesman_commissions` for affected `sale_id`s.
2. For voided/corrected rows still active: call
   `SELECT public._reverse_remaining_sale_commissions(sale_id, 'recon_repair', sale_id, 'v4 staging repair', auth.uid());`
   inside an explicit transaction per sale; commit only after residual = 0.
3. Re-run `audit_commission_discrepancies` and confirm `discrepancy_count` drops for repaired categories.
4. Unresolved attribution exceptions require operational assignment (rule/subject), not silent cashier auto-assign.
5. Paid recoverable balances are obligations only — never fabricate Cash/Bank receipts during repair.

## Smoke

```bash
# After migrations 133 + 134 applied
psql "$DATABASE_URL" -f supabase/tests/sql/commission_engine_v4_smoke.sql
```
