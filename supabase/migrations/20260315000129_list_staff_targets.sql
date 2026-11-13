-- List staff targets for admin history + staff self-view.

CREATE OR REPLACE FUNCTION public.list_staff_targets(payload jsonb DEFAULT '{}'::jsonb)
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
  v_can_manage boolean;
  v_items jsonb;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  v_can_manage := public.user_has_permission('staff.targets.manage')
    OR public.user_has_permission('settings.manage');

  IF NOT (
    v_can_manage
    OR public.user_has_permission('staff.targets.read_own')
    OR public.user_has_permission('staff.dashboard.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := NULLIF(payload->>'staff_user_id', '')::uuid;
  IF v_staff IS NOT NULL AND v_staff <> v_profile_id AND NOT v_can_manage THEN
    RAISE EXCEPTION 'Cannot view another staff targets' USING ERRCODE = '42501';
  END IF;
  IF NOT v_can_manage THEN
    v_staff := v_profile_id;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.starts_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      t.id,
      t.staff_user_id,
      p.full_name AS staff_name,
      t.branch_id,
      t.target_period,
      t.sales_amount,
      t.order_count,
      t.collection_amount,
      t.new_customers,
      t.starts_at,
      t.ends_at,
      t.status,
      t.note,
      t.created_at,
      coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.organization_id = t.organization_id
          AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = t.staff_user_id
          AND s.created_at::date BETWEEN t.starts_at AND t.ends_at
          AND s.status NOT IN ('cancelled', 'void')
      ), 0) AS achieved_sales
    FROM public.staff_targets t
    LEFT JOIN public.profiles p ON p.id = t.staff_user_id
    WHERE t.organization_id = v_org_id
      AND t.deleted_at IS NULL
      AND (v_staff IS NULL OR t.staff_user_id = v_staff)
      AND (
        NULLIF(payload->>'status', '') IS NULL
        OR t.status = payload->>'status'
      )
    ORDER BY t.starts_at DESC
    LIMIT least(greatest(coalesce((payload->>'limit')::int, 100), 1), 200)
  ) r;

  RETURN jsonb_build_object('items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_targets(jsonb) TO authenticated;
