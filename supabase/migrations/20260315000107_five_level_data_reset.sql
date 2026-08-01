-- Migration 107: Five-level secure data reset (extends 106)

-- Allow running status before execute RPC inserts it
ALTER TABLE public.data_reset_runs
  DROP CONSTRAINT IF EXISTS data_reset_runs_status_check;

ALTER TABLE public.data_reset_runs
  ADD CONSTRAINT data_reset_runs_status_check
  CHECK (status IN ('completed', 'failed', 'preview_only', 'running'));

-- Advisory lock key helper
CREATE OR REPLACE FUNCTION public._data_reset_lock(p_org uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_org::text || ':data_reset'));
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_data_reset(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_level text := lower(coalesce(payload->>'reset_level', 'transactions'));
  v_summary jsonb;
  v_run_id uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_has_permission('settings.data_reset') THEN
    RAISE EXCEPTION 'Missing permission settings.data_reset' USING ERRCODE = '42501';
  END IF;
  IF v_level NOT IN ('demo', 'transactions', 'inventory', 'accounts', 'full') THEN
    RAISE EXCEPTION 'Invalid reset_level';
  END IF;

  PERFORM public._data_reset_lock(v_org);

  v_summary := jsonb_build_object(
    'reset_level', v_level,
    'sales', (SELECT count(*) FROM public.sales WHERE organization_id = v_org AND deleted_at IS NULL),
    'sale_returns', (SELECT count(*) FROM public.sale_returns WHERE organization_id = v_org AND deleted_at IS NULL),
    'purchases', (SELECT count(*) FROM public.purchases WHERE organization_id = v_org AND deleted_at IS NULL),
    'purchase_payments', (SELECT count(*) FROM public.purchase_payments WHERE organization_id = v_org AND deleted_at IS NULL),
    'exchanges', (SELECT count(*) FROM public.exchanges WHERE organization_id = v_org AND deleted_at IS NULL),
    'courier_parcels', (SELECT count(*) FROM public.courier_parcels WHERE organization_id = v_org AND deleted_at IS NULL),
    'stock_ledger', (SELECT count(*) FROM public.stock_ledger WHERE organization_id = v_org AND deleted_at IS NULL),
    'inventory_balances', (SELECT count(*) FROM public.inventory_balances WHERE organization_id = v_org AND deleted_at IS NULL),
    'journal_entries', (SELECT count(*) FROM public.journal_entries WHERE organization_id = v_org AND deleted_at IS NULL),
    'financial_transactions', (
      SELECT count(*) FROM public.financial_transactions
      WHERE organization_id = v_org AND deleted_at IS NULL
    ),
    'customer_ledger', (SELECT count(*) FROM public.customer_ledger WHERE organization_id = v_org AND deleted_at IS NULL),
    'supplier_ledger', (SELECT count(*) FROM public.supplier_ledger WHERE organization_id = v_org AND deleted_at IS NULL),
    'demo_products', (
      SELECT count(*) FROM public.products
      WHERE organization_id = v_org AND deleted_at IS NULL AND base_sku ILIKE 'GG-SEED-%'
    ),
    'customers', (SELECT count(*) FROM public.customers WHERE organization_id = v_org AND deleted_at IS NULL),
    'suppliers', (SELECT count(*) FROM public.suppliers WHERE organization_id = v_org AND deleted_at IS NULL),
    'products', (SELECT count(*) FROM public.products WHERE organization_id = v_org AND deleted_at IS NULL)
  );

  INSERT INTO public.data_reset_runs (organization_id, actor_id, mode, scope, summary, status)
  VALUES (v_org, v_actor, 'preview', coalesce(payload, '{}'::jsonb), v_summary, 'preview_only')
  RETURNING id INTO v_run_id;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'mode', 'preview',
    'summary', v_summary,
    'scope', coalesce(payload, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.execute_data_reset(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_confirm text := upper(coalesce(payload->>'confirm', ''));
  v_phrase text := upper(btrim(coalesce(payload->>'confirm_phrase', '')));
  v_level text := lower(coalesce(payload->>'reset_level', 'transactions'));
  v_now timestamptz := timezone('utc', now());
  v_summary jsonb := '{}'::jsonb;
  v_run_id uuid;
  v_running int;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.user_has_permission('settings.data_reset') THEN
    RAISE EXCEPTION 'Missing permission settings.data_reset' USING ERRCODE = '42501';
  END IF;
  IF v_confirm <> 'RESET' THEN
    RAISE EXCEPTION 'Confirmation required: pass confirm = RESET';
  END IF;
  IF v_level NOT IN ('demo', 'transactions', 'inventory', 'accounts', 'full') THEN
    RAISE EXCEPTION 'Invalid reset_level';
  END IF;
  IF v_phrase <> upper('RESET ' || v_level) THEN
    RAISE EXCEPTION 'Typed confirmation phrase must be: RESET %', v_level;
  END IF;

  -- Prevent concurrent reset
  SELECT count(*) INTO v_running
  FROM public.data_reset_runs
  WHERE organization_id = v_org
    AND mode = 'execute'
    AND status = 'running'
    AND created_at > v_now - interval '15 minutes';
  IF v_running > 0 THEN
    RAISE EXCEPTION 'A data reset is already running for this organization';
  END IF;

  PERFORM public._data_reset_lock(v_org);

  INSERT INTO public.data_reset_runs (organization_id, actor_id, mode, scope, summary, status)
  VALUES (v_org, v_actor, 'execute', payload, '{}'::jsonb, 'running')
  RETURNING id INTO v_run_id;

  BEGIN
    IF v_level = 'demo' THEN
      UPDATE public.products
      SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL AND base_sku ILIKE 'GG-SEED-%';
    END IF;

    IF v_level IN ('transactions', 'accounts', 'full') THEN
      UPDATE public.sale_items SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.sale_returns SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.exchanges SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.sales SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.purchase_items SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.purchase_payments SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.purchases SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.courier_parcels SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.stock_ledger SET deleted_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
    END IF;

    IF v_level IN ('inventory', 'full') OR (
      v_level = 'transactions' AND coalesce((payload->>'reset_inventory')::boolean, false)
    ) THEN
      UPDATE public.inventory_balances
      SET quantity = 0, qty_reserved = 0, updated_by = v_actor, updated_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.stock_ledger SET deleted_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
    END IF;

    IF v_level IN ('accounts', 'full') THEN
      UPDATE public.journal_entries SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.financial_transactions SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.customer_ledger SET deleted_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.supplier_ledger SET deleted_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.customers
      SET current_due = 0, updated_by = v_actor, updated_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
      UPDATE public.suppliers
      SET current_due = 0, updated_by = v_actor, updated_at = v_now
      WHERE organization_id = v_org AND deleted_at IS NULL;
    END IF;

    IF v_level = 'full' THEN
      -- Preserve org, admin profiles, roles, core settings; soft-delete operational masters optionally
      UPDATE public.customers SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL
        AND coalesce((payload->>'delete_parties')::boolean, false);
      UPDATE public.suppliers SET deleted_at = v_now, updated_by = v_actor
      WHERE organization_id = v_org AND deleted_at IS NULL
        AND coalesce((payload->>'delete_parties')::boolean, false);
    END IF;

    v_summary := jsonb_build_object(
      'executed_at', v_now,
      'reset_level', v_level,
      'ok', true
    );

    UPDATE public.data_reset_runs
    SET summary = v_summary, status = 'completed'
    WHERE id = v_run_id;

    PERFORM public.write_audit_log(
      v_org, NULL, v_actor,
      'settings.data_reset.execute', 'data_reset_run', v_run_id,
      NULL, v_summary, NULL,
      jsonb_build_object('source', 'execute_data_reset', 'reset_level', v_level)
    );

  EXCEPTION WHEN OTHERS THEN
    UPDATE public.data_reset_runs
    SET status = 'failed',
        error_message = SQLERRM,
        summary = jsonb_build_object('reset_level', v_level, 'error', SQLERRM)
    WHERE id = v_run_id;
    RAISE;
  END;

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'mode', 'execute',
    'summary', v_summary,
    'ok', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_data_reset(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.execute_data_reset(jsonb) TO authenticated, service_role;
