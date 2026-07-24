-- Glamourous by Mahi · Backfill customer/supplier opening ledger lines
-- Seed and manual current_due updates often skip ledger rows. This migration creates
-- idempotent opening entries so detail KPI cards and ledger tables match current_due.

CREATE OR REPLACE FUNCTION public.backfill_party_opening_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customers integer := 0;
  v_suppliers integer := 0;
  r record;
  v_branch_id uuid;
  v_doc_id uuid;
  v_doc_no text;
BEGIN
  FOR r IN
    SELECT c.*
    FROM public.customers c
    WHERE c.deleted_at IS NULL
      AND c.current_due > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.opening_balance_documents d
        WHERE d.organization_id = c.organization_id
          AND d.document_type = 'customer_opening_balance'
          AND d.party_id = c.id
          AND d.deleted_at IS NULL
      )
      AND coalesce((
        SELECT sum(s.due_total)
        FROM public.sales s
        WHERE s.customer_id = c.id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
      ), 0) = 0
  LOOP
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.organization_id = r.organization_id
      AND b.deleted_at IS NULL
      AND b.is_active
    ORDER BY b.is_central DESC, b.created_at
    LIMIT 1;

    v_doc_no := 'OB-AR-' || replace(r.id::text, '-', '');

    IF NOT EXISTS (
      SELECT 1 FROM public.opening_balance_documents d
      WHERE d.organization_id = r.organization_id
        AND d.client_txn_key = 'backfill-ob-cust:' || r.id::text
        AND d.deleted_at IS NULL
    ) THEN
      INSERT INTO public.opening_balance_documents (
        organization_id, branch_id, document_type, party_id, amount,
        document_no, client_txn_key, notes
      ) VALUES (
        r.organization_id, coalesce(r.branch_id, v_branch_id),
        'customer_opening_balance', r.id, r.current_due,
        v_doc_no, 'backfill-ob-cust:' || r.id::text,
        'Opening AR backfill from current_due'
      )
      RETURNING id INTO v_doc_id;
    ELSE
      SELECT d.id INTO v_doc_id
      FROM public.opening_balance_documents d
      WHERE d.organization_id = r.organization_id
        AND d.client_txn_key = 'backfill-ob-cust:' || r.id::text
        AND d.deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_doc_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.customer_ledger cl
      WHERE cl.customer_id = r.id
        AND cl.entry_type = 'opening'
        AND cl.reference_id = v_doc_id
        AND cl.deleted_at IS NULL
    ) THEN
      INSERT INTO public.customer_ledger (
        organization_id, branch_id, customer_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id, notes
      ) VALUES (
        r.organization_id, coalesce(r.branch_id, v_branch_id), r.id, 'opening',
        r.current_due, 0, r.current_due,
        'opening_balance_document', v_doc_id,
        'Opening AR backfill'
      );
      v_customers := v_customers + 1;
    END IF;
  END LOOP;

  FOR r IN
    SELECT s.*
    FROM public.suppliers s
    WHERE s.deleted_at IS NULL
      AND s.current_due > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id
          AND sl.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.opening_balance_documents d
        WHERE d.organization_id = s.organization_id
          AND d.document_type = 'supplier_opening_balance'
          AND d.party_id = s.id
          AND d.deleted_at IS NULL
      )
      AND coalesce((
        SELECT sum(p.due_total)
        FROM public.purchases p
        WHERE p.supplier_id = s.id
          AND p.deleted_at IS NULL
          AND p.status = 'completed'
      ), 0) = 0
  LOOP
    SELECT b.id INTO v_branch_id
    FROM public.branches b
    WHERE b.organization_id = r.organization_id
      AND b.deleted_at IS NULL
      AND b.is_active
    ORDER BY b.is_central DESC, b.created_at
    LIMIT 1;

    v_doc_no := 'OB-AP-' || replace(r.id::text, '-', '');

    IF NOT EXISTS (
      SELECT 1 FROM public.opening_balance_documents d
      WHERE d.organization_id = r.organization_id
        AND d.client_txn_key = 'backfill-ob-supp:' || r.id::text
        AND d.deleted_at IS NULL
    ) THEN
      INSERT INTO public.opening_balance_documents (
        organization_id, branch_id, document_type, party_id, amount,
        document_no, client_txn_key, notes
      ) VALUES (
        r.organization_id, coalesce(r.branch_id, v_branch_id),
        'supplier_opening_balance', r.id, r.current_due,
        v_doc_no, 'backfill-ob-supp:' || r.id::text,
        'Opening AP backfill from current_due'
      )
      RETURNING id INTO v_doc_id;
    ELSE
      SELECT d.id INTO v_doc_id
      FROM public.opening_balance_documents d
      WHERE d.organization_id = r.organization_id
        AND d.client_txn_key = 'backfill-ob-supp:' || r.id::text
        AND d.deleted_at IS NULL
      LIMIT 1;
    END IF;

    IF v_doc_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.supplier_ledger sl
      WHERE sl.supplier_id = r.id
        AND sl.entry_type = 'opening'
        AND sl.reference_id = v_doc_id
        AND sl.deleted_at IS NULL
    ) THEN
      INSERT INTO public.supplier_ledger (
        organization_id, branch_id, supplier_id, entry_type,
        debit, credit, balance_after, reference_type, reference_id, notes
      ) VALUES (
        r.organization_id, coalesce(r.branch_id, v_branch_id), r.id, 'opening',
        0, r.current_due, r.current_due,
        'opening_balance_document', v_doc_id,
        'Opening AP backfill'
      );
      v_suppliers := v_suppliers + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'customers_backfilled', v_customers,
    'suppliers_backfilled', v_suppliers
  );
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_party_opening_ledgers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_party_opening_ledgers() TO authenticated;

SELECT public.backfill_party_opening_ledgers();
