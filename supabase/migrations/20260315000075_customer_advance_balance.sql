-- Migration 075: Customer advance balance (ledger-derived cache)
-- Due = max(0, net); Advance = max(0, -net). Ledger remains source of truth.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS current_advance numeric(14, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_advance_non_negative'
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_advance_non_negative CHECK (current_advance >= 0);
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Update party totals from signed ledger net
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._apply_customer_balance_from_net(
  p_customer_id uuid,
  p_signed_net numeric,
  p_actor uuid,
  p_total_paid_delta numeric DEFAULT 0,
  p_total_spent_delta numeric DEFAULT 0
) RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_due numeric(14, 2);
  v_advance numeric(14, 2);
BEGIN
  v_due := greatest(0, coalesce(p_signed_net, 0));
  v_advance := greatest(0, -coalesce(p_signed_net, 0));

  UPDATE public.customers
  SET current_due = v_due,
      current_advance = v_advance,
      total_paid = total_paid + coalesce(p_total_paid_delta, 0),
      total_spent = total_spent + coalesce(p_total_spent_delta, 0),
      updated_by = p_actor,
      updated_at = timezone('utc', now())
  WHERE id = p_customer_id;

  RETURN coalesce(p_signed_net, 0);
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
  v_prev_due numeric(14, 2);
  v_prev_advance numeric(14, 2);
  v_balance numeric(14, 2);
BEGIN
  IF p_debit < 0 OR p_credit < 0 THEN
    RAISE EXCEPTION 'Ledger debit/credit cannot be negative';
  END IF;
  IF (p_debit > 0 AND p_credit > 0) OR (p_debit = 0 AND p_credit = 0) THEN
    RAISE EXCEPTION 'Ledger entry must have debit OR credit';
  END IF;

  SELECT c.current_due, c.current_advance
  INTO v_prev_due, v_prev_advance
  FROM public.customers c
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
    v_balance := public._apply_customer_balance_from_net(
      p_customer_id,
      coalesce(v_prev_due, 0) - coalesce(v_prev_advance, 0) + p_debit - p_credit,
      p_actor,
      p_total_paid_delta,
      p_total_spent_delta
    );
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

CREATE OR REPLACE FUNCTION public._sync_customer_ledger_totals(p_customer_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.customers c
  SET current_due = greatest(0, coalesce((
        SELECT sum(cl.debit - cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
      ), 0)),
      current_advance = greatest(0, -coalesce((
        SELECT sum(cl.debit - cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
      ), 0)),
      total_spent = coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.customer_id = c.id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
      ), 0),
      total_paid = coalesce((
        SELECT sum(cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
          AND cl.entry_type IN ('sale_payment', 'collection')
      ), 0)
  WHERE c.deleted_at IS NULL
    AND (p_customer_id IS NULL OR c.id = p_customer_id);
END;
$$;

-- Backfill advance from existing ledger nets (due already clamped; recompute both)
SELECT public._sync_customer_ledger_totals(NULL);

REVOKE ALL ON FUNCTION public._apply_customer_balance_from_net(uuid, numeric, uuid, numeric, numeric)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._apply_customer_balance_from_net(uuid, numeric, uuid, numeric, numeric)
  TO service_role;

REVOKE ALL ON FUNCTION public._post_customer_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, numeric, numeric, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._post_customer_ledger_entry(uuid, uuid, uuid, text, numeric, numeric, text, uuid, text, uuid, numeric, numeric, boolean)
  TO service_role;

REVOKE ALL ON FUNCTION public._sync_customer_ledger_totals(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._sync_customer_ledger_totals(uuid) TO service_role;
