-- Helper fragment for migration 065 (included by build script)

--------------------------------------------------------------------------------
-- 2. Shared party ledger helpers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._payment_method_is_due(
  p_org_id uuid,
  p_method text
) RETURNS boolean
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_is_due boolean;
  v_method text := lower(btrim(coalesce(p_method, '')));
BEGIN
  SELECT coalesce(pm.is_due, false) INTO v_is_due
  FROM public.payment_methods pm
  WHERE pm.organization_id = p_org_id
    AND lower(pm.code) = v_method
    AND pm.deleted_at IS NULL
    AND pm.is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN v_method IN ('due', 'credit', 'receivable', 'payable');
  END IF;
  RETURN v_is_due;
END;
$$;

CREATE OR REPLACE FUNCTION public._post_customer_ledger_entry(
  p_org_id uuid,
  p_branch_id uuid,
  p_customer_id uuid,
  p_entry_type text,
  p_debit numeric,
  p_credit numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_notes text,
  p_actor uuid,
  p_total_paid_delta numeric DEFAULT 0,
  p_total_spent_delta numeric DEFAULT 0,
  p_skip_party_update boolean DEFAULT false
) RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_balance numeric(14, 2);
BEGIN
  IF p_debit < 0 OR p_credit < 0 THEN
    RAISE EXCEPTION 'Ledger debit/credit cannot be negative';
  END IF;
  IF (p_debit > 0 AND p_credit > 0) OR (p_debit = 0 AND p_credit = 0) THEN
    RAISE EXCEPTION 'Ledger entry must have debit OR credit';
  END IF;

  PERFORM 1 FROM public.customers c
  WHERE c.id = p_customer_id
    AND c.organization_id = p_org_id
    AND c.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  IF p_skip_party_update THEN
    SELECT coalesce(sum(cl.debit - cl.credit), 0)
    INTO v_balance
    FROM public.customer_ledger cl
    WHERE cl.customer_id = p_customer_id
      AND cl.deleted_at IS NULL;
    v_balance := v_balance + p_debit - p_credit;
  ELSE
    UPDATE public.customers
    SET current_due = current_due + p_debit - p_credit,
        total_paid = total_paid + coalesce(p_total_paid_delta, 0),
        total_spent = total_spent + coalesce(p_total_spent_delta, 0),
        updated_by = p_actor
    WHERE id = p_customer_id
    RETURNING current_due INTO v_balance;
  END IF;

  INSERT INTO public.customer_ledger (
    organization_id, branch_id, customer_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_customer_id, p_entry_type,
    p_debit, p_credit, v_balance, p_reference_type, p_reference_id,
    p_notes, p_actor, p_actor
  );

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public._post_supplier_ledger_entry(
  p_org_id uuid,
  p_branch_id uuid,
  p_supplier_id uuid,
  p_entry_type text,
  p_debit numeric,
  p_credit numeric,
  p_reference_type text,
  p_reference_id uuid,
  p_notes text,
  p_actor uuid,
  p_skip_party_update boolean DEFAULT false
) RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_balance numeric(14, 2);
BEGIN
  IF p_debit < 0 OR p_credit < 0 THEN
    RAISE EXCEPTION 'Ledger debit/credit cannot be negative';
  END IF;
  IF (p_debit > 0 AND p_credit > 0) OR (p_debit = 0 AND p_credit = 0) THEN
    RAISE EXCEPTION 'Ledger entry must have debit OR credit';
  END IF;

  PERFORM 1 FROM public.suppliers s
  WHERE s.id = p_supplier_id
    AND s.organization_id = p_org_id
    AND s.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Supplier not found';
  END IF;

  IF p_skip_party_update THEN
    SELECT coalesce(sum(sl.debit - sl.credit), 0)
    INTO v_balance
    FROM public.supplier_ledger sl
    WHERE sl.supplier_id = p_supplier_id
      AND sl.deleted_at IS NULL;
    v_balance := v_balance + p_debit - p_credit;
  ELSE
    UPDATE public.suppliers
    SET current_due = current_due + p_debit - p_credit,
        updated_by = p_actor
    WHERE id = p_supplier_id
    RETURNING current_due INTO v_balance;
  END IF;

  INSERT INTO public.supplier_ledger (
    organization_id, branch_id, supplier_id, entry_type,
    debit, credit, balance_after, reference_type, reference_id,
    notes, created_by, updated_by
  ) VALUES (
    p_org_id, p_branch_id, p_supplier_id, p_entry_type,
    p_debit, p_credit, v_balance, p_reference_type, p_reference_id,
    p_notes, p_actor, p_actor
  );

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_customer_sale_canonical_ledger(
  p_sale_id uuid,
  p_actor uuid,
  p_backfill boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_is_due boolean;
  v_credit numeric(14, 2);
  v_remaining_paid numeric(14, 2) := 0;
  v_spent_delta numeric(14, 2) := 0;
  v_paid_delta numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id
    AND s.deleted_at IS NULL;

  IF NOT FOUND OR v_sale.customer_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_ledger cl
    WHERE cl.customer_id = v_sale.customer_id
      AND cl.reference_type = 'sale'
      AND cl.reference_id = p_sale_id
      AND cl.entry_type = 'sale_invoice'
      AND cl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  v_spent_delta := CASE WHEN p_backfill THEN 0 ELSE v_sale.grand_total END;

  PERFORM public._post_customer_ledger_entry(
    v_sale.organization_id, v_sale.branch_id, v_sale.customer_id,
    'sale_invoice', v_sale.grand_total, 0,
    'sale', p_sale_id,
    'Invoice ' || v_sale.invoice_no,
    p_actor,
    0, v_spent_delta,
    p_backfill
  );

  v_remaining_paid := v_sale.paid_total;

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = p_sale_id
      AND sp.deleted_at IS NULL
      AND sp.reversed_at IS NULL
    ORDER BY sp.created_at, sp.id
  LOOP
    IF v_remaining_paid <= 0 THEN
      EXIT;
    END IF;

    v_is_due := public._payment_method_is_due(v_sale.organization_id, v_payment.method);
    IF v_is_due THEN
      CONTINUE;
    END IF;

    v_credit := least(v_payment.amount, v_remaining_paid);
    IF v_credit <= 0 THEN
      CONTINUE;
    END IF;

    v_remaining_paid := v_remaining_paid - v_credit;
    v_paid_delta := CASE WHEN p_backfill THEN 0 ELSE v_credit END;

    PERFORM public._post_customer_ledger_entry(
      v_sale.organization_id, v_sale.branch_id, v_sale.customer_id,
      'sale_payment', 0, v_credit,
      'sale_payment', v_payment.id,
      'Payment (' || v_payment.method || ') · ' || v_sale.invoice_no,
      p_actor,
      v_paid_delta, 0,
      p_backfill
    );
  END LOOP;

  IF NOT p_backfill
     AND abs(v_sale.due_total - (v_sale.grand_total - v_sale.paid_total)) > 0.02 THEN
    RAISE EXCEPTION 'Customer ledger mismatch for sale %', v_sale.invoice_no;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._apply_supplier_purchase_canonical_ledger(
  p_purchase_id uuid,
  p_actor uuid,
  p_backfill boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_purchase public.purchases%ROWTYPE;
  v_payment public.purchase_payments%ROWTYPE;
  v_is_due boolean;
  v_credit numeric(14, 2);
  v_remaining_paid numeric(14, 2) := 0;
BEGIN
  SELECT * INTO v_purchase
  FROM public.purchases p
  WHERE p.id = p_purchase_id
    AND p.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.supplier_ledger sl
    WHERE sl.supplier_id = v_purchase.supplier_id
      AND sl.reference_type = 'purchase'
      AND sl.reference_id = p_purchase_id
      AND sl.entry_type = 'purchase_invoice'
      AND sl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  PERFORM public._post_supplier_ledger_entry(
    v_purchase.organization_id, v_purchase.branch_id, v_purchase.supplier_id,
    'purchase_invoice', v_purchase.grand_total, 0,
    'purchase', p_purchase_id,
    'Purchase ' || v_purchase.invoice_no,
    p_actor,
    p_backfill
  );

  v_remaining_paid := v_purchase.paid_total;

  FOR v_payment IN
    SELECT * FROM public.purchase_payments pp
    WHERE pp.purchase_id = p_purchase_id
      AND pp.deleted_at IS NULL
    ORDER BY pp.created_at, pp.id
  LOOP
    IF v_remaining_paid <= 0 THEN
      EXIT;
    END IF;

    v_is_due := public._payment_method_is_due(v_purchase.organization_id, v_payment.method);
    IF v_is_due THEN
      CONTINUE;
    END IF;

    v_credit := least(v_payment.amount, v_remaining_paid);
    IF v_credit <= 0 THEN
      CONTINUE;
    END IF;

    v_remaining_paid := v_remaining_paid - v_credit;

    PERFORM public._post_supplier_ledger_entry(
      v_purchase.organization_id, v_purchase.branch_id, v_purchase.supplier_id,
      'purchase_payment', 0, v_credit,
      'purchase_payment', v_payment.id,
      'Payment (' || v_payment.method || ') · ' || v_purchase.invoice_no,
      p_actor,
      p_backfill
    );
  END LOOP;

  IF NOT p_backfill
     AND abs(v_purchase.due_total - (v_purchase.grand_total - v_purchase.paid_total)) > 0.02 THEN
    RAISE EXCEPTION 'Supplier ledger mismatch for purchase %', v_purchase.invoice_no;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._payment_method_is_due(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._post_customer_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, numeric, numeric, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._post_supplier_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._apply_customer_sale_canonical_ledger(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._apply_supplier_purchase_canonical_ledger(uuid, uuid, boolean) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public._reverse_customer_sale_canonical_ledger(
  p_sale_id uuid,
  p_actor uuid,
  p_reason text
) RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_payment public.sale_payments%ROWTYPE;
  v_is_due boolean;
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_sale.customer_id IS NULL THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.customer_ledger cl
    WHERE cl.customer_id = v_sale.customer_id
      AND cl.reference_type = 'sale'
      AND cl.reference_id = p_sale_id
      AND cl.entry_type = 'reversal'
      AND cl.deleted_at IS NULL
  ) THEN
    RETURN;
  END IF;

  PERFORM public._post_customer_ledger_entry(
    v_sale.organization_id, v_sale.branch_id, v_sale.customer_id,
    'reversal', 0, v_sale.grand_total,
    'sale', p_sale_id,
    'Void/reverse invoice ' || v_sale.invoice_no || ': ' || coalesce(p_reason, ''),
    p_actor,
    0, -v_sale.grand_total
  );

  FOR v_payment IN
    SELECT * FROM public.sale_payments sp
    WHERE sp.sale_id = p_sale_id AND sp.deleted_at IS NULL
  LOOP
    v_is_due := public._payment_method_is_due(v_sale.organization_id, v_payment.method);
    IF v_is_due THEN CONTINUE; END IF;

    PERFORM public._post_customer_ledger_entry(
      v_sale.organization_id, v_sale.branch_id, v_sale.customer_id,
      'reversal', v_payment.amount, 0,
      'sale_payment', v_payment.id,
      'Void/reverse payment ' || v_sale.invoice_no,
      p_actor,
      -v_payment.amount, 0
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_customer_sale_canonical_ledger(uuid, uuid, text) FROM PUBLIC, anon;
