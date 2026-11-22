-- list_activity_feed: some DB policies reject DELETE without WHERE.
-- Use TRUNCATE for the session temp table instead.

CREATE OR REPLACE FUNCTION public.list_activity_feed(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
  v_limit int := LEAST(GREATEST(coalesce((payload->>'limit')::int, 40), 1), 100);
  v_offset int := GREATEST(coalesce((payload->>'offset')::int, 0), 0);
  v_from timestamptz := NULLIF(payload->>'from', '')::timestamptz;
  v_to timestamptz := NULLIF(payload->>'to', '')::timestamptz;
  v_branch uuid := NULLIF(payload->>'branch_id', '')::uuid;
  v_actor uuid := NULLIF(payload->>'actor_id', '')::uuid;
  v_module text := lower(nullif(btrim(payload->>'module'), ''));
  v_search text := nullif(btrim(payload->>'search'), '');
  v_total bigint := 0;
  v_items jsonb := '[]'::jsonb;
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_has_permission('audit.read') THEN
    RAISE EXCEPTION 'Missing permission audit.read' USING ERRCODE = '42501';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS tmp_activity_feed_scoped (
    id uuid,
    created_at timestamptz,
    branch_id uuid,
    actor_id uuid,
    action text,
    entity_type text,
    entity_id uuid,
    reason text,
    before_data jsonb,
    after_data jsonb,
    request_meta jsonb,
    actor_name text,
    branch_name text,
    module text
  ) ON COMMIT DROP;

  TRUNCATE tmp_activity_feed_scoped;

  INSERT INTO tmp_activity_feed_scoped (
    id, created_at, branch_id, actor_id, action, entity_type, entity_id,
    reason, before_data, after_data, request_meta, actor_name, branch_name, module
  )
  SELECT
    a.id,
    a.created_at,
    a.branch_id,
    a.actor_id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.reason,
    a.before_data,
    a.after_data,
    a.request_meta,
    p.full_name AS actor_name,
    b.name AS branch_name,
    CASE
      WHEN a.action LIKE 'sale.%'
        OR a.action LIKE 'online_order.%'
        OR a.entity_type IN ('sale', 'sale_return', 'exchange') THEN 'sales'
      WHEN a.action LIKE 'product.%' OR a.entity_type = 'product' THEN 'products'
      WHEN a.action LIKE 'inventory.%'
        OR a.action LIKE 'stock.%'
        OR a.entity_type IN ('stock_adjustment', 'stock_transfer', 'inventory') THEN 'inventory'
      WHEN a.action LIKE 'purchase.%' OR a.entity_type LIKE 'purchase%' THEN 'purchases'
      WHEN a.action LIKE 'customer.%' OR a.entity_type = 'customer' THEN 'customers'
      WHEN a.action LIKE 'commission.%'
        OR a.entity_type LIKE 'salesman_commission%' THEN 'commissions'
      WHEN a.action LIKE 'courier.%' OR a.entity_type LIKE 'courier%' THEN 'courier'
      WHEN a.action LIKE 'hr.%'
        OR a.action LIKE 'payroll.%'
        OR a.entity_type LIKE 'employee%'
        OR a.entity_type LIKE 'payroll%' THEN 'hr'
      WHEN a.action LIKE 'account.%'
        OR a.action LIKE 'journal.%'
        OR a.action LIKE 'expense.%'
        OR a.action LIKE 'income.%'
        OR a.entity_type LIKE 'financial%'
        OR a.entity_type LIKE 'journal%' THEN 'accounts'
      ELSE 'other'
    END AS module
  FROM public.audit_logs a
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  LEFT JOIN public.branches b ON b.id = a.branch_id
  WHERE a.organization_id = v_org
    AND (v_from IS NULL OR a.created_at >= v_from)
    AND (v_to IS NULL OR a.created_at <= v_to)
    AND (v_branch IS NULL OR a.branch_id = v_branch)
    AND (v_actor IS NULL OR a.actor_id = v_actor)
    AND (
      v_search IS NULL
      OR a.action ILIKE '%' || v_search || '%'
      OR a.entity_type ILIKE '%' || v_search || '%'
      OR coalesce(a.reason, '') ILIKE '%' || v_search || '%'
      OR coalesce(p.full_name, '') ILIKE '%' || v_search || '%'
      OR coalesce(a.after_data->>'invoice_no', '') ILIKE '%' || v_search || '%'
    );

  SELECT count(*) INTO v_total
  FROM tmp_activity_feed_scoped s
  WHERE v_module IS NULL OR v_module = 'all' OR s.module = v_module;

  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT
      s.id,
      s.created_at,
      s.branch_id,
      s.branch_name,
      s.actor_id,
      s.actor_name,
      s.action,
      s.entity_type,
      s.entity_id,
      s.reason,
      s.module,
      s.before_data,
      s.after_data,
      s.request_meta
    FROM tmp_activity_feed_scoped s
    WHERE v_module IS NULL OR v_module = 'all' OR s.module = v_module
    ORDER BY s.created_at DESC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'items', coalesce(v_items, '[]'::jsonb),
    'total', v_total,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.list_activity_feed(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_activity_feed(jsonb) TO authenticated;
