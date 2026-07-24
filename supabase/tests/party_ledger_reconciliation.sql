-- Party ledger reconciliation (read-only dry run)
-- Run after migration 065: npx supabase db query --local --file supabase/tests/party_ledger_reconciliation.sql

BEGIN;

DO $$
DECLARE
  v_mismatch int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      c.id,
      c.name,
      c.current_due,
      coalesce(sum(cl.debit - cl.credit), 0) AS ledger_net
    FROM public.customers c
    LEFT JOIN public.customer_ledger cl
      ON cl.customer_id = c.id AND cl.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, c.name, c.current_due
    HAVING abs(c.current_due - coalesce(sum(cl.debit - cl.credit), 0)) > 0.02
  LOOP
    v_mismatch := v_mismatch + 1;
    RAISE WARNING 'Customer due mismatch: % current_due=% ledger_net=%',
      r.name, r.current_due, r.ledger_net;
  END LOOP;

  FOR r IN
    SELECT
      s.id,
      s.invoice_no,
      s.grand_total,
      s.paid_total,
      s.due_total
    FROM public.sales s
    WHERE s.deleted_at IS NULL
      AND s.status = 'completed'
      AND abs(s.grand_total - (s.paid_total + s.due_total)) > 0.02
  LOOP
    v_mismatch := v_mismatch + 1;
    RAISE WARNING 'Sale total mismatch: % grand=% paid=% due=%',
      r.invoice_no, r.grand_total, r.paid_total, r.due_total;
  END LOOP;

  FOR r IN
    SELECT
      sp.id,
      sp.name,
      sp.current_due,
      coalesce(sum(sl.debit - sl.credit), 0) AS ledger_net
    FROM public.suppliers sp
    LEFT JOIN public.supplier_ledger sl
      ON sl.supplier_id = sp.id AND sl.deleted_at IS NULL
    WHERE sp.deleted_at IS NULL
    GROUP BY sp.id, sp.name, sp.current_due
    HAVING abs(sp.current_due - coalesce(sum(sl.debit - sl.credit), 0)) > 0.02
  LOOP
    v_mismatch := v_mismatch + 1;
    RAISE WARNING 'Supplier due mismatch: % current_due=% ledger_net=%',
      r.name, r.current_due, r.ledger_net;
  END LOOP;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'Party ledger reconciliation failed: % mismatch(es)', v_mismatch;
  END IF;

  RAISE NOTICE 'Party ledger reconciliation passed';
END $$;

ROLLBACK;
