-- Courier COD receivable accrual and settlement accounting

ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_system_role_check;

ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_system_role_check
  CHECK (
    system_role IS NULL
    OR system_role = ANY (ARRAY[
      'cash', 'bank', 'mobile_money', 'receivable', 'payable',
      'inventory_asset', 'cogs', 'sales_revenue', 'sales_return',
      'purchase', 'tax_payable', 'tax_receivable', 'refund_payable',
      'opening_balance_equity', 'courier_receivable', 'courier_expense'
    ])
  );

INSERT INTO public.chart_of_accounts (
  organization_id, code, name, account_type, system_role, is_postable, is_active
)
SELECT o.id, '1250', 'Courier COD Receivable', 'asset', 'courier_receivable', true, true
FROM public.organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id
      AND c.system_role = 'courier_receivable'
      AND c.deleted_at IS NULL
  );

INSERT INTO public.chart_of_accounts (
  organization_id, code, name, account_type, system_role, is_postable, is_active
)
SELECT o.id, '6100', 'Courier Delivery Expense', 'expense', 'courier_expense', true, true
FROM public.organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id
      AND c.system_role = 'courier_expense'
      AND c.deleted_at IS NULL
  );

ALTER TABLE public.courier_settlements
  ADD COLUMN IF NOT EXISTS client_txn_key text;

CREATE UNIQUE INDEX IF NOT EXISTS courier_settlements_org_client_txn_active_uidx
  ON public.courier_settlements (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

--------------------------------------------------------------------------------
-- Accrue courier COD receivable when parcel is delivered
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_courier_cod_receivable(p_parcel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_parcel public.courier_parcels%ROWTYPE;
  v_settlement_id uuid;
  v_courier_recv_coa uuid;
  v_recv_coa uuid;
  v_journal_id uuid;
  v_entry_no text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('courier.settle')
     AND NOT public.user_has_permission('courier.book') THEN
    RAISE EXCEPTION 'Missing courier permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_parcel
  FROM public.courier_parcels cp
  WHERE cp.id = p_parcel_id
    AND cp.organization_id = v_org_id
    AND cp.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Parcel not found'; END IF;

  IF COALESCE(v_parcel.cod_amount, 0) <= 0 THEN
    RETURN jsonb_build_object('parcel_id', p_parcel_id, 'skipped', true, 'reason', 'no_cod');
  END IF;

  SELECT id INTO v_settlement_id
  FROM public.courier_settlements cs
  WHERE cs.parcel_id = p_parcel_id
    AND cs.organization_id = v_org_id
    AND cs.deleted_at IS NULL
  LIMIT 1;

  IF v_settlement_id IS NULL THEN
    INSERT INTO public.courier_settlements (
      organization_id, branch_id, courier_company_id, parcel_id, sale_id,
      cod_amount, courier_charge, return_charge, settlement_amount,
      status, created_by, updated_by
    ) VALUES (
      v_org_id, v_parcel.branch_id, v_parcel.courier_company_id, v_parcel.id, v_parcel.sale_id,
      v_parcel.cod_amount, COALESCE(v_parcel.courier_charge, 0), 0,
      GREATEST(v_parcel.cod_amount - COALESCE(v_parcel.courier_charge, 0), 0),
      'pending', v_profile_id, v_profile_id
    )
    RETURNING id INTO v_settlement_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries je
    WHERE je.organization_id = v_org_id
      AND je.source_type = 'courier_cod'
      AND je.source_id = p_parcel_id
      AND je.status = 'posted'
      AND je.deleted_at IS NULL
  ) THEN
    RETURN jsonb_build_object(
      'parcel_id', p_parcel_id,
      'settlement_id', v_settlement_id,
      'idempotent', true
    );
  END IF;

  v_courier_recv_coa := public._coa_by_role(v_org_id, 'courier_receivable');
  v_recv_coa := public._coa_by_role(v_org_id, 'receivable');

  IF v_courier_recv_coa IS NOT NULL AND v_recv_coa IS NOT NULL THEN
    v_entry_no := 'JE-COD-' || replace(p_parcel_id::text, '-', '');

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_parcel.branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'courier_cod', p_parcel_id,
      'Courier COD receivable TRK ' || COALESCE(v_parcel.tracking_no, ''),
      timezone('utc', now()), v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES
      (v_org_id, v_journal_id, v_courier_recv_coa, 'Courier COD receivable', v_parcel.cod_amount, 0, 1, v_profile_id, v_profile_id),
      (v_org_id, v_journal_id, v_recv_coa, 'Customer receivable relief', 0, v_parcel.cod_amount, 2, v_profile_id, v_profile_id);
  END IF;

  UPDATE public.courier_parcels
  SET status = 'delivered',
      delivered_at = COALESCE(delivered_at, timezone('utc', now())),
      updated_by = v_profile_id
  WHERE id = p_parcel_id
    AND status <> 'delivered';

  RETURN jsonb_build_object(
    'parcel_id', p_parcel_id,
    'settlement_id', v_settlement_id,
    'cod_amount', v_parcel.cod_amount,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_courier_cod_receivable(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_courier_cod_receivable(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Settle courier COD (cash in, expense, clear receivable)
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
  v_net numeric(14, 2);
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
    SELECT 1 FROM public.courier_settlements cs
    WHERE cs.organization_id = v_org_id
      AND cs.client_txn_key = v_client_txn_key
      AND cs.deleted_at IS NULL
  ) THEN
    SELECT id INTO v_settlement_id
    FROM public.courier_settlements cs
    WHERE cs.organization_id = v_org_id
      AND cs.client_txn_key = v_client_txn_key
      AND cs.deleted_at IS NULL
    LIMIT 1;
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

  IF v_cs.branch_id IS NOT NULL AND NOT public.user_has_branch_access(v_cs.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  v_net := COALESCE(v_cs.settlement_amount, v_cs.cod_amount - v_cs.courier_charge - v_cs.return_charge);

  PERFORM public._post_financial_txn(
    v_org_id,
    v_cs.branch_id,
    v_fin_acct,
    'courier_settlement',
    'in',
    v_net,
    'courier_settlement',
    v_cs.id,
    'Courier settlement',
    'Courier settlement COD net',
    v_profile_id,
    true
  );

  v_courier_recv_coa := public._coa_by_role(v_org_id, 'courier_receivable');
  v_courier_exp_coa := public._coa_by_role(v_org_id, 'courier_expense');
  v_cash_coa := public._coa_by_role(v_org_id, 'cash');

  IF v_courier_recv_coa IS NOT NULL THEN
    v_entry_no := 'JE-CSET-' || replace(v_cs.id::text, '-', '');

    INSERT INTO public.journal_entries (
      organization_id, branch_id, entry_no, entry_date, status,
      source_type, source_id, memo, posted_at, created_by, updated_by
    ) VALUES (
      v_org_id, v_cs.branch_id, v_entry_no, (timezone('utc', now()))::date, 'posted',
      'courier_settlement', v_cs.id, 'Courier settlement', timezone('utc', now()),
      v_profile_id, v_profile_id
    )
    RETURNING id INTO v_journal_id;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES
      (v_org_id, v_journal_id, COALESCE(v_cash_coa, v_courier_recv_coa), 'Cash from courier', v_net, 0, 1, v_profile_id, v_profile_id);

    IF v_cs.courier_charge + v_cs.return_charge > 0 AND v_courier_exp_coa IS NOT NULL THEN
      INSERT INTO public.journal_lines (
        organization_id, journal_entry_id, chart_account_id,
        description, debit, credit, line_no, created_by, updated_by
      ) VALUES (
        v_org_id, v_journal_id, v_courier_exp_coa,
        'Courier charges', v_cs.courier_charge + v_cs.return_charge, 0, 2, v_profile_id, v_profile_id
      );
    END IF;

    INSERT INTO public.journal_lines (
      organization_id, journal_entry_id, chart_account_id,
      description, debit, credit, line_no, created_by, updated_by
    ) VALUES (
      v_org_id, v_journal_id, v_courier_recv_coa,
      'Clear courier receivable', 0, v_cs.cod_amount, 3, v_profile_id, v_profile_id
    );
  END IF;

  UPDATE public.courier_settlements
  SET status = 'settled',
      settlement_date = (timezone('utc', now()))::date,
      financial_account_id = v_fin_acct,
      client_txn_key = v_client_txn_key,
      updated_by = v_profile_id
  WHERE id = v_cs.id;

  PERFORM public.write_audit_log(
    v_org_id, v_cs.branch_id, v_profile_id,
    'courier.settlement', 'courier_settlement', v_cs.id,
    jsonb_build_object('status', 'pending'),
    jsonb_build_object('status', 'settled', 'net', v_net),
    NULL,
    jsonb_build_object('source', 'settle_courier_settlement')
  );

  RETURN jsonb_build_object(
    'settlement_id', v_cs.id,
    'net_amount', v_net,
    'idempotent', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_courier_settlement(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_courier_settlement(jsonb) TO authenticated;
