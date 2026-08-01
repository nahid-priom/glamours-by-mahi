-- Migration 108: Staff workspace — targets, follow-ups, assignments, dashboard RPCs

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('staff.dashboard.read', 'Access personal staff workspace dashboard'),
  ('staff.sales.read_own', 'View own attributed sales and orders'),
  ('staff.commission.read_own', 'View own commission entries'),
  ('staff.follow_ups.manage', 'Manage own customer follow-ups'),
  ('staff.targets.read_own', 'View own sales targets'),
  ('staff.targets.manage', 'Assign and manage staff sales targets (admin)')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = x.key AND p.deleted_at IS NULL
);

-- Grant staff workspace perms to Moderator / Tele Salesman / Salesperson
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND r.name IN ('Moderator', 'Tele Salesman', 'Salesperson')
  AND p.key IN (
    'staff.dashboard.read',
    'staff.sales.read_own',
    'staff.commission.read_own',
    'staff.follow_ups.manage',
    'staff.targets.read_own'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.deleted_at IS NULL
  AND r.name IN ('Owner', 'Super Admin')
  AND p.key LIKE 'staff.%'
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Helper: canonical attributed staff profile for a sale
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sale_attributed_staff_id(p_sale public.sales)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    (
      SELECT e.profile_id
      FROM public.employees e
      WHERE e.id = p_sale.salesperson_employee_id
        AND e.deleted_at IS NULL
      LIMIT 1
    ),
    p_sale.salesperson_id,
    p_sale.tele_salesman_id,
    p_sale.moderator_id
  );
$$;

--------------------------------------------------------------------------------
-- staff_targets
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  staff_user_id uuid NOT NULL REFERENCES public.profiles (id),
  branch_id uuid REFERENCES public.branches (id),
  target_period text NOT NULL CHECK (target_period IN ('daily', 'weekly', 'monthly')),
  sales_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (sales_amount >= 0),
  order_count int NOT NULL DEFAULT 0 CHECK (order_count >= 0),
  collection_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (collection_amount >= 0),
  new_customers int NOT NULL DEFAULT 0 CHECK (new_customers >= 0),
  starts_at date NOT NULL,
  ends_at date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  note text,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  CONSTRAINT staff_targets_dates_chk CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS staff_targets_staff_period_idx
  ON public.staff_targets (organization_id, staff_user_id, target_period, starts_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER staff_targets_set_updated_at
  BEFORE UPDATE ON public.staff_targets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_targets_select ON public.staff_targets;
CREATE POLICY staff_targets_select ON public.staff_targets
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      staff_user_id = auth.uid()
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS staff_targets_write ON public.staff_targets;
CREATE POLICY staff_targets_write ON public.staff_targets
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

--------------------------------------------------------------------------------
-- staff_follow_ups
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  staff_user_id uuid NOT NULL REFERENCES public.profiles (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  sale_id uuid REFERENCES public.sales (id),
  follow_up_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'cancelled', 'skipped')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high')),
  note text,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS staff_follow_ups_due_idx
  ON public.staff_follow_ups (organization_id, staff_user_id, follow_up_at)
  WHERE deleted_at IS NULL AND status = 'pending';

CREATE TRIGGER staff_follow_ups_set_updated_at
  BEFORE UPDATE ON public.staff_follow_ups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff_follow_ups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS staff_follow_ups_select ON public.staff_follow_ups;
CREATE POLICY staff_follow_ups_select ON public.staff_follow_ups
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      staff_user_id = auth.uid()
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS staff_follow_ups_write ON public.staff_follow_ups;
CREATE POLICY staff_follow_ups_write ON public.staff_follow_ups
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      staff_user_id = auth.uid()
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      staff_user_id = auth.uid()
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

--------------------------------------------------------------------------------
-- customer_staff_assignments
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_staff_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  staff_user_id uuid NOT NULL REFERENCES public.profiles (id),
  is_primary boolean NOT NULL DEFAULT true,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_staff_assignments_active_uidx
  ON public.customer_staff_assignments (organization_id, customer_id, staff_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS customer_staff_assignments_staff_idx
  ON public.customer_staff_assignments (organization_id, staff_user_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER customer_staff_assignments_set_updated_at
  BEFORE UPDATE ON public.customer_staff_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.customer_staff_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_staff_assignments_select ON public.customer_staff_assignments;
CREATE POLICY customer_staff_assignments_select ON public.customer_staff_assignments
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND deleted_at IS NULL
    AND (
      staff_user_id = auth.uid()
      OR public.user_has_permission('customers.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

DROP POLICY IF EXISTS customer_staff_assignments_write ON public.customer_staff_assignments;
CREATE POLICY customer_staff_assignments_write ON public.customer_staff_assignments
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.manage')
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.manage')
      OR public.user_has_permission('staff.targets.manage')
      OR public.user_has_permission('settings.manage')
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.staff_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.staff_follow_ups TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.customer_staff_assignments TO authenticated;

--------------------------------------------------------------------------------
-- get_staff_dashboard_summary
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_dashboard_summary(payload jsonb DEFAULT '{}'::jsonb)
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
  v_branch uuid;
  v_today_start timestamptz := date_trunc('day', timezone('utc', now()));
  v_today_end timestamptz := v_today_start + interval '1 day' - interval '1 millisecond';
  v_yest_start timestamptz := v_today_start - interval '1 day';
  v_yest_end timestamptz := v_today_start - interval '1 millisecond';
  v_month_start timestamptz := date_trunc('month', timezone('utc', now()));
  v_can_view_others boolean := false;
  v_target public.staff_targets%ROWTYPE;
  v_achieved numeric := 0;
  v_achieved_orders int := 0;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('staff.dashboard.read')
    OR public.user_has_permission('moderator.dashboard.read')
    OR public.user_has_permission('sales.read')
    OR public.user_has_permission('orders.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_can_view_others := public.user_has_permission('staff.targets.manage')
    OR public.user_has_permission('settings.manage')
    OR public.user_has_permission('accounts.manage');

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id AND NOT v_can_view_others THEN
    RAISE EXCEPTION 'Cannot view another staff dashboard' USING ERRCODE = '42501';
  END IF;

  v_branch := NULLIF(payload->>'branch_id', '')::uuid;
  IF v_branch IS NOT NULL AND NOT public.user_has_branch_access(v_branch) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
  END IF;

  SELECT t.* INTO v_target
  FROM public.staff_targets t
  WHERE t.organization_id = v_org_id
    AND t.staff_user_id = v_staff
    AND t.deleted_at IS NULL
    AND t.status = 'active'
    AND t.starts_at <= (timezone('utc', now()))::date
    AND t.ends_at >= (timezone('utc', now()))::date
    AND (v_branch IS NULL OR t.branch_id IS NULL OR t.branch_id = v_branch)
  ORDER BY CASE t.target_period WHEN 'daily' THEN 1 WHEN 'weekly' THEN 2 ELSE 3 END, t.starts_at DESC
  LIMIT 1;

  IF FOUND THEN
    SELECT coalesce(sum(s.grand_total), 0), count(*)
    INTO v_achieved, v_achieved_orders
    FROM public.sales s
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND public.sale_attributed_staff_id(s) = v_staff
      AND (v_branch IS NULL OR s.branch_id = v_branch)
      AND s.created_at >= v_target.starts_at::timestamptz
      AND s.created_at < (v_target.ends_at + 1)::timestamptz
      AND coalesce(s.fulfilment_status, '') <> 'cancelled'
      AND coalesce(s.status, '') NOT IN ('voided', 'cancelled');
  END IF;

  RETURN jsonb_build_object(
    'staff_user_id', v_staff,
    'branch_id', v_branch,
    'kpis', jsonb_build_object(
      'today_sales', coalesce((
        SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_today_start AND s.created_at <= v_today_end
          AND coalesce(s.fulfilment_status, '') <> 'cancelled'
          AND coalesce(s.status, '') NOT IN ('voided', 'cancelled')
      ), 0),
      'today_orders', (
        SELECT count(*) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_today_start AND s.created_at <= v_today_end
          AND coalesce(s.fulfilment_status, '') <> 'cancelled'
          AND coalesce(s.status, '') NOT IN ('voided', 'cancelled')
      ),
      'yesterday_sales', coalesce((
        SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_yest_start AND s.created_at <= v_yest_end
          AND coalesce(s.fulfilment_status, '') <> 'cancelled'
          AND coalesce(s.status, '') NOT IN ('voided', 'cancelled')
      ), 0),
      'month_sales', coalesce((
        SELECT sum(s.grand_total) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_month_start
          AND coalesce(s.fulfilment_status, '') <> 'cancelled'
          AND coalesce(s.status, '') NOT IN ('voided', 'cancelled')
      ), 0),
      'month_orders', (
        SELECT count(*) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND s.created_at >= v_month_start
          AND coalesce(s.fulfilment_status, '') <> 'cancelled'
          AND coalesce(s.status, '') NOT IN ('voided', 'cancelled')
      ),
      'pending_orders', (
        SELECT count(*) FROM public.sales s
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
          AND coalesce(s.fulfilment_status, '') IN ('pending_approval', 'new', 'approved', 'packed')
      ),
      'commission_today', coalesce((
        SELECT sum(c.commission_amount) FROM public.salesman_commissions c
        WHERE c.organization_id = v_org_id AND c.deleted_at IS NULL
          AND (c.profile_id = v_staff OR c.employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL))
          AND c.created_at >= v_today_start
          AND c.status IN ('pending', 'approved', 'paid')
      ), 0),
      'commission_month', coalesce((
        SELECT sum(c.commission_amount) FROM public.salesman_commissions c
        WHERE c.organization_id = v_org_id AND c.deleted_at IS NULL
          AND (c.profile_id = v_staff OR c.employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL))
          AND c.created_at >= v_month_start
          AND c.status IN ('pending', 'approved', 'paid')
      ), 0),
      'commission_pending', coalesce((
        SELECT sum(c.commission_amount) FROM public.salesman_commissions c
        WHERE c.organization_id = v_org_id AND c.deleted_at IS NULL
          AND (c.profile_id = v_staff OR c.employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL))
          AND c.status IN ('pending', 'approved')
      ), 0),
      'follow_ups_due', (
        SELECT count(*) FROM public.staff_follow_ups f
        WHERE f.organization_id = v_org_id AND f.staff_user_id = v_staff
          AND f.deleted_at IS NULL AND f.status = 'pending'
          AND f.follow_up_at::date <= (timezone('utc', now()))::date
      ),
      'follow_ups_overdue', (
        SELECT count(*) FROM public.staff_follow_ups f
        WHERE f.organization_id = v_org_id AND f.staff_user_id = v_staff
          AND f.deleted_at IS NULL AND f.status = 'pending'
          AND f.follow_up_at < v_today_start
      ),
      'new_customers_today', (
        SELECT count(*) FROM public.customers c
        WHERE c.organization_id = v_org_id AND c.deleted_at IS NULL
          AND c.created_by = v_staff AND c.created_at >= v_today_start
      )
    ),
    'target', CASE WHEN v_target.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_target.id,
      'period', v_target.target_period,
      'sales_amount', v_target.sales_amount,
      'order_count', v_target.order_count,
      'starts_at', v_target.starts_at,
      'ends_at', v_target.ends_at,
      'achieved_sales', v_achieved,
      'achieved_orders', v_achieved_orders,
      'days_remaining', greatest((v_target.ends_at - (timezone('utc', now()))::date), 0),
      'pct', CASE WHEN v_target.sales_amount > 0
        THEN least(round((v_achieved / v_target.sales_amount) * 100), 999)
        ELSE 0 END
    ) END,
    'recent_sales', coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT s.id, s.invoice_no, s.grand_total, s.paid_total, s.due_total,
               s.status, s.fulfilment_status, s.order_source, s.created_at,
               c.name AS customer_name, c.phone AS customer_phone
        FROM public.sales s
        LEFT JOIN public.customers c ON c.id = s.customer_id
        WHERE s.organization_id = v_org_id AND s.deleted_at IS NULL
          AND public.sale_attributed_staff_id(s) = v_staff
          AND (v_branch IS NULL OR s.branch_id = v_branch)
        ORDER BY s.created_at DESC
        LIMIT 8
      ) r
    ), '[]'::jsonb),
    'pending_follow_ups', coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT f.id, f.customer_id, f.follow_up_at, f.priority, f.note, f.status,
               c.name AS customer_name, c.phone AS customer_phone, c.current_due
        FROM public.staff_follow_ups f
        JOIN public.customers c ON c.id = f.customer_id
        WHERE f.organization_id = v_org_id AND f.staff_user_id = v_staff
          AND f.deleted_at IS NULL AND f.status = 'pending'
        ORDER BY f.follow_up_at ASC
        LIMIT 8
      ) r
    ), '[]'::jsonb),
    'refreshed_at', timezone('utc', now())
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_dashboard_summary(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- list_staff_sales
--------------------------------------------------------------------------------
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

--------------------------------------------------------------------------------
-- get_staff_commission_summary + list entries
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_commission_summary(payload jsonb DEFAULT '{}'::jsonb)
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
  v_month_start timestamptz := date_trunc('month', timezone('utc', now()));
  v_today_start timestamptz := date_trunc('day', timezone('utc', now()));
  v_week_start timestamptz := date_trunc('week', timezone('utc', now()));
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.commission.read_own')
    OR public.user_has_permission('sales.commission.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id
     AND NOT (
       public.user_has_permission('sales.commission.manage')
       OR public.user_has_permission('settings.manage')
     ) THEN
    RAISE EXCEPTION 'Cannot view another staff commission' USING ERRCODE = '42501';
  END IF;

  RETURN (
    WITH c AS (
      SELECT * FROM public.salesman_commissions sc
      WHERE sc.organization_id = v_org_id AND sc.deleted_at IS NULL
        AND (sc.profile_id = v_staff OR sc.employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL))
        AND sc.status <> 'cancelled'
    )
    SELECT jsonb_build_object(
      'today', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_today_start AND status IN ('pending','approved','paid')), 0),
      'week', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_week_start AND status IN ('pending','approved','paid')), 0),
      'month', coalesce((SELECT sum(commission_amount) FROM c WHERE created_at >= v_month_start AND status IN ('pending','approved','paid')), 0),
      'pending', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'pending'), 0),
      'approved', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'approved'), 0),
      'paid', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'paid'), 0),
      'reversed', coalesce((SELECT sum(commission_amount) FROM c WHERE status = 'reversed'), 0),
      'last_paid_at', (SELECT max(paid_at) FROM c WHERE status = 'paid')
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_staff_commission_summary(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_staff_commission_entries(payload jsonb DEFAULT '{}'::jsonb)
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
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.commission.read_own')
    OR public.user_has_permission('sales.commission.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id
     AND NOT (
       public.user_has_permission('sales.commission.manage')
       OR public.user_has_permission('settings.manage')
     ) THEN
    RAISE EXCEPTION 'Cannot view another staff commission' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'items', coalesce((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (
        SELECT sc.id, sc.sale_id, sc.commission_amount,  sc.status,
               sc.created_at, sc.approved_at, sc.paid_at,
               s.invoice_no, s.grand_total, c.name AS customer_name
        FROM public.salesman_commissions sc
        LEFT JOIN public.sales s ON s.id = sc.sale_id
        LEFT JOIN public.customers c ON c.id = s.customer_id
        WHERE sc.organization_id = v_org_id AND sc.deleted_at IS NULL
          AND (sc.profile_id = v_staff OR sc.employee_id IN (SELECT e.id FROM public.employees e WHERE e.profile_id = v_staff AND e.deleted_at IS NULL))
          AND (NULLIF(payload->>'status', '') IS NULL OR sc.status = payload->>'status')
        ORDER BY sc.created_at DESC
        OFFSET (v_page - 1) * v_page_size
        LIMIT v_page_size
      ) r
    ), '[]'::jsonb),
    'page', v_page,
    'page_size', v_page_size
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_commission_entries(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- Follow-ups
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_staff_follow_ups(payload jsonb DEFAULT '{}'::jsonb)
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
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('staff.follow_ups.manage')
     AND NOT public.user_has_permission('staff.dashboard.read') THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_staff := coalesce(NULLIF(payload->>'staff_user_id', '')::uuid, v_profile_id);
  IF v_staff <> v_profile_id
     AND NOT (
       public.user_has_permission('staff.targets.manage')
       OR public.user_has_permission('settings.manage')
     ) THEN
    RAISE EXCEPTION 'Cannot view another staff follow-ups' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(r)::jsonb)
    FROM (
      SELECT f.*, c.name AS customer_name, c.phone AS customer_phone, c.current_due
      FROM public.staff_follow_ups f
      JOIN public.customers c ON c.id = f.customer_id
      WHERE f.organization_id = v_org_id AND f.staff_user_id = v_staff
        AND f.deleted_at IS NULL
        AND (NULLIF(payload->>'status', '') IS NULL OR f.status = payload->>'status')
      ORDER BY
        CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END,
        f.follow_up_at ASC
      LIMIT least(coalesce((payload->>'limit')::int, 50), 100)
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_follow_ups(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.upsert_staff_follow_up(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_id uuid := NULLIF(payload->>'id', '')::uuid;
  v_row public.staff_follow_ups%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('staff.follow_ups.manage') THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.staff_follow_ups (
      organization_id, staff_user_id, customer_id, sale_id,
      follow_up_at, priority, note, created_by, updated_by
    ) VALUES (
      v_org_id, v_profile_id,
      (payload->>'customer_id')::uuid,
      NULLIF(payload->>'sale_id', '')::uuid,
      (payload->>'follow_up_at')::timestamptz,
      coalesce(NULLIF(payload->>'priority', ''), 'normal'),
      NULLIF(payload->>'note', ''),
      v_profile_id, v_profile_id
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.staff_follow_ups
    SET follow_up_at = coalesce((payload->>'follow_up_at')::timestamptz, follow_up_at),
        priority = coalesce(NULLIF(payload->>'priority', ''), priority),
        note = coalesce(NULLIF(payload->>'note', ''), note),
        updated_by = v_profile_id
    WHERE id = v_id AND organization_id = v_org_id
      AND staff_user_id = v_profile_id AND deleted_at IS NULL
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Follow-up not found';
    END IF;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_staff_follow_up(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_staff_follow_up(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_id uuid := (payload->>'id')::uuid;
  v_row public.staff_follow_ups%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT public.user_has_permission('staff.follow_ups.manage') THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  UPDATE public.staff_follow_ups
  SET status = 'completed',
      completed_at = timezone('utc', now()),
      note = coalesce(NULLIF(payload->>'note', ''), note),
      updated_by = v_profile_id
  WHERE id = v_id AND organization_id = v_org_id
    AND staff_user_id = v_profile_id AND deleted_at IS NULL
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Follow-up not found';
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, NULL, v_profile_id,
    'staff.follow_up.complete', 'staff_follow_up', v_id,
    NULL, jsonb_build_object('customer_id', v_row.customer_id), NULL,
    jsonb_build_object('source', 'complete_staff_follow_up')
  );

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_staff_follow_up(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- assign_staff_target
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_staff_target(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_row public.staff_targets%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();
  IF NOT (
    public.user_has_permission('staff.targets.manage')
    OR public.user_has_permission('settings.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.staff_targets (
    organization_id, staff_user_id, branch_id, target_period,
    sales_amount, order_count, collection_amount, new_customers,
    starts_at, ends_at, note, created_by, updated_by
  ) VALUES (
    v_org_id,
    (payload->>'staff_user_id')::uuid,
    NULLIF(payload->>'branch_id', '')::uuid,
    coalesce(NULLIF(payload->>'target_period', ''), 'monthly'),
    coalesce((payload->>'sales_amount')::numeric, 0),
    coalesce((payload->>'order_count')::int, 0),
    coalesce((payload->>'collection_amount')::numeric, 0),
    coalesce((payload->>'new_customers')::int, 0),
    (payload->>'starts_at')::date,
    (payload->>'ends_at')::date,
    NULLIF(payload->>'note', ''),
    v_profile_id, v_profile_id
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_staff_target(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- list_my_assigned_customers
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_assigned_customers(payload jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  RETURN coalesce((
    SELECT jsonb_agg(row_to_json(r)::jsonb)
    FROM (
      SELECT
        c.id, c.name, c.phone, c.current_due, c.created_at,
        a.assigned_at,
        (
          SELECT max(s.created_at) FROM public.sales s
          WHERE s.customer_id = c.id AND s.deleted_at IS NULL
        ) AS last_purchase_at,
        (
          SELECT max(f.follow_up_at) FROM public.staff_follow_ups f
          WHERE f.customer_id = c.id AND f.staff_user_id = v_profile_id
            AND f.deleted_at IS NULL
        ) AS last_follow_up_at,
        crs.score AS rating_score
      FROM public.customer_staff_assignments a
      JOIN public.customers c ON c.id = a.customer_id AND c.deleted_at IS NULL
      LEFT JOIN public.customer_rating_summaries crs
        ON crs.customer_id = c.id AND crs.deleted_at IS NULL
      WHERE a.organization_id = v_org_id
        AND a.staff_user_id = v_profile_id
        AND a.deleted_at IS NULL
      ORDER BY a.assigned_at DESC
      LIMIT least(coalesce((payload->>'limit')::int, 50), 100)
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_my_assigned_customers(jsonb) TO authenticated;
