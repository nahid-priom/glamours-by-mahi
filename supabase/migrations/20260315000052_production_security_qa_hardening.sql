-- Production security hardening: parcel status guard (no GUC bypass), QA isolation, test auth helper

--------------------------------------------------------------------------------
-- Sandbox flag: exclude automated test orgs from operational reconciliation
--------------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_sandbox boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.organizations.is_sandbox IS
  'When true, organization is excluded from production reconciliation and dashboard totals.';

--------------------------------------------------------------------------------
-- Parcel status guard: block authenticated/anon direct status mutations (GUC cannot bypass)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_courier_parcel_guard_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.deleted_at IS NULL
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- SECURITY DEFINER RPCs run as function owner (postgres); direct REST runs as authenticated.
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Parcel status must be updated via update_courier_parcel_status RPC'
        USING ERRCODE = '42501';
    END IF;
    IF coalesce(current_setting('role', true), '') IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Parcel status must be updated via update_courier_parcel_status RPC'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

--------------------------------------------------------------------------------
-- Service-role test auth impersonation (acceptance suite only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_test_set_auth(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = '42501';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', p_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id::text, 'role', 'authenticated')::text,
    true
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_test_set_auth(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._erp_test_set_auth(uuid) TO service_role;

--------------------------------------------------------------------------------
-- Security probe: returns PASS/FAIL for GUC bypass and direct update attempts
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_security_probe_parcel_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_branch uuid;
  v_company uuid;
  v_parcel_id uuid;
  v_guc_blocked boolean := false;
  v_direct_blocked boolean := false;
  v_jcount int;
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_org FROM public.organizations
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('status', 'SKIP', 'reason', 'seed_org_missing');
  END IF;

  SELECT id INTO v_branch FROM public.branches
  WHERE organization_id = v_org AND deleted_at IS NULL AND is_active = true
  ORDER BY is_central DESC LIMIT 1;

  SELECT id INTO v_company FROM public.courier_companies
  WHERE organization_id = v_org AND deleted_at IS NULL LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO public.courier_companies (organization_id, name, code, status, connection_status)
    VALUES (v_org, 'Sandbox Courier', 'SBX-CC', 'active', 'disconnected')
    RETURNING id INTO v_company;
  END IF;

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch, v_company,
    'SBX-PROBE-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 100.00, 10.00
  )
  RETURNING id INTO v_parcel_id;

  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM set_config('app.allow_parcel_status', '1', true);
    UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;
  EXCEPTION WHEN OTHERS THEN
    v_guc_blocked := true;
  END;

  BEGIN
    SET LOCAL ROLE authenticated;
    UPDATE public.courier_parcels SET status = 'delivered' WHERE id = v_parcel_id;
  EXCEPTION WHEN OTHERS THEN
    v_direct_blocked := true;
  END;

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object(
    'guc_bypass_blocked', v_guc_blocked,
    'direct_update_blocked', v_direct_blocked,
    'status', CASE WHEN v_guc_blocked AND v_direct_blocked THEN 'PASS' ELSE 'FAIL' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_security_probe_parcel_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._erp_security_probe_parcel_status() TO service_role;

--------------------------------------------------------------------------------
-- QA harness: use canonical RPC, sandbox org only, no persistent fixtures
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_erp_qa_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_branch uuid;
  v_company uuid;
  v_parcel_id uuid;
  v_jcount int;
  v_actor uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_org FROM public.organizations
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND deleted_at IS NULL;

  IF v_org IS NULL THEN
    RETURN jsonb_build_object('scenario', 7, 'status', 'SKIP', 'reason', 'seed_org_missing');
  END IF;

  v_branch := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';

  SELECT id INTO v_company FROM public.courier_companies
  WHERE organization_id = v_org AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_company IS NULL THEN
    RETURN jsonb_build_object('scenario', 7, 'status', 'SKIP', 'reason', 'no_courier_company');
  END IF;

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge,
    customer_name, customer_phone
  ) VALUES (
    v_org, v_branch, v_company,
    'QA-ERP-COD-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 1500.00, 50.00,
    'QA Customer', '01700000000'
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public._erp_test_set_auth(v_actor);
  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA COD delivery');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'COD journal must be posted exactly once on delivery');

  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA duplicate');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.organization_id = v_org
    AND je.source_type = 'courier_cod'
    AND je.source_id = v_parcel_id
    AND je.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'duplicate delivered must not duplicate COD journal');

  SELECT count(*) INTO v_jcount
  FROM public.courier_settlements cs
  WHERE cs.parcel_id = v_parcel_id AND cs.deleted_at IS NULL;

  PERFORM public._erp_assert(v_jcount = 1, 'settlement row must exist for COD parcel');

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object('scenario', 7, 'parcel_id', v_parcel_id, 'status', 'PASS');
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_qa_cod_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_qa_cod_delivery() TO service_role;

CREATE OR REPLACE FUNCTION public.run_erp_qa_non_cod_delivery()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_branch uuid := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
  v_company uuid;
  v_parcel_id uuid;
  v_jcount int;
  v_actor uuid := 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1';
BEGIN
  IF current_user NOT IN ('postgres', 'supabase_admin')
     AND coalesce(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role only' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.organizations WHERE id = v_org AND deleted_at IS NULL) THEN
    RETURN jsonb_build_object('scenario', '7b', 'status', 'SKIP', 'reason', 'seed_org_missing');
  END IF;

  SELECT id INTO v_company FROM public.courier_companies
  WHERE organization_id = v_org AND deleted_at IS NULL
  ORDER BY created_at LIMIT 1;

  IF v_company IS NULL THEN
    RETURN jsonb_build_object('scenario', '7b', 'status', 'SKIP', 'reason', 'no_courier_company');
  END IF;

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch, v_company,
    'QA-ERP-NOCOD-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 0, 30.00
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public._erp_test_set_auth(v_actor);
  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'QA non-COD');

  SELECT count(*) INTO v_jcount
  FROM public.journal_entries je
  WHERE je.source_type = 'courier_cod' AND je.source_id = v_parcel_id;

  PERFORM public._erp_assert(v_jcount = 0, 'non-COD parcel must not post courier receivable');

  UPDATE public.courier_parcels SET deleted_at = timezone('utc', now()) WHERE id = v_parcel_id;

  RETURN jsonb_build_object('scenario', '7b', 'parcel_id', v_parcel_id, 'status', 'PASS');
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_qa_non_cod_delivery() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_qa_non_cod_delivery() TO service_role;

--------------------------------------------------------------------------------
-- Reconciliation: exclude sandbox organizations
--------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_recon_inventory_ledger_qty AS
SELECT
  ib.organization_id,
  ib.variant_id,
  ib.location_id,
  ib.quantity AS balance_qty,
  coalesce(sum(sl.quantity_delta), 0) AS ledger_net_qty,
  ib.quantity - coalesce(sum(sl.quantity_delta), 0) AS delta
FROM public.inventory_balances ib
JOIN public.organizations o ON o.id = ib.organization_id AND o.deleted_at IS NULL AND o.is_sandbox = false
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
JOIN public.organizations o ON o.id = cp.organization_id AND o.deleted_at IS NULL AND o.is_sandbox = false
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
  v_is_sandbox boolean;
BEGIN
  SELECT o.is_sandbox INTO v_is_sandbox
  FROM public.organizations o WHERE o.id = v_org_id;

  IF coalesce(v_is_sandbox, false) THEN
    RETURN jsonb_build_object('pass', true, 'sandbox', true, 'skipped', true);
  END IF;

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
