-- Migration 103: Sale returnable quantity helper

CREATE OR REPLACE FUNCTION public.get_sale_returnable_qty(p_sale_item_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT greatest(
    coalesce(si.qty, 0) - coalesce((
      SELECT sum(sri.qty)
      FROM public.sale_return_items sri
      JOIN public.sale_returns sr ON sr.id = sri.sale_return_id
      WHERE sri.sale_item_id = si.id
        AND sr.deleted_at IS NULL
        AND sr.status IN ('completed', 'pending', 'approved')
        AND sri.deleted_at IS NULL
    ), 0),
    0
  )
  FROM public.sale_items si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_sale_item_id
    AND si.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.organization_id = public.current_organization_id();
$$;

CREATE OR REPLACE FUNCTION public.get_sale_returnable_items(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org uuid := public.current_organization_id();
BEGIN
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.user_has_permission('sales.return')
    OR public.user_has_permission('sales.return.review')
    OR public.user_has_permission('sales.read')
  ) THEN
    RAISE EXCEPTION 'Missing permission' USING ERRCODE = '42501';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'sale_item_id', si.id,
      'variant_id', si.variant_id,
      'sold_qty', si.qty,
      'returnable_qty', public.get_sale_returnable_qty(si.id),
      'unit_price', si.unit_price,
      'product_name', p.name,
      'variant_name', coalesce(pv.name, pv.sku),
      'barcode', pv.barcode
    ) ORDER BY si.created_at)
    FROM public.sale_items si
    JOIN public.product_variants pv ON pv.id = si.variant_id
    JOIN public.products p ON p.id = pv.product_id
    WHERE si.sale_id = p_sale_id
      AND si.organization_id = v_org
      AND si.deleted_at IS NULL
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_sale_returnable_qty(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_returnable_qty(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_sale_returnable_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_returnable_items(uuid) TO authenticated, service_role;
