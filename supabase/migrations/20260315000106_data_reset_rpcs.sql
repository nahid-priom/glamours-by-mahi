-- Migration 106: Data reset preview/execute (admin-only, audited)

CREATE TABLE IF NOT EXISTS public.data_reset_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  actor_id uuid REFERENCES public.profiles (id),
  mode text NOT NULL CHECK (mode IN ('preview', 'execute')),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('completed', 'failed', 'preview_only')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS data_reset_runs_org_created_idx
  ON public.data_reset_runs (organization_id, created_at DESC);

ALTER TABLE public.data_reset_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_reset_runs_select ON public.data_reset_runs;
CREATE POLICY data_reset_runs_select
  ON public.data_reset_runs
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.data_reset')
  );

GRANT SELECT ON public.data_reset_runs TO authenticated;
GRANT ALL ON public.data_reset_runs TO service_role;

--------------------------------------------------------------------------------
-- preview_data_reset
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.preview_data_reset(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_profile_id();
  v_summary jsonb;
  v_run_id uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('settings.data_reset') THEN
    RAISE EXCEPTION 'Missing permission settings.data_reset' USING ERRCODE = '42501';
  END IF;

  v_summary := jsonb_build_object(
    'sales', (SELECT count(*) FROM public.sales WHERE organization_id = v_org AND deleted_at IS NULL),
    'sale_items', (SELECT count(*) FROM public.sale_items WHERE organization_id = v_org AND deleted_at IS NULL),
    'purchases', (SELECT count(*) FROM public.purchases WHERE organization_id = v_org AND deleted_at IS NULL),
    'customers', (SELECT count(*) FROM public.customers WHERE organization_id = v_org AND deleted_at IS NULL),
    'suppliers', (SELECT count(*) FROM public.suppliers WHERE organization_id = v_org AND deleted_at IS NULL),
    'products', (SELECT count(*) FROM public.products WHERE organization_id = v_org AND deleted_at IS NULL),
    'inventory_balances', (SELECT count(*) FROM public.inventory_balances WHERE organization_id = v_org AND deleted_at IS NULL),
    'journal_entries', (
      SELECT count(*) FROM public.journal_entries
      WHERE organization_id = v_org AND deleted_at IS NULL
    ),
    'courier_parcels', (SELECT count(*) FROM public.courier_parcels WHERE organization_id = v_org AND deleted_at IS NULL),
    'warning', 'Execute will soft-delete transactional data. Masters (products, branches) are preserved unless scope.masters = true.'
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

--------------------------------------------------------------------------------
-- execute_data_reset — soft-delete transactional rows only (safe default)
--------------------------------------------------------------------------------
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
  v_now timestamptz := timezone('utc', now());
  v_summary jsonb := '{}'::jsonb;
  v_run_id uuid;
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

  -- Soft-delete transactional tables (preserve org structure)
  UPDATE public.sale_items SET deleted_at = v_now, updated_by = v_actor
  WHERE organization_id = v_org AND deleted_at IS NULL;

  UPDATE public.sales SET deleted_at = v_now, updated_by = v_actor
  WHERE organization_id = v_org AND deleted_at IS NULL;

  UPDATE public.purchases SET deleted_at = v_now, updated_by = v_actor
  WHERE organization_id = v_org AND deleted_at IS NULL;

  UPDATE public.courier_parcels SET deleted_at = v_now, updated_by = v_actor
  WHERE organization_id = v_org AND deleted_at IS NULL;

  IF coalesce((payload->>'reset_inventory')::boolean, false) THEN
    UPDATE public.inventory_balances
    SET quantity = 0, qty_reserved = 0, updated_by = v_actor, updated_at = v_now
    WHERE organization_id = v_org AND deleted_at IS NULL;
  END IF;

  v_summary := jsonb_build_object(
    'executed_at', v_now,
    'reset_inventory', coalesce((payload->>'reset_inventory')::boolean, false),
    'note', 'Transactional rows soft-deleted. Run preview_data_reset for counts before execute.'
  );

  INSERT INTO public.data_reset_runs (organization_id, actor_id, mode, scope, summary, status)
  VALUES (v_org, v_actor, 'execute', payload, v_summary, 'completed')
  RETURNING id INTO v_run_id;

  PERFORM public.write_audit_log(
    v_org, NULL, v_actor,
    'settings.data_reset.execute', 'data_reset_run', v_run_id,
    NULL, v_summary, NULL,
    jsonb_build_object('source', 'execute_data_reset', 'scope', payload)
  );

  RETURN jsonb_build_object(
    'run_id', v_run_id,
    'mode', 'execute',
    'summary', v_summary,
    'ok', true
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_data_reset(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_data_reset(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.execute_data_reset(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_data_reset(jsonb) TO authenticated, service_role;
