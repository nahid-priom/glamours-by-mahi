-- Migration 081: Moderator dashboard summary RPC

CREATE OR REPLACE FUNCTION public.get_moderator_dashboard_summary(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_own_only boolean := true;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('moderator.dashboard.read')
    OR public.user_has_permission('moderator.order.read_own')
    OR public.user_has_permission('orders.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_from := coalesce((payload->>'from')::timestamptz, date_trunc('month', timezone('utc', now())));
  v_to := coalesce((payload->>'to')::timestamptz, timezone('utc', now()));

  IF public.user_has_permission('orders.read')
     OR public.user_has_permission('accounts.manage') THEN
    v_own_only := coalesce((payload->>'own_only')::boolean, false);
  END IF;

  RETURN (
    WITH scoped AS (
      SELECT s.*
      FROM public.sales s
      WHERE s.organization_id = v_org_id
        AND s.deleted_at IS NULL
        AND (
          coalesce(s.order_source, '') IN ('moderator', 'tele_sales', 'manual')
          OR coalesce(s.channel, '') IN ('online', 'moderator')
        )
        AND (NOT v_own_only OR s.created_by = v_profile_id OR s.moderator_id = v_profile_id)
    ),
    in_range AS (
      SELECT * FROM scoped
      WHERE created_at >= v_from AND created_at <= v_to
    ),
    today AS (
      SELECT * FROM scoped
      WHERE created_at >= date_trunc('day', timezone('utc', now()))
    )
    SELECT jsonb_build_object(
      'orders_today', (SELECT count(*) FROM today),
      'orders_month', (SELECT count(*) FROM in_range),
      'draft_orders', (
        SELECT count(*) FROM scoped
        WHERE status = 'draft' AND coalesce(fulfilment_status, '') NOT IN ('cancelled', 'confirmed', 'delivered')
      ),
      'pending_approval', (
        SELECT count(*) FROM scoped WHERE fulfilment_status = 'pending_approval'
      ),
      'approved_orders', (
        SELECT count(*) FROM scoped WHERE fulfilment_status = 'approved'
      ),
      'cancelled_orders', (
        SELECT count(*) FROM scoped WHERE fulfilment_status = 'cancelled'
      ),
      'delivered_orders', (
        SELECT count(*) FROM scoped
        WHERE fulfilment_status IN ('delivered', 'confirmed') OR status = 'completed'
      ),
      'total_order_value', coalesce((SELECT sum(grand_total) FROM in_range), 0),
      'average_order_value', coalesce((SELECT avg(grand_total) FROM in_range), 0),
      'recent_orders', coalesce((
        SELECT jsonb_agg(row_to_json(r)::jsonb)
        FROM (
          SELECT
            s.id, s.invoice_no, s.status, s.fulfilment_status, s.order_source,
            s.grand_total, s.created_at, s.customer_id,
            c.name AS customer_name, c.phone AS customer_phone
          FROM scoped s
          LEFT JOIN public.customers c ON c.id = s.customer_id
          ORDER BY s.created_at DESC
          LIMIT least(coalesce((payload->>'recent_limit')::int, 10), 50)
        ) r
      ), '[]'::jsonb)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_moderator_dashboard_summary(jsonb) TO authenticated;
