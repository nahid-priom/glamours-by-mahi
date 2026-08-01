-- Migration 104: Courier sync logs + courier report RPC

CREATE TABLE IF NOT EXISTS public.courier_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  courier_company_id uuid REFERENCES public.courier_companies (id),
  provider_id text NOT NULL,
  action text NOT NULL,
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT false,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS courier_sync_logs_org_created_idx
  ON public.courier_sync_logs (organization_id, created_at DESC);

ALTER TABLE public.courier_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS courier_sync_logs_select ON public.courier_sync_logs;
CREATE POLICY courier_sync_logs_select
  ON public.courier_sync_logs
  FOR SELECT
  TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.read')
  );

GRANT SELECT ON public.courier_sync_logs TO authenticated;
GRANT ALL ON public.courier_sync_logs TO service_role;

--------------------------------------------------------------------------------
-- get_courier_report
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_courier_report(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_from timestamptz := coalesce((payload->>'from')::timestamptz, date_trunc('month', timezone('utc', now())));
  v_to timestamptz := coalesce((payload->>'to')::timestamptz, timezone('utc', now()));
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_company uuid := NULLIF(payload->>'courier_company_id', '')::uuid;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('courier.read') THEN
    RAISE EXCEPTION 'Missing permission courier.read' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'summary', (
      SELECT jsonb_build_object(
        'total_parcels', count(*),
        'booked', count(*) FILTER (WHERE cp.status IN ('booked', 'pending')),
        'in_transit', count(*) FILTER (WHERE cp.status IN ('in_transit', 'out_for_delivery', 'shipped')),
        'delivered', count(*) FILTER (WHERE cp.status = 'delivered'),
        'returned', count(*) FILTER (WHERE cp.status IN ('returned', 'returning')),
        'cancelled', count(*) FILTER (WHERE cp.status = 'cancelled'),
        'cod_collected', coalesce(sum(cp.cod_amount) FILTER (WHERE cp.status = 'delivered'), 0)
      )
      FROM public.courier_parcels cp
      WHERE cp.organization_id = v_org
        AND cp.deleted_at IS NULL
        AND cp.created_at >= v_from
        AND cp.created_at <= v_to
        AND (v_branch IS NULL OR cp.branch_id = v_branch)
        AND (v_company IS NULL OR cp.courier_company_id = v_company)
    ),
    'by_company', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'courier_company_id', cc.id,
        'name', cc.name,
        'parcels', count(cp.id),
        'delivered', count(*) FILTER (WHERE cp.status = 'delivered'),
        'returned', count(*) FILTER (WHERE cp.status IN ('returned', 'returning'))
      ) ORDER BY count(cp.id) DESC)
      FROM public.courier_companies cc
      LEFT JOIN public.courier_parcels cp
        ON cp.courier_company_id = cc.id
       AND cp.organization_id = v_org
       AND cp.deleted_at IS NULL
       AND cp.created_at >= v_from
       AND cp.created_at <= v_to
       AND (v_branch IS NULL OR cp.branch_id = v_branch)
      WHERE cc.organization_id = v_org
        AND cc.deleted_at IS NULL
        AND (v_company IS NULL OR cc.id = v_company)
      GROUP BY cc.id, cc.name
    ), '[]'::jsonb),
    'recent_syncs', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', l.id,
        'provider_id', l.provider_id,
        'action', l.action,
        'success', l.success,
        'error_message', l.error_message,
        'created_at', l.created_at
      ) ORDER BY l.created_at DESC)
      FROM public.courier_sync_logs l
      WHERE l.organization_id = v_org
        AND l.created_at >= v_from
        AND l.created_at <= v_to
      LIMIT 20
    ), '[]'::jsonb),
    'from', v_from,
    'to', v_to
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_courier_report(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_courier_report(jsonb) TO authenticated, service_role;
