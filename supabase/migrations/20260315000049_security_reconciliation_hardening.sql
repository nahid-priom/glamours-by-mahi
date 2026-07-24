-- Reconciliation helpers and security verification views

CREATE OR REPLACE VIEW public.v_recon_inventory_ledger_qty AS
SELECT
  ib.organization_id,
  ib.variant_id,
  ib.location_id,
  ib.quantity AS balance_qty,
  coalesce(sum(sl.quantity_delta), 0) AS ledger_net_qty,
  ib.quantity - coalesce(sum(sl.quantity_delta), 0) AS delta
FROM public.inventory_balances ib
LEFT JOIN public.stock_ledger sl
  ON sl.organization_id = ib.organization_id
  AND sl.variant_id = ib.variant_id
  AND sl.location_id = ib.location_id
  AND sl.deleted_at IS NULL
WHERE ib.deleted_at IS NULL
GROUP BY ib.organization_id, ib.variant_id, ib.location_id, ib.quantity
HAVING abs(ib.quantity - coalesce(sum(sl.quantity_delta), 0)) > 0.0005;

CREATE OR REPLACE VIEW public.v_recon_courier_cod_pending AS
SELECT
  cp.organization_id,
  cp.id AS parcel_id,
  cp.tracking_no,
  cp.cod_amount,
  cs.id AS settlement_id,
  cs.status AS settlement_status,
  EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = cp.organization_id
      AND je.source_type = 'courier_cod'
      AND je.source_id = cp.id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
  ) AS cod_journal_posted
FROM public.courier_parcels cp
LEFT JOIN public.courier_settlements cs
  ON cs.parcel_id = cp.id AND cs.deleted_at IS NULL
WHERE cp.deleted_at IS NULL
  AND cp.status = 'delivered'
  AND cp.cod_amount > 0;

CREATE OR REPLACE FUNCTION public.get_erp_reconciliation_summary(p_branch_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_inv_delta bigint;
  v_cust_delta numeric(14, 2);
  v_supp_delta numeric(14, 2);
  v_cod_missing bigint;
  v_comm_pending numeric(14, 2);
  v_valuation numeric(14, 2);
  v_dashboard numeric(14, 2);
BEGIN
  IF NOT (
    public.user_has_permission('reconciliation.read')
    OR public.user_has_permission('inventory.valuation')
    OR public.user_has_permission('accounting.view')
  ) THEN
    RAISE EXCEPTION 'Missing reconciliation permission' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_inv_delta
  FROM public.v_recon_inventory_ledger_qty v
  WHERE v.organization_id = v_org_id;

  SELECT coalesce(sum(abs(delta)), 0) INTO v_cust_delta
  FROM public.v_recon_customer_due_vs_sales
  WHERE organization_id = v_org_id;

  SELECT coalesce(sum(abs(delta)), 0) INTO v_supp_delta
  FROM public.v_recon_supplier_due_vs_purchases
  WHERE organization_id = v_org_id;

  SELECT count(*) INTO v_cod_missing
  FROM public.v_recon_courier_cod_pending v
  WHERE v.organization_id = v_org_id
    AND NOT v.cod_journal_posted;

  SELECT coalesce(sum(sc.commission_amount), 0) INTO v_comm_pending
  FROM public.salesman_commissions sc
  WHERE sc.organization_id = v_org_id
    AND sc.status = 'approved'
    AND sc.deleted_at IS NULL
    AND (p_branch_id IS NULL OR sc.branch_id = p_branch_id);

  SELECT coalesce(s.total_stock_value, 0) INTO v_valuation
  FROM public.get_inventory_valuation_summary(
    p_branch_id, NULL, NULL, NULL, NULL, NULL, false
  ) s
  LIMIT 1;

  v_dashboard := v_valuation;

  RETURN jsonb_build_object(
    'inventory_ledger_mismatches', v_inv_delta,
    'customer_due_delta_sum', v_cust_delta,
    'supplier_due_delta_sum', v_supp_delta,
    'delivered_cod_missing_journal', v_cod_missing,
    'approved_unpaid_commission', v_comm_pending,
    'inventory_valuation_total', v_valuation,
    'dashboard_stock_value', v_dashboard,
    'valuation_matches_dashboard', v_valuation = v_dashboard,
    'pass', v_inv_delta = 0 AND v_cod_missing = 0 AND v_cust_delta = 0 AND v_supp_delta = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_erp_reconciliation_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_erp_reconciliation_summary(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Block direct parcel status mutations; canonical RPC sets bypass flag
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_courier_parcel_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NULL
     AND OLD.status IS DISTINCT FROM NEW.status
     AND current_setting('app.allow_parcel_status', true) IS DISTINCT FROM '1' THEN
    RAISE EXCEPTION 'Parcel status must be updated via update_courier_parcel_status RPC'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS courier_parcels_guard_status ON public.courier_parcels;
CREATE TRIGGER courier_parcels_guard_status
  BEFORE UPDATE OF status ON public.courier_parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_courier_parcel_guard_status();
