-- Migration 096: Customer recent orders for POS / moderator intake (customers.read)

CREATE OR REPLACE FUNCTION public.list_customer_recent_orders(
  p_customer_id uuid,
  p_limit int DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid := public.current_organization_id();
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 10), 1), 50);
  v_result jsonb;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('customers.read')
    OR public.user_has_permission('customers.manage')
    OR public.user_has_permission('pos.create')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.id = p_customer_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Customer not found';
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT
      s.id,
      s.invoice_no,
      s.status,
      s.fulfilment_status,
      s.channel,
      s.order_source,
      s.grand_total,
      s.due_total,
      s.created_at,
      s.completed_at
    FROM public.sales s
    WHERE s.organization_id = v_org_id
      AND s.customer_id = p_customer_id
      AND s.deleted_at IS NULL
    ORDER BY s.created_at DESC
    LIMIT v_limit
  ) t;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.list_customer_recent_orders(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_customer_recent_orders(uuid, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_customer_recent_orders(uuid, int) IS
  'Returns recent sales for a customer; gated on customers.read (or related sales/POS perms).';
