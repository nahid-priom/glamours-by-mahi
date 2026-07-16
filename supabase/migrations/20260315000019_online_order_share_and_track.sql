-- Migration 019: Public invoice share tokens + track_online_order RPC
-- Depends on: 016 (public_share_token column may already exist), 018 ecommerce checkout

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS sales_public_share_token_uidx
  ON public.sales (public_share_token)
  WHERE public_share_token IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.sales.public_share_token IS
  'Random revocable token for /public/invoice/:token — never expose sale UUID publicly.';

-- Auto-assign share token for completed online/ecommerce sales
CREATE OR REPLACE FUNCTION public.sales_assign_public_share_token()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_share_token IS NULL
     AND coalesce(NEW.channel, '') IN ('ecommerce', 'online')
     AND NEW.status = 'completed' THEN
    NEW.public_share_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_assign_public_share_token_trg ON public.sales;
CREATE TRIGGER sales_assign_public_share_token_trg
  BEFORE INSERT OR UPDATE OF channel, status, public_share_token ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_assign_public_share_token();

UPDATE public.sales
SET public_share_token = encode(gen_random_bytes(24), 'hex')
WHERE coalesce(channel, '') IN ('ecommerce', 'online')
  AND public_share_token IS NULL
  AND deleted_at IS NULL
  AND status = 'completed';

-- Anon read policies for tokenized invoices (016 may already add these)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sales' AND policyname = 'sales_public_share_select'
  ) THEN
    CREATE POLICY sales_public_share_select ON public.sales
      FOR SELECT TO anon
      USING (
        deleted_at IS NULL
        AND public_share_token IS NOT NULL
        AND status = 'completed'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sale_items' AND policyname = 'sale_items_public_share_select'
  ) THEN
    CREATE POLICY sale_items_public_share_select ON public.sale_items
      FOR SELECT TO anon
      USING (
        deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.id = sale_items.sale_id
            AND s.deleted_at IS NULL
            AND s.public_share_token IS NOT NULL
            AND s.status = 'completed'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customers' AND policyname = 'customers_public_share_select'
  ) THEN
    CREATE POLICY customers_public_share_select ON public.customers
      FOR SELECT TO anon
      USING (
        deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.sales s
          WHERE s.customer_id = customers.id
            AND s.deleted_at IS NULL
            AND s.public_share_token IS NOT NULL
            AND s.status = 'completed'
        )
      );
  END IF;
END $$;

--------------------------------------------------------------------------------
-- track_online_order: limited public lookup by invoice or phone
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.track_online_order(p_query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q text := btrim(coalesce(p_query, ''));
  v_rows jsonb;
BEGIN
  IF v_q = '' OR char_length(v_q) < 3 THEN
    RETURN '[]'::jsonb;
  END IF;

  IF upper(v_q) LIKE 'WEB-%' THEN
    SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT
        s.id,
        s.invoice_no,
        s.grand_total,
        s.due_total,
        s.status,
        s.channel,
        s.completed_at,
        s.public_share_token,
        jsonb_build_object('name', c.name, 'phone', c.phone) AS customers
      FROM public.sales s
      LEFT JOIN public.customers c ON c.id = s.customer_id
      WHERE coalesce(s.channel, '') IN ('ecommerce', 'online')
        AND s.deleted_at IS NULL
        AND s.invoice_no ILIKE v_q || '%'
      ORDER BY s.completed_at DESC NULLS LAST
      LIMIT 10
    ) t;
    RETURN v_rows;
  END IF;

  SELECT coalesce(jsonb_agg(row_to_json(t)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.invoice_no,
      s.grand_total,
      s.due_total,
      s.status,
      s.channel,
      s.completed_at,
      s.public_share_token,
      jsonb_build_object('name', c.name, 'phone', c.phone) AS customers
    FROM public.sales s
    JOIN public.customers c ON c.id = s.customer_id
    WHERE coalesce(s.channel, '') IN ('ecommerce', 'online')
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.phone ILIKE '%' || v_q || '%'
    ORDER BY s.completed_at DESC NULLS LAST
    LIMIT 20
  ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.track_online_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_online_order(text) TO anon, authenticated, service_role;
