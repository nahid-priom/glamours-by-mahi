-- Extend list_staff_sales with optional channel / order_only filters for My Orders.

CREATE OR REPLACE FUNCTION public.list_staff_sales(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_staff uuid;
  v_page int := greatest(coalesce((payload->>'page')::int, 1), 1);
  v_page_size int := least(greatest(coalesce((payload->>'page_size')::int, 20), 1), 100);
  v_offset int;
  v_total int;
  v_items jsonb;
  v_can_view_others boolean;
  v_order_only boolean := coalesce((payload->>'order_only')::boolean, false);
  v_channel text := nullif(btrim(payload->>'channel'), '');
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.sales.read_own')
    OR public.user_has_permission('sales.read')
    OR public.user_has_permission('staff.dashboard.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_can_view_others := public.user_has_permission('staff.targets.manage')
    OR public.user_has_permission('settings.manage');
  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id AND NOT v_can_view_others THEN
    RAISE EXCEPTION 'Cannot view another staff sales' USING ERRCODE = '42501';
  END IF;

  v_offset := (v_page - 1) * v_page_size;

  SELECT count(*) INTO v_total
  FROM public.sales s
  WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
    AND public.sale_attributed_staff_id(s) = v_staff
    AND (NULLIF(payload->>'branch_id', '') IS NULL OR s.branch_id = (payload->>'branch_id')::uuid)
    AND (NULLIF(payload->>'date_from', '') IS NULL OR s.created_at >= (payload->>'date_from')::timestamptz)
    AND (NULLIF(payload->>'date_to', '') IS NULL OR s.created_at <= (payload->>'date_to')::timestamptz)
    AND (
      NULLIF(payload->>'status', '') IS NULL
      OR s.status = payload->>'status'
      OR s.fulfilment_status = payload->>'status'
    )
    AND (
      NOT v_order_only
      OR coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
      OR coalesce(s.order_source, '') IN ('ecommerce', 'online', 'moderator', 'tele')
    )
    AND (
      v_channel IS NULL
      OR coalesce(s.channel, '') = v_channel
      OR coalesce(s.order_source, '') = v_channel
    )
    AND (
      NULLIF(btrim(payload->>'search'), '') IS NULL
      OR s.invoice_no ILIKE '%' || btrim(payload->>'search') || '%'
    );

  SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb), '[]'::jsonb) INTO v_items
  FROM (
    SELECT s.id, s.invoice_no, s.grand_total, s.paid_total, s.due_total,
           s.status, s.fulfilment_status, s.order_source, s.channel, s.created_at,
           s.branch_id, c.name AS customer_name, c.phone AS customer_phone,
           coalesce((
             SELECT sum(sc.commission_amount)
             FROM public.salesman_commissions sc
             WHERE sc.sale_id = s.id AND sc.deleted_at IS NULL
               AND sc.status IN ('pending', 'approved', 'paid')
           ), 0) AS commission_amount
    FROM public.sales s
    LEFT JOIN public.customers c ON c.id = s.customer_id
    WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
      AND public.sale_attributed_staff_id(s) = v_staff
      AND (NULLIF(payload->>'branch_id', '') IS NULL OR s.branch_id = (payload->>'branch_id')::uuid)
      AND (NULLIF(payload->>'date_from', '') IS NULL OR s.created_at >= (payload->>'date_from')::timestamptz)
      AND (NULLIF(payload->>'date_to', '') IS NULL OR s.created_at <= (payload->>'date_to')::timestamptz)
      AND (
        NULLIF(payload->>'status', '') IS NULL
        OR s.status = payload->>'status'
        OR s.fulfilment_status = payload->>'status'
      )
      AND (
        NOT v_order_only
        OR coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
        OR coalesce(s.order_source, '') IN ('ecommerce', 'online', 'moderator', 'tele')
      )
      AND (
        v_channel IS NULL
        OR coalesce(s.channel, '') = v_channel
        OR coalesce(s.order_source, '') = v_channel
      )
      AND (
        NULLIF(btrim(payload->>'search'), '') IS NULL
        OR s.invoice_no ILIKE '%' || btrim(payload->>'search') || '%'
      )
    ORDER BY s.created_at DESC
    OFFSET v_offset LIMIT v_page_size
  ) r;

  RETURN jsonb_build_object(
    'items', v_items,
    'total', v_total,
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_sales(jsonb) TO authenticated;
