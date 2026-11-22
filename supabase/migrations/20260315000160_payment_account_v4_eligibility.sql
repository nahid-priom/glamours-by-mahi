-- Payment Account V4 — shared financial-account eligibility assert
-- Used by POS/sale posting before money movement. Does not rewrite history.

--------------------------------------------------------------------------------
-- Map payment method code → expected financial_accounts.account_kind
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._payment_method_expected_kind(p_method text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(btrim(coalesce(p_method, ''))) IN ('cash') THEN 'cash'
    WHEN lower(btrim(coalesce(p_method, ''))) IN ('bank', 'bank_transfer', 'card') THEN 'bank'
    WHEN lower(btrim(coalesce(p_method, ''))) IN (
      'bkash', 'nagad', 'rocket', 'mobile', 'mobile_money'
    )
      OR lower(btrim(coalesce(p_method, ''))) LIKE 'mobile%'
      THEN 'mobile_money'
    ELSE 'other'
  END;
$$;

--------------------------------------------------------------------------------
-- Assert FA exists, active, org-scoped, branch-eligible, and kind-compatible
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._assert_payment_account_eligible(
  p_org_id uuid,
  p_branch_id uuid,
  p_method_code text,
  p_financial_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_fa public.financial_accounts%ROWTYPE;
  v_kind text;
  v_expected text;
  v_is_due boolean;
BEGIN
  IF p_financial_account_id IS NULL THEN
    RAISE EXCEPTION 'financial_account_id is required' USING ERRCODE = '22023';
  END IF;

  v_is_due := public._payment_method_is_due(p_org_id, p_method_code);
  IF v_is_due THEN
    RETURN;
  END IF;

  SELECT * INTO v_fa
  FROM public.financial_accounts fa
  WHERE fa.id = p_financial_account_id
    AND fa.organization_id = p_org_id
    AND fa.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid financial_account_id' USING ERRCODE = '22023';
  END IF;

  IF NOT coalesce(v_fa.is_active, false) THEN
    RAISE EXCEPTION 'Financial account is inactive' USING ERRCODE = '22023';
  END IF;

  IF p_branch_id IS NOT NULL
     AND v_fa.branch_id IS NOT NULL
     AND v_fa.branch_id IS DISTINCT FROM p_branch_id THEN
    RAISE EXCEPTION 'Financial account is not authorized for this branch'
      USING ERRCODE = '42501';
  END IF;

  v_expected := public._payment_method_expected_kind(p_method_code);
  v_kind := coalesce(v_fa.account_kind, 'other');

  -- Strict kind match for cash / bank / mobile. "other" methods accept any active FA.
  IF v_expected <> 'other' AND v_kind IS DISTINCT FROM v_expected THEN
    RAISE EXCEPTION
      'Payment method % requires a % account (selected account kind is %)',
      p_method_code, v_expected, v_kind
      USING ERRCODE = '22023';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._payment_method_expected_kind(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._assert_payment_account_eligible(uuid, uuid, text, uuid) FROM PUBLIC;

--------------------------------------------------------------------------------
-- complete_pos_sale: validate tender lines before core posting
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_pos_sale(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_sale_id uuid;
  v_idempotent boolean;
  r record;
  v_is_due boolean;
  v_branch_id uuid;
  v_sp record;
  v_org_id uuid;
  v_profile_id uuid;
  v_payment jsonb;
  v_method text;
  v_fin_acct uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;

  -- Pre-validate method ↔ account kind before any stock/ledger mutation.
  IF jsonb_typeof(payload->'payments') = 'array' THEN
    FOR v_payment IN SELECT * FROM jsonb_array_elements(payload->'payments')
    LOOP
      v_method := lower(btrim(coalesce(v_payment->>'method', '')));
      IF v_method = '' THEN
        CONTINUE;
      END IF;
      IF public._payment_method_is_due(v_org_id, v_method) THEN
        CONTINUE;
      END IF;
      v_fin_acct := NULLIF(v_payment->>'financial_account_id', '')::uuid;
      PERFORM public._assert_payment_account_eligible(
        v_org_id,
        v_branch_id,
        v_method,
        v_fin_acct
      );
    END LOOP;
  END IF;

  v_result := public._complete_pos_sale_core(payload);
  v_sale_id := NULLIF(v_result->>'sale_id', '')::uuid;
  v_idempotent := coalesce((v_result->>'idempotent')::boolean, false);

  IF v_sale_id IS NULL OR v_idempotent THEN
    RETURN v_result;
  END IF;

  SELECT * INTO v_sp
  FROM public._resolve_pos_salesperson(payload, v_branch_id);

  UPDATE public.sales s
  SET salesperson_employee_id = v_sp.employee_id,
      salesperson_id = coalesce(v_sp.profile_id, s.salesperson_id),
      updated_at = timezone('utc', now())
  WHERE s.id = v_sale_id;

  PERFORM public._link_sale_commission_employees(v_sale_id);
  PERFORM public._record_commission_attribution_exception(v_sale_id);

  FOR r IN
    SELECT
      sp.amount,
      sp.method,
      sp.financial_account_id,
      sp.reference,
      s.organization_id,
      s.branch_id,
      s.invoice_no,
      s.created_by
    FROM public.sale_payments sp
    JOIN public.sales s ON s.id = sp.sale_id
    WHERE sp.sale_id = v_sale_id
      AND sp.financial_account_id IS NOT NULL
      AND sp.deleted_at IS NULL
    ORDER BY sp.created_at ASC, sp.id ASC
  LOOP
    SELECT coalesce(pm.is_due, false) INTO v_is_due
    FROM public.payment_methods pm
    WHERE pm.organization_id = r.organization_id
      AND lower(pm.code) = lower(r.method)
      AND pm.deleted_at IS NULL
    LIMIT 1;

    IF NOT FOUND THEN
      v_is_due := (lower(r.method) IN ('due', 'credit', 'receivable'));
    END IF;

    IF v_is_due THEN CONTINUE; END IF;

    IF EXISTS (
      SELECT 1 FROM public.financial_transactions ft
      WHERE ft.source_type = 'sale'
        AND ft.source_id = v_sale_id
        AND ft.account_id = r.financial_account_id
        AND ft.amount = r.amount
        AND ft.status = 'posted'
        AND ft.deleted_at IS NULL
    ) THEN
      CONTINUE;
    END IF;

    PERFORM public._post_financial_txn(
      r.organization_id,
      r.branch_id,
      r.financial_account_id,
      'sale_payment',
      'in',
      r.amount,
      'sale',
      v_sale_id,
      coalesce(r.reference, r.invoice_no),
      'Sale payment ' || coalesce(r.invoice_no, ''),
      r.created_by,
      true
    );
  END LOOP;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_pos_sale(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(jsonb) TO authenticated;

COMMENT ON FUNCTION public._assert_payment_account_eligible(uuid, uuid, text, uuid) IS
  'Payment Account V4: reject inactive/cross-branch/wrong-kind FA for a payment method.';
