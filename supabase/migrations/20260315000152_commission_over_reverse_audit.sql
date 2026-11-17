-- Migration 152: Read-only over-reverse / line-mismatch discrepancy categories.
-- Does NOT rewrite historical commissions. Extends audit_commission_discrepancies.

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
      'commission_id', null,
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
        'commission_id', null,
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
      'commission_id', null,
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

  -- Over-reversed: reversed_amount exceeds original entitlement
  v_items := v_items || coalesce((
    SELECT jsonb_agg(x)
    FROM (
      SELECT jsonb_build_object(
        'category', 'over_reversed_commission',
        'severity', 'critical',
        'sale_id', sc.sale_id,
        'invoice_no', s.invoice_no,
        'commission_id', sc.id,
        'sale_item_id', sc.sale_item_id,
        'profile_id', sc.profile_id,
        'actual_earning', sc.commission_amount,
        'expected_earning', greatest(
          coalesce(sc.original_commission_amount, sc.commission_amount + coalesce(sc.reversed_amount, 0))
            - coalesce(sc.reversed_amount, 0),
          0
        ),
        'difference', coalesce(sc.reversed_amount, 0) - coalesce(
          sc.original_commission_amount,
          sc.commission_amount + coalesce(sc.reversed_amount, 0)
        ),
        'reversed_amount', sc.reversed_amount,
        'original_commission_amount', sc.original_commission_amount,
        'recoverable_amount', sc.recoverable_amount
      ) AS x
      FROM public.salesman_commissions sc
      LEFT JOIN public.sales s ON s.id = sc.sale_id
      WHERE sc.organization_id = v_org
        AND sc.deleted_at IS NULL
        AND coalesce(sc.reversed_amount, 0) >
            coalesce(
              sc.original_commission_amount,
              sc.commission_amount + coalesce(sc.reversed_amount, 0)
            ) + 0.009
      ORDER BY sc.updated_at DESC NULLS LAST
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);

  -- Paid rows with open recoverable balance (informational — not auto-repaired)
  v_items := v_items || coalesce((
    SELECT jsonb_agg(x)
    FROM (
      SELECT jsonb_build_object(
        'category', 'paid_with_recoverable_balance',
        'severity', 'medium',
        'sale_id', sc.sale_id,
        'invoice_no', s.invoice_no,
        'commission_id', sc.id,
        'actual_earning', sc.commission_amount,
        'expected_earning', null,
        'difference', sc.recoverable_amount,
        'recoverable_amount', sc.recoverable_amount
      ) AS x
      FROM public.salesman_commissions sc
      LEFT JOIN public.sales s ON s.id = sc.sale_id
      WHERE sc.organization_id = v_org
        AND sc.deleted_at IS NULL
        AND coalesce(sc.recoverable_amount, 0) > 0
      ORDER BY sc.recoverable_amount DESC
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);

  -- Line commissions fully reversed without return_reverse/exchange_reverse event_type
  -- (symptom of migration 133 dropping event_type updates)
  v_items := v_items || coalesce((
    SELECT jsonb_agg(x)
    FROM (
      SELECT jsonb_build_object(
        'category', 'reversed_missing_event_type',
        'severity', 'low',
        'sale_id', sc.sale_id,
        'invoice_no', s.invoice_no,
        'commission_id', sc.id,
        'actual_earning', sc.commission_amount,
        'expected_earning', null,
        'difference', null,
        'event_type', sc.event_type,
        'status', sc.status
      ) AS x
      FROM public.salesman_commissions sc
      LEFT JOIN public.sales s ON s.id = sc.sale_id
      WHERE sc.organization_id = v_org
        AND sc.deleted_at IS NULL
        AND sc.status = 'reversed'
        AND coalesce(sc.reversed_amount, 0) > 0
        AND coalesce(sc.event_type, 'sale') NOT IN ('return_reverse', 'exchange_reverse')
        AND (
          coalesce(sc.notes, '') LIKE '%reversed:%'
          OR coalesce(sc.notes, '') LIKE '%exchange%'
        )
      ORDER BY sc.updated_at DESC NULLS LAST
      LIMIT v_limit
    ) q
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'dry_run', true,
    'organization_id', v_org,
    'examined_categories', jsonb_build_array(
      'voided_with_active_commission',
      'corrected_with_active_commission',
      'unresolved_attribution',
      'over_reversed_commission',
      'paid_with_recoverable_balance',
      'reversed_missing_event_type'
    ),
    'discrepancy_count', jsonb_array_length(v_items),
    'total_exposure', (
      SELECT coalesce(sum((elem->>'difference')::numeric), 0)
      FROM jsonb_array_elements(v_items) elem
      WHERE elem->>'difference' IS NOT NULL
        AND elem->>'category' IN (
          'voided_with_active_commission',
          'corrected_with_active_commission',
          'over_reversed_commission'
        )
    ),
    'items', v_items,
    'repair_policy', 'read_only_no_auto_backfill'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.audit_commission_discrepancies(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_commission_discrepancies(int) TO authenticated;

COMMENT ON FUNCTION public.audit_commission_discrepancies(int) IS
  'Read-only commission discrepancy report including over-reverse candidates. Never mutates ledger.';
