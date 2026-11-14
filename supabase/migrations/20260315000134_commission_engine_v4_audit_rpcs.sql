-- Commission Engine V4.0 P2/P3 read RPCs: sale audit, HR summarize, discrepancy dry-run

--------------------------------------------------------------------------------
-- get_sale_commission_audit(p_sale_id)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_sale_commission_audit(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_profile uuid;
  v_sale public.sales%ROWTYPE;
  v_rows jsonb;
  v_summary jsonb;
BEGIN
  SELECT * INTO v_profile, v_org FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('sales.read')
    OR public.user_has_permission('*')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.id = p_sale_id
    AND s.organization_id = v_org
    AND s.deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found';
  END IF;

  IF NOT public.user_has_branch_access(v_sale.branch_id) THEN
    RAISE EXCEPTION 'No branch access' USING ERRCODE = '42501';
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      sc.id,
      sc.profile_id,
      sc.employee_id,
      sc.base_amount,
      sc.commission_amount,
      sc.reversed_amount,
      sc.original_commission_amount,
      sc.recoverable_amount,
      sc.status,
      sc.rule_snapshot,
      sc.notes,
      sc.created_at,
      sc.approved_at,
      sc.paid_at,
      p.full_name AS profile_name,
      e.full_name AS employee_name,
      e.employee_code
    FROM public.salesman_commissions sc
    LEFT JOIN public.profiles p ON p.id = sc.profile_id
    LEFT JOIN public.employees e ON e.id = sc.employee_id
    WHERE sc.sale_id = p_sale_id
      AND sc.organization_id = v_org
      AND sc.deleted_at IS NULL
  ) x;

  SELECT jsonb_build_object(
    'accrued', coalesce(sum(coalesce(sc.original_commission_amount, sc.commission_amount + coalesce(sc.reversed_amount, 0))), 0),
    'reversed', coalesce(sum(coalesce(sc.reversed_amount, 0)), 0),
    'net_earned', coalesce(sum(
      CASE WHEN sc.status = 'reversed' THEN 0 ELSE sc.commission_amount END
    ), 0),
    'paid', coalesce(sum(
      CASE
        WHEN sc.status = 'paid' THEN sc.commission_amount + coalesce(sc.recoverable_amount, 0)
        WHEN coalesce(sc.recoverable_amount, 0) > 0
          THEN coalesce(sc.original_commission_amount, sc.commission_amount + coalesce(sc.reversed_amount, 0))
        ELSE 0
      END
    ), 0),
    'outstanding', coalesce(sum(sc.commission_amount) FILTER (WHERE sc.status IN ('pending','approved')), 0),
    'recoverable', coalesce(sum(coalesce(sc.recoverable_amount, 0)), 0),
    'row_count', count(*)::int
  )
  INTO v_summary
  FROM public.salesman_commissions sc
  WHERE sc.sale_id = p_sale_id
    AND sc.organization_id = v_org
    AND sc.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'sale_id', p_sale_id,
    'invoice_no', v_sale.invoice_no,
    'sale_status', v_sale.status,
    'summary', v_summary,
    'commissions', v_rows,
    'exceptions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', e.id,
        'reason', e.reason,
        'created_at', e.created_at,
        'resolved_at', e.resolved_at
      ) ORDER BY e.created_at)
      FROM public.commission_attribution_exceptions e
      WHERE e.sale_id = p_sale_id AND e.deleted_at IS NULL
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_sale_commission_audit(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_sale_commission_audit(uuid) TO authenticated;

--------------------------------------------------------------------------------
-- summarize_sales_commissions — full filtered KPIs (not page-scoped)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.summarize_sales_commissions(
  p_status text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_profile uuid;
  v_from_ts timestamptz;
  v_to_ts timestamptz;
BEGIN
  SELECT * INTO v_profile, v_org FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('*')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  v_from_ts := CASE WHEN p_from IS NULL THEN NULL ELSE (p_from::timestamp AT TIME ZONE 'Asia/Dhaka') END;
  v_to_ts := CASE
    WHEN p_to IS NULL THEN NULL
    ELSE ((p_to + 1)::timestamp AT TIME ZONE 'Asia/Dhaka')
  END;

  RETURN (
    SELECT jsonb_build_object(
      'accrued', coalesce(sum(coalesce(sc.original_commission_amount, sc.commission_amount + coalesce(sc.reversed_amount, 0))), 0),
      'pending', coalesce(sum(sc.commission_amount) FILTER (WHERE sc.status = 'pending'), 0),
      'approved', coalesce(sum(sc.commission_amount) FILTER (WHERE sc.status = 'approved'), 0),
      'paid', coalesce(sum(
        CASE
          WHEN sc.status = 'paid' THEN sc.commission_amount
          WHEN coalesce(sc.recoverable_amount, 0) > 0 THEN coalesce(sc.recoverable_amount, 0)
          ELSE 0
        END
      ), 0),
      'reversed', coalesce(sum(coalesce(sc.reversed_amount, 0)), 0),
      'net_earned', coalesce(sum(
        CASE WHEN sc.status = 'reversed' THEN 0 ELSE sc.commission_amount END
      ), 0),
      'outstanding', coalesce(sum(sc.commission_amount) FILTER (WHERE sc.status IN ('pending','approved')), 0),
      'recoverable', coalesce(sum(coalesce(sc.recoverable_amount, 0)), 0),
      'exceptions', (
        SELECT count(*)::int
        FROM public.commission_attribution_exceptions e
        WHERE e.organization_id = v_org
          AND e.deleted_at IS NULL
          AND e.resolved_at IS NULL
      ),
      'row_count', count(*)::int
    )
    FROM public.salesman_commissions sc
    WHERE sc.organization_id = v_org
      AND sc.deleted_at IS NULL
      AND (p_status IS NULL OR sc.status = p_status)
      AND (p_profile_id IS NULL OR sc.profile_id = p_profile_id)
      AND (p_employee_id IS NULL OR sc.employee_id = p_employee_id)
      AND (v_from_ts IS NULL OR sc.created_at >= v_from_ts)
      AND (v_to_ts IS NULL OR sc.created_at < v_to_ts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.summarize_sales_commissions(text, uuid, uuid, date, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.summarize_sales_commissions(text, uuid, uuid, date, date) TO authenticated;

--------------------------------------------------------------------------------
-- audit_commission_discrepancies — dry-run report only
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_commission_discrepancies(
  p_limit int DEFAULT 200
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid;
  v_profile uuid;
  v_items jsonb := '[]'::jsonb;
  v_limit int := least(greatest(coalesce(p_limit, 200), 1), 1000);
BEGIN
  SELECT * INTO v_profile, v_org FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('sales.commission.read')
    OR public.user_has_permission('*')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  -- Voided sales with active residual commission
  SELECT coalesce(jsonb_agg(x), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT jsonb_build_object(
      'category', 'voided_with_active_commission',
      'severity', 'critical',
      'sale_id', s.id,
      'invoice_no', s.invoice_no,
      'actual_earning', sum(sc.commission_amount),
      'expected_earning', 0,
      'difference', sum(sc.commission_amount)
    ) AS x
    FROM public.sales s
    JOIN public.salesman_commissions sc ON sc.sale_id = s.id AND sc.deleted_at IS NULL
    WHERE s.organization_id = v_org
      AND s.deleted_at IS NULL
      AND s.status = 'voided'
      AND sc.status IN ('pending', 'approved', 'paid')
      AND sc.commission_amount > 0
    GROUP BY s.id, s.invoice_no
    LIMIT v_limit
  ) q;

  -- Corrected originals that still have active commission
  v_items := v_items || coalesce((
    SELECT jsonb_agg(x)
    FROM (
      SELECT jsonb_build_object(
        'category', 'corrected_with_active_commission',
        'severity', 'critical',
        'sale_id', s.id,
        'invoice_no', s.invoice_no,
        'actual_earning', sum(sc.commission_amount),
        'expected_earning', 0,
        'difference', sum(sc.commission_amount)
      ) AS x
      FROM public.sales s
      JOIN public.salesman_commissions sc ON sc.sale_id = s.id AND sc.deleted_at IS NULL
      WHERE s.organization_id = v_org
        AND s.deleted_at IS NULL
        AND s.status = 'corrected'
        AND sc.status IN ('pending', 'approved', 'paid')
        AND sc.commission_amount > 0
      GROUP BY s.id, s.invoice_no
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);

  -- Open attribution exceptions
  v_items := v_items || coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'category', 'unresolved_attribution',
      'severity', 'high',
      'sale_id', e.sale_id,
      'invoice_no', s.invoice_no,
      'reason', e.reason,
      'difference', null
    ))
    FROM public.commission_attribution_exceptions e
    JOIN public.sales s ON s.id = e.sale_id
    WHERE e.organization_id = v_org
      AND e.deleted_at IS NULL
      AND e.resolved_at IS NULL
    LIMIT v_limit
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'dry_run', true,
    'organization_id', v_org,
    'examined_categories', jsonb_build_array(
      'voided_with_active_commission',
      'corrected_with_active_commission',
      'unresolved_attribution'
    ),
    'discrepancy_count', jsonb_array_length(v_items),
    'total_exposure', (
      SELECT coalesce(sum((elem->>'difference')::numeric), 0)
      FROM jsonb_array_elements(v_items) elem
      WHERE elem->>'difference' IS NOT NULL
    ),
    'items', v_items
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_commission_discrepancies(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_commission_discrepancies(int) TO authenticated;
