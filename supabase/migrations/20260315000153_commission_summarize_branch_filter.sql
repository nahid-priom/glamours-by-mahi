-- Migration 153: Optional branch filter on summarize_sales_commissions.
-- Additive; p_branch_id DEFAULT NULL. Drop prior 5-arg overload so named
-- RPC calls resolve to a single authoritative signature.
-- Active branch is UI context — callers must still pass only authorized branches;
-- SQL also enforces user_has_branch_access when p_branch_id is provided.

DROP FUNCTION IF EXISTS public.summarize_sales_commissions(text, uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION public.summarize_sales_commissions(
  p_status text DEFAULT NULL,
  p_profile_id uuid DEFAULT NULL,
  p_employee_id uuid DEFAULT NULL,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_branch_id uuid DEFAULT NULL
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

  IF p_branch_id IS NOT NULL AND NOT public.user_has_branch_access(p_branch_id) THEN
    RAISE EXCEPTION 'No access to branch' USING ERRCODE = '42501';
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
          AND (p_branch_id IS NULL OR e.branch_id IS NULL OR e.branch_id = p_branch_id)
      ),
      'row_count', count(*)::int
    )
    FROM public.salesman_commissions sc
    WHERE sc.organization_id = v_org
      AND sc.deleted_at IS NULL
      AND (p_status IS NULL OR sc.status = p_status)
      AND (p_profile_id IS NULL OR sc.profile_id = p_profile_id)
      AND (p_employee_id IS NULL OR sc.employee_id = p_employee_id)
      AND (p_branch_id IS NULL OR sc.branch_id = p_branch_id)
      AND (v_from_ts IS NULL OR sc.created_at >= v_from_ts)
      AND (v_to_ts IS NULL OR sc.created_at < v_to_ts)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.summarize_sales_commissions(text, uuid, uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.summarize_sales_commissions(text, uuid, uuid, date, date, uuid) TO authenticated;
