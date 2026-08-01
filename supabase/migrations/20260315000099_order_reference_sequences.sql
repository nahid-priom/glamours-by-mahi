-- Migration 099: Atomic document reference sequences (MOD online order invoices)

--------------------------------------------------------------------------------
-- order_reference_sequences
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_reference_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  prefix text NOT NULL,
  last_value bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT order_reference_sequences_org_prefix_uidx UNIQUE (organization_id, prefix)
);

CREATE TRIGGER order_reference_sequences_set_updated_at
  BEFORE UPDATE ON public.order_reference_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_reference_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_reference_sequences_service ON public.order_reference_sequences;
CREATE POLICY order_reference_sequences_service
  ON public.order_reference_sequences
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.order_reference_sequences TO authenticated;
GRANT ALL ON public.order_reference_sequences TO service_role;

--------------------------------------------------------------------------------
-- allocate_document_reference — concurrency-safe via row lock
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.allocate_document_reference(
  p_organization_id uuid,
  p_prefix text,
  p_pad int DEFAULT 4
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_prefix text := upper(btrim(coalesce(p_prefix, '')));
  v_pad int := greatest(coalesce(p_pad, 4), 1);
  v_next bigint;
BEGIN
  IF p_organization_id IS NULL OR v_prefix = '' THEN
    RAISE EXCEPTION 'organization_id and prefix are required';
  END IF;

  INSERT INTO public.order_reference_sequences (organization_id, prefix, last_value)
  VALUES (p_organization_id, v_prefix, 0)
  ON CONFLICT (organization_id, prefix) DO NOTHING;

  UPDATE public.order_reference_sequences
  SET last_value = last_value + 1,
      updated_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND prefix = v_prefix
  RETURNING last_value INTO v_next;

  IF v_next IS NULL THEN
    RAISE EXCEPTION 'Failed to allocate reference for % / %', p_organization_id, v_prefix;
  END IF;

  RETURN v_prefix || '-' || lpad(v_next::text, v_pad, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.allocate_document_reference(uuid, text, int) FROM PUBLIC, anon, authenticated;
-- Callable only via SECURITY DEFINER helpers (next_online_order_invoice) or service_role.
GRANT EXECUTE ON FUNCTION public.allocate_document_reference(uuid, text, int) TO service_role;

--------------------------------------------------------------------------------
-- Seed MOD sequences: start after max(WEB, MOD) numeric suffix per org
--------------------------------------------------------------------------------
INSERT INTO public.order_reference_sequences (organization_id, prefix, last_value)
SELECT
  o.id,
  'MOD',
  coalesce(
    (
      SELECT max(
        NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
      )
      FROM public.sales s
      WHERE s.organization_id = o.id
        AND s.deleted_at IS NULL
        AND (s.invoice_no ILIKE 'WEB-%' OR s.invoice_no ILIKE 'MOD-%')
    ),
    0
  )
FROM public.organizations o
WHERE o.deleted_at IS NULL
ON CONFLICT (organization_id, prefix) DO UPDATE
SET last_value = greatest(
  public.order_reference_sequences.last_value,
  EXCLUDED.last_value
);

--------------------------------------------------------------------------------
-- next_online_order_invoice
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.next_online_order_invoice(p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;
  RETURN public.allocate_document_reference(p_organization_id, 'MOD', 4);
END;
$$;

-- Invoked by place_online_order / create_staff_online_order (SECURITY DEFINER owners).
-- Direct client calls allowed for authenticated staff; anon uses place_online_order only.
REVOKE ALL ON FUNCTION public.next_online_order_invoice(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_online_order_invoice(uuid) TO authenticated, service_role;

--------------------------------------------------------------------------------
-- Ensure unique active invoice_no per org (may already exist)
--------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS sales_org_invoice_no_active_uidx
  ON public.sales (organization_id, invoice_no)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Patch place_online_order + create_staff_online_order invoice generation
--------------------------------------------------------------------------------
DO $patch$
DECLARE
  d text;
  old_place text := $old$
  PERFORM pg_advisory_xact_lock(hashtext(v_org.id::text || ':web_invoice'));

  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org.id
    AND s.deleted_at IS NULL
    AND s.invoice_no ILIKE 'WEB-%';

  v_invoice_no := 'WEB-' || lpad(v_seq::text, 6, '0');
$old$;
  new_place text := $new$
  v_invoice_no := public.next_online_order_invoice(v_org.id);
$new$;
  old_staff text := $old2$
  PERFORM pg_advisory_xact_lock(hashtext(v_org_id::text || ':web_invoice'));
  SELECT coalesce(max(
    NULLIF(regexp_replace(s.invoice_no, '[^0-9]', '', 'g'), '')::bigint
  ), 0) + 1 INTO v_seq
  FROM public.sales s
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.invoice_no ILIKE 'WEB-%';
  v_invoice_no := 'WEB-' || lpad(v_seq::text, 6, '0');
$old2$;
  new_staff text := $new2$
  v_invoice_no := public.next_online_order_invoice(v_org_id);
$new2$;
BEGIN
  d := pg_get_functiondef('public.place_online_order(jsonb)'::regprocedure);
  IF position(old_place in d) = 0 THEN
    RAISE EXCEPTION 'place_online_order WEB invoice block not found';
  END IF;
  d := replace(d, old_place, new_place);
  EXECUTE d;

  d := pg_get_functiondef('public.create_staff_online_order(jsonb)'::regprocedure);
  IF position(old_staff in d) = 0 THEN
    RAISE EXCEPTION 'create_staff_online_order WEB invoice block not found';
  END IF;
  d := replace(d, old_staff, new_staff);
  EXECUTE d;
END;
$patch$;

--------------------------------------------------------------------------------
-- track_online_order: accept MOD-% and WEB-% invoice prefixes
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

  IF upper(v_q) LIKE 'WEB-%' OR upper(v_q) LIKE 'MOD-%' THEN
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
      WHERE coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
        AND s.deleted_at IS NULL
        AND s.invoice_no ILIKE v_q || '%'
      ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
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
    WHERE coalesce(s.channel, '') IN ('ecommerce', 'online', 'moderator')
      AND s.deleted_at IS NULL
      AND c.deleted_at IS NULL
      AND c.phone ILIKE '%' || v_q || '%'
    ORDER BY s.completed_at DESC NULLS LAST, s.created_at DESC
    LIMIT 20
  ) t;

  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.track_online_order(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_online_order(text) TO anon, authenticated, service_role;
