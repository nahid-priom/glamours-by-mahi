-- Reverse or pro-rate salesperson commissions when a sale return is posted

CREATE OR REPLACE FUNCTION public._reverse_sale_commissions(
  p_sale_id uuid,
  p_return_id uuid,
  p_return_total numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sale public.sales%ROWTYPE;
  v_comm public.salesman_commissions%ROWTYPE;
  v_ratio numeric(14, 6);
  v_reverse numeric(14, 2);
BEGIN
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id AND deleted_at IS NULL;
  IF NOT FOUND OR COALESCE(v_sale.grand_total, 0) <= 0 THEN RETURN; END IF;

  v_ratio := least(greatest(p_return_total / v_sale.grand_total, 0), 1);

  FOR v_comm IN
    SELECT * FROM public.salesman_commissions sc
    WHERE sc.sale_id = p_sale_id
      AND sc.deleted_at IS NULL
      AND sc.status IN ('pending', 'approved', 'paid')
    FOR UPDATE
  LOOP
    v_reverse := round(v_comm.commission_amount * v_ratio, 2);
    IF v_reverse <= 0 THEN CONTINUE; END IF;

    IF v_comm.status = 'paid' AND v_comm.financial_account_id IS NOT NULL THEN
      PERFORM public._post_financial_txn(
        v_comm.organization_id,
        v_comm.branch_id,
        v_comm.financial_account_id,
        'commission_reversal',
        'in',
        v_reverse,
        'sale_return',
        p_return_id,
        'Commission reversal',
        'Commission reversal on sale return',
        public.current_profile_id(),
        true
      );
    END IF;

    UPDATE public.salesman_commissions
    SET status = 'reversed',
        commission_amount = greatest(commission_amount - v_reverse, 0),
        notes = coalesce(notes, '') || ' reversed:' || p_return_id::text,
        updated_at = timezone('utc', now())
    WHERE id = v_comm.id;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._reverse_sale_commissions(uuid, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._reverse_sale_commissions(uuid, uuid, numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_sale_return_reverse_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.sale_id IS NOT NULL THEN
    PERFORM public._reverse_sale_commissions(NEW.sale_id, NEW.id, COALESCE(NEW.total, 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sale_returns_reverse_commission ON public.sale_returns;
CREATE TRIGGER sale_returns_reverse_commission
  AFTER INSERT ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sale_return_reverse_commission();
