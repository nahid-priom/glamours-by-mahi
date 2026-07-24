-- Partial courier settlement, settlement reversal, branch isolation probe, production recon

--------------------------------------------------------------------------------
-- Partial settlement support
--------------------------------------------------------------------------------
ALTER TABLE public.courier_settlements
  ADD COLUMN IF NOT EXISTS settled_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.courier_settlements
  DROP CONSTRAINT IF EXISTS courier_settlements_status_check;

ALTER TABLE public.courier_settlements
  ADD CONSTRAINT courier_settlements_status_check
  CHECK (status IN ('pending', 'partially_settled', 'settled', 'disputed'));

--------------------------------------------------------------------------------
-- settle_courier_settlement: optional partial amount, accumulates settled_amount
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_courier_settlement(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_settlement_id uuid;
  v_client_txn_key text;
  v_fin_acct uuid;
  v_cs public.courier_settlements%ROWTYPE;
  v_courier_recv_coa uuid;
  v_courier_exp_coa uuid;
  v_cash_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
  v_net_total numeric(14, 2);
  v_settled_before numeric(14, 2);
  v_remaining numeric(14, 2);
  v_pay numeric(14, 2);
  v_ratio numeric(14, 8);
  v_cod_slice numeric(14, 2);
  v_charge_slice numeric(14, 2);
  v_settled_after numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('courier.settle') THEN
    RAISE EXCEPTION 'Missing permission courier.settle' USING ERRCODE = '42501';
  END IF;

  v_settlement_id := NULLIF(payload->>'settlement_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_fin_acct := NULLIF(payload->>'financial_account_id', '')::uuid;

  IF v_settlement_id IS NULL THEN RAISE EXCEPTION 'settlement_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;
  IF v_fin_acct IS NULL THEN RAISE EXCEPTION 'financial_account_id is required'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = v_org_id
      AND je.source_type = 'courier_settlement'
      AND je.memo LIKE '%' || v_client_txn_key || '%'
      AND je.deleted_at IS NULL
      AND je.status = 'posted'
  ) THEN
    RETURN jsonb_build_object('settlement_id', v_settlement_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_cs
  FROM public.courier_settlements cs
  WHERE cs.id = v_settlement_id
    AND cs.organization_id = v_org_id
    AND cs.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_cs.status = 'settled' THEN
    RETURN jsonb_build_object('settlement_id', v_cs.id, 'idempotent', true);
  END IF;
  IF v_cs.status NOT IN ('pending', 'partially_settled') THEN
    RAISE EXCEPTION 'Settlement cannot be posted from status %', v_cs.status;
  END IF;

  IF v_cs.branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_cs.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  v_net_total := COALESCE(
    NULLIF(v_cs.settlement_amount, 0),
    v_cs.cod_amount - v_cs.courier_charge - v_cs.return_charge
  );
  v_settled_before := COALESCE(v_cs.settled_amount, 0);
  v_remaining := round(v_net_total - v_settled_before, 2);
  v_pay := round(COALESCE((payload->>'amount')::numeric, v_remaining), 2);

  IF v_pay <= 0 OR v_pay > v_remaining + 0.009 THEN
    RAISE EXCEPTION 'Invalid settlement amount %; remaining %', v_pay, v_remaining;
  END IF;

  v_ratio := CASE WHEN v_net_total > 0 THEN v_pay / v_net_total ELSE 0 END;
  v_cod_slice := round(v_cs.cod_amount * v_ratio, 2);
  v_charge_slice := round((v_cs.courier_charge + v_cs.return_charge) * v_ratio, 2);
  v_settled_after := round(v_settled_before + v_pay, 2);

  PERFORM public._post_financial_txn(
    v_org_id, v_cs.branch_id, v_fin_acct,
    'courier_settlement', 'in', v_pay,
    'courier_settlement', v_cs.id,
    'Courier settlement ' || v_client_txn_key,
    'Courier settlement COD net (partial)',
    v_profile_id, true
  );

  v_courier_recv_coa := public._coa_by_role(v_org_id, 'courier_receivable');
  v_courier_exp_coa := public._coa_by_role(v_org_id, 'courier_expense');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');

  IF v_courier_recv_coa IS NOT NULL THEN
    v_entry_no := 'JE-CSET-' || replace(v_cs.id::text, '-', '') || '-' ||
      left(encode(extensions.digest(v_client_txn_key, 'sha256'), 'hex'), 8);

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_cs.branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'courier_settlement', v_cs.id,
      'Courier settlement ' || v_client_txn_key,
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES
      (v_org_id, v_journal_id, COALESCE(v_cash_coa, v_courier_recv_coa),
       'Cash from courier', v_pay, 0, 1, v_profile_id, v_profile_id);

    IF v_charge_slice > 0 AND v_courier_exp_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_courier_exp_coa,
        'Courier charges', v_charge_slice, 0, 2, v_profile_id, v_profile_id
      );
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_courier_recv_coa,
      'Clear courier receivable', 0, v_cod_slice, 3, v_profile_id, v_profile_id
    );
  END IF;

  UPDATE public.courier_settlements
  SET status = CASE
        WHEN v_settled_after >= v_net_total - 0.009 THEN 'settled'
        ELSE 'partially_settled'
      END,
      settled_amount = v_settled_after,
      settlement_date = (timezone('utc', now()))::date,
      financial_account_id = v_fin_acct,
      client_txn_key = COALESCE(client_txn_key, v_client_txn_key),
      updated_by = v_profile_id
  WHERE id = v_cs.id;

  RETURN jsonb_build_object(
    'settlement_id', v_cs.id,
    'amount_posted', v_pay,
    'settled_amount', v_settled_after,
    'remaining', round(v_net_total - v_settled_after, 2),
    'status', CASE WHEN v_settled_after >= v_net_total - 0.009 THEN 'settled' ELSE 'partially_settled' END,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_courier_settlement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_courier_settlement(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- reverse_courier_settlement: linked journal + FT reversal, restore pending
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reverse_courier_settlement(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_settlement_id uuid;
  v_client_txn_key text;
  v_reason text;
  v_cs public.courier_settlements%ROWTYPE;
  v_rev_journal uuid;
  v_ft record;
  v_reversed_journals int := 0;
  v_voided_txns int := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('courier.settle')
    OR public.user_has_permission('transactions.void')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission to reverse settlement' USING ERRCODE = '42501';
  END IF;

  v_settlement_id := NULLIF(payload->>'settlement_id', '')::uuid;
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_reason := NULLIF(btrim(payload->>'reason'), '');

  IF v_settlement_id IS NULL THEN RAISE EXCEPTION 'settlement_id is required'; END IF;
  IF v_client_txn_key IS NULL THEN RAISE EXCEPTION 'client_txn_key is required'; END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'reason is required'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = v_org_id
      AND je.source_type = 'courier_settlement_reversal'
      AND je.source_id = v_settlement_id
      AND je.memo LIKE '%' || v_client_txn_key || '%'
      AND je.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object('settlement_id', v_settlement_id, 'idempotent', true);
  END IF;

  SELECT * INTO v_cs
  FROM public.courier_settlements cs
  WHERE cs.id = v_settlement_id
    AND cs.organization_id = v_org_id
    AND cs.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Settlement not found'; END IF;
  IF v_cs.status NOT IN ('settled', 'partially_settled') THEN
    RAISE EXCEPTION 'Only settled settlements can be reversed';
  END IF;

  IF v_cs.branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_cs.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  LOOP
    v_rev_journal := public._reverse_journal_for_source(
      v_org_id, v_cs.branch_id, 'courier_settlement', v_cs.id,
      'Reverse settlement ' || v_client_txn_key || ': ' || v_reason,
      v_profile_id
    );
    EXIT WHEN v_rev_journal IS NULL;
    v_reversed_journals := v_reversed_journals + 1;
  END LOOP;

  FOR v_ft IN
    SELECT * FROM public.financial_transactions ft
    WHERE ft.organization_id = v_org_id
      AND ft.source_type = 'courier_settlement'
      AND ft.source_id = v_cs.id
      AND ft.status = 'posted'
      AND ft.deleted_at IS NULL
      AND ft.voided_at IS NULL
  LOOP
    IF v_ft.direction = 'in' THEN
      PERFORM public.adjust_financial_account_balance(v_ft.account_id, -v_ft.amount);
    ELSE
      PERFORM public.adjust_financial_account_balance(v_ft.account_id, v_ft.amount);
    END IF;
    UPDATE public.financial_transactions
    SET status = 'voided',
        voided_at = timezone('utc', now()),
        voided_by = v_profile_id,
        void_reason = v_reason,
        updated_at = timezone('utc', now())
    WHERE id = v_ft.id;
    v_voided_txns := v_voided_txns + 1;
  END LOOP;

  UPDATE public.courier_settlements
  SET status = 'pending',
      settled_amount = 0,
      settlement_date = NULL,
      updated_by = v_profile_id,
      notes = coalesce(notes || E'\n', '') || 'Reversed: ' || v_reason
  WHERE id = v_cs.id;

  INSERT INTO public.journal_entries (
    organization_id, branch_id, entry_no, entry_date, status,
    source_type, source_id, memo, posted_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_cs.branch_id,
    'JE-CSREV-' || left(replace(v_client_txn_key, '-', ''), 16),
    (timezone('utc', now()))::date, 'posted',
    'courier_settlement_reversal', v_cs.id,
    'Settlement reversal marker ' || v_client_txn_key,
    timezone('utc', now()), v_profile_id, v_profile_id
  );

  RETURN jsonb_build_object(
    'settlement_id', v_cs.id,
    'reversed_journals', v_reversed_journals,
    'voided_transactions', v_voided_txns,
    'status', 'pending',
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_courier_settlement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_courier_settlement(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Sandbox Branch B-only user for RLS probes
--------------------------------------------------------------------------------
INSERT INTO public.roles (id, organization_id, name, description, is_system)
VALUES (
  '99999999-9999-9999-9999-999999999903',
  '99999999-9999-9999-9999-999999999999',
  'Sandbox Branch B Clerk',
  'Branch B only acceptance probe',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT '99999999-9999-9999-9999-999999999903', p.id
FROM public.permissions p
WHERE p.deleted_at IS NULL
  AND p.key IN (
    'inventory.read', 'inventory.transfer', 'courier.read', 'courier.settle',
    'sales.read', 'purchases.create', 'accounts.read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = '99999999-9999-9999-9999-999999999903'
      AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

DO $$
DECLARE
  v_user_id uuid := '99999999-9999-9999-9999-999999999904';
  v_email text := 'erp-qa-branch-b@internal.invalid';
  v_org_id uuid := '99999999-9999-9999-9999-999999999999';
  v_role_id uuid := '99999999-9999-9999-9999-999999999903';
  v_branch_b uuid := '99999999-9999-9999-9999-999999999992';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_email, extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
      timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"ERP QA Branch B"}'::jsonb,
      timezone('utc', now()), timezone('utc', now()), '', '', '', ''
    );
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_user_id, v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
      'email', v_user_id::text,
      timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
    );
  END IF;

  INSERT INTO public.profiles (
    id, organization_id, full_name, email, role_id, default_branch_id, is_active
  ) VALUES (
    v_user_id, v_org_id, 'ERP QA Branch B', v_email, v_role_id, v_branch_b, true
  )
  ON CONFLICT (id) DO UPDATE SET
    role_id = EXCLUDED.role_id,
    default_branch_id = EXCLUDED.default_branch_id,
    is_active = true,
    deleted_at = NULL;

  DELETE FROM public.user_branch_access
  WHERE user_id = v_user_id AND organization_id = v_org_id;

  INSERT INTO public.user_branch_access (organization_id, user_id, branch_id)
  VALUES (v_org_id, v_user_id, v_branch_b);
END $$;

--------------------------------------------------------------------------------
-- Branch isolation security probe (service_role only)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._erp_security_probe_branch_isolation()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := (public._erp_qa_context()->>'org_id')::uuid;
  v_branch_a uuid := (public._erp_qa_context()->>'branch_id')::uuid;
  v_branch_b uuid := (public._erp_qa_context()->>'branch_b_id')::uuid;
  v_user_b uuid := '99999999-9999-9999-9999-999999999904'::uuid;
  v_company uuid := (public._erp_qa_context()->>'courier_company_id')::uuid;
  v_parcel_id uuid;
  v_settlement_id uuid;
  v_loc_a uuid;
  v_loc_b uuid;
  v_count_a int;
  v_count_b int;
  v_settle_blocked boolean := false;
  v_inv_blocked boolean := false;
BEGIN
  PERFORM public._erp_qa_require_service();

  v_loc_a := public._saleable_location(v_org, v_branch_a);
  v_loc_b := public._saleable_location(v_org, v_branch_b);

  INSERT INTO public.courier_parcels (
    organization_id, branch_id, courier_company_id,
    tracking_no, status, cod_amount, courier_charge
  ) VALUES (
    v_org, v_branch_a, v_company,
    'SBX-BRISO-' || replace(gen_random_uuid()::text, '-', ''),
    'in_transit', 500.00, 20.00
  )
  RETURNING id INTO v_parcel_id;

  PERFORM public._erp_test_set_auth('99999999-9999-9999-9999-999999999902'::uuid);
  PERFORM public.update_courier_parcel_status(v_parcel_id, 'delivered', 'branch iso probe');

  SELECT id INTO v_settlement_id FROM public.courier_settlements
  WHERE parcel_id = v_parcel_id AND deleted_at IS NULL;

  PERFORM public._erp_test_set_auth(v_user_b);
  BEGIN
    PERFORM public.settle_courier_settlement(jsonb_build_object(
      'settlement_id', v_settlement_id,
      'financial_account_id', (public._erp_qa_context()->>'cash_account_id')::uuid,
      'client_txn_key', 'br-iso-' || replace(gen_random_uuid()::text, '-', '')
    ));
  EXCEPTION WHEN OTHERS THEN
    v_settle_blocked := true;
  END;

  PERFORM public._erp_test_set_auth(v_user_b);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_count_a
  FROM public.inventory_balances ib
  JOIN public.stock_locations sl ON sl.id = ib.location_id AND sl.deleted_at IS NULL
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND sl.branch_id = v_branch_a;

  SELECT count(*) INTO v_count_b
  FROM public.inventory_balances ib
  JOIN public.stock_locations sl ON sl.id = ib.location_id AND sl.deleted_at IS NULL
  WHERE ib.organization_id = v_org
    AND ib.deleted_at IS NULL
    AND sl.branch_id = v_branch_b;

  RESET ROLE;

  v_inv_blocked := (v_count_a = 0 AND v_count_b >= 0);

  PERFORM public._erp_qa_cleanup_tracking('SBX-BRISO-');

  RETURN jsonb_build_object(
    'branch_b_settle_branch_a_blocked', v_settle_blocked,
    'branch_b_cannot_see_branch_a_inventory', v_inv_blocked,
    'branch_a_inventory_visible_to_b', v_count_a,
    'status', CASE WHEN v_settle_blocked AND v_inv_blocked THEN 'PASS' ELSE 'FAIL' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public._erp_security_probe_branch_isolation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._erp_security_probe_branch_isolation() TO service_role;

--------------------------------------------------------------------------------
-- Production reconciliation report (read-only, non-sandbox orgs)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_erp_production_reconciliation_report()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_results jsonb := '[]'::jsonb;
  r record;
  v_row jsonb;
BEGIN
  PERFORM public._erp_qa_require_service();

  FOR r IN
    SELECT o.id, o.name, o.slug
    FROM public.organizations o
    WHERE o.deleted_at IS NULL
      AND coalesce(o.is_sandbox, false) = false
    ORDER BY o.created_at
  LOOP
    v_row := jsonb_build_object('organization_id', r.id, 'name', r.name, 'slug', r.slug);

    SELECT v_row || jsonb_build_object(
      'inventory_ledger_mismatches', count(*)
    ) INTO v_row
    FROM public.v_recon_inventory_ledger_qty v
    WHERE v.organization_id = r.id;

    SELECT v_row || jsonb_build_object(
      'delivered_cod_missing_journal', count(*)
    ) INTO v_row
    FROM public.v_recon_courier_cod_pending v
    WHERE v.organization_id = r.id AND NOT v.cod_journal_posted;

    SELECT v_row || jsonb_build_object(
      'customer_due_delta_sum', coalesce(sum(abs(delta)), 0)
    ) INTO v_row
    FROM public.v_recon_customer_due_vs_sales
    WHERE organization_id = r.id;

    SELECT v_row || jsonb_build_object(
      'supplier_due_delta_sum', coalesce(sum(abs(delta)), 0)
    ) INTO v_row
    FROM public.v_recon_supplier_due_vs_purchases
    WHERE organization_id = r.id;

    v_row := v_row || jsonb_build_object(
      'pass',
      (v_row->>'inventory_ledger_mismatches')::int = 0
      AND (v_row->>'delivered_cod_missing_journal')::int = 0
      AND (v_row->>'customer_due_delta_sum')::numeric = 0
      AND (v_row->>'supplier_due_delta_sum')::numeric = 0
    );

    v_results := v_results || jsonb_build_array(v_row);
  END LOOP;

  RETURN jsonb_build_object(
    'generated_at', timezone('utc', now()),
    'organizations', v_results,
    'pass_count', (SELECT count(*) FROM jsonb_array_elements(v_results) e WHERE (e->>'pass')::boolean),
    'fail_count', (SELECT count(*) FROM jsonb_array_elements(v_results) e WHERE NOT (e->>'pass')::boolean)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.run_erp_production_reconciliation_report() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_erp_production_reconciliation_report() TO service_role;
