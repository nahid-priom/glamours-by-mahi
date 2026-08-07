-- Migration 119: Public invoice token-bound RPC, storefront cost/stock privacy,
-- track_online_order hardening. Forward-only; does not edit prior migrations.
--
-- Rollback notes:
--   DROP FUNCTION public.get_public_invoice_by_token(text);
--   Recreate sales_public_share_select / sale_items_public_share_select /
--   customers_public_share_select from migration 016/019;
--   REVOKE column grants and GRANT SELECT ON tables TO anon;
--   Restore prior track_online_order body from 099.

--------------------------------------------------------------------------------
-- 1A. Drop unbound anon invoice policies; token-bound SECURITY DEFINER RPC
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS sales_public_share_select ON public.sales;
DROP POLICY IF EXISTS sale_items_public_share_select ON public.sale_items;
DROP POLICY IF EXISTS customers_public_share_select ON public.customers;

CREATE OR REPLACE FUNCTION public.get_public_invoice_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token text := btrim(coalesce(p_token, ''));
  v_sale public.sales%ROWTYPE;
  v_customer jsonb;
  v_items jsonb;
BEGIN
  IF char_length(v_token) < 16 THEN
    RAISE EXCEPTION 'Invalid invoice link' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_sale
  FROM public.sales s
  WHERE s.public_share_token = v_token
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or link expired' USING ERRCODE = 'P0002';
  END IF;

  SELECT jsonb_build_object(
    'name', c.name,
    'phone', c.phone
  )
  INTO v_customer
  FROM public.customers c
  WHERE c.id = v_sale.customer_id
    AND c.deleted_at IS NULL;

  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', si.id,
      'qty', si.qty,
      'unit_price', si.unit_price,
      'line_total', si.line_total,
      'name', coalesce(p.name, pv.name, pv.sku, 'Item'),
      'sku', pv.sku
    )
    ORDER BY si.created_at
  ), '[]'::jsonb)
  INTO v_items
  FROM public.sale_items si
  LEFT JOIN public.product_variants pv ON pv.id = si.variant_id
  LEFT JOIN public.products p ON p.id = pv.product_id
  WHERE si.sale_id = v_sale.id
    AND si.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'invoice_no', v_sale.invoice_no,
    'grand_total', v_sale.grand_total,
    'paid_total', v_sale.paid_total,
    'due_total', v_sale.due_total,
    'completed_at', v_sale.completed_at,
    'status', v_sale.status,
    'channel', v_sale.channel,
    'customer', v_customer,
    'items', v_items
  );
END;
$$;

COMMENT ON FUNCTION public.get_public_invoice_by_token(text) IS
  'Read-only public invoice DTO by unpredictable share token. No cost, staff, or internal fields.';

REVOKE ALL ON FUNCTION public.get_public_invoice_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_invoice_by_token(text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 1A. Harden track_online_order: no share token; exact phone / invoice prefix
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_online_order(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_q text := btrim(coalesce(p_query, ''));
  v_rows jsonb;
  v_phone text;
BEGIN
  -- Public tracking: do not return public_share_token (enumeration risk).
  IF v_q = '' OR char_length(v_q) < 3 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF upper(v_q) LIKE 'WEB-%' OR upper(v_q) LIKE 'MOD-%' OR upper(v_q) LIKE 'INV-%' THEN
    SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        s.invoice_no,
        s.grand_total,
        s.due_total,
        s.status,
        s.channel,
        s.completed_at,
        jsonb_build_object('name', c.name, 'phone', c.phone) AS customers
      FROM public.sales s
      LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
        AND s.deleted_at IS NULL
        AND s.invoice_no ILIKE v_q || '%'
      ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
      LIMIT 5
    ) t;
    RETURN v_rows;
  END IF;

  -- Exact phone match only (normalize digits); no substring search.
  v_phone := regexp_replace(v_q, '[^0-9+]', '', 'g');
  IF char_length(regexp_replace(v_phone, '\D', '', 'g')) < 10 THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.invoice_no,
      s.grand_total,
      s.due_total,
      s.status,
      s.channel,
      s.completed_at,
      jsonb_build_object('name', c.name, 'phone', c.phone) AS customers
    FROM public.sales s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND regexp_replace(c.phone, '\D', '', 'g') = regexp_replace(v_phone, '\D', '', 'g')
    ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
    LIMIT 10
  ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.track_online_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_online_order(text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 1B. Scope anon org read; strip cost columns from anon catalog grants
--------------------------------------------------------------------------------
DROP POLICY IF EXISTS storefront_organizations_select ON public.organizations;
CREATE POLICY storefront_organizations_select ON public.organizations
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND slug = 'glamourous-by-mahi'
  );

-- Column-level: anon cannot select purchase/wholesale/cost fields
REVOKE SELECT ON TABLE public.products FROM anon;
GRANT SELECT (
  id, organization_id, category_id, subcategory_id, brand_id,
  name, description, base_sku, base_barcode, selling_price, unit,
  has_variants, product_type, is_active, published_at, status,
  created_at, updated_at, deleted_at, reorder_level
) ON TABLE public.products TO anon;

REVOKE SELECT ON TABLE public.product_variants FROM anon;
GRANT SELECT (
  id, organization_id, product_id, sku, barcode, name, selling_price,
  is_active, image_path, created_at, updated_at, deleted_at
) ON TABLE public.product_variants TO anon;

-- Inventory: quantity visibility only (no WAC / average_unit_cost)
REVOKE SELECT ON TABLE public.inventory_balances FROM anon;
GRANT SELECT (
  id, organization_id, variant_id, location_id, quantity, qty_reserved, deleted_at
) ON TABLE public.inventory_balances TO anon;

COMMENT ON POLICY storefront_organizations_select ON public.organizations IS
  'Anon may resolve only the public storefront organization by slug.';
