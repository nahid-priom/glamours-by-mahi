-- Migration 079: Online order attribution + order_source

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS order_source text,
  ADD COLUMN IF NOT EXISTS moderator_id uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS tele_salesman_id uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_by uuid REFERENCES public.profiles (id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_order_source_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_order_source_check
      CHECK (
        order_source IS NULL
        OR order_source IN ('pos', 'ecommerce', 'moderator', 'tele_sales', 'manual', 'other')
      );
  END IF;
END $$;

-- Expand fulfilment_status to include pending_approval / approved
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_fulfilment_status_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_fulfilment_status_check
  CHECK (
    fulfilment_status IS NULL
    OR fulfilment_status IN (
      'new',
      'pending_approval',
      'approved',
      'confirmed',
      'packed',
      'shipped',
      'delivered',
      'cancelled'
    )
  );

UPDATE public.sales
SET order_source = CASE
  WHEN lower(coalesce(channel, '')) IN ('ecommerce', 'online', 'website') THEN 'ecommerce'
  WHEN lower(coalesce(channel, '')) IN ('moderator', 'phone', 'facebook', 'whatsapp') THEN 'moderator'
  WHEN lower(coalesce(channel, '')) IN ('pos', 'retail', 'shop') THEN 'pos'
  WHEN channel IS NOT NULL THEN 'other'
  ELSE NULL
END
WHERE order_source IS NULL;

CREATE INDEX IF NOT EXISTS sales_org_order_source_idx
  ON public.sales (organization_id, order_source)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS sales_org_moderator_idx
  ON public.sales (organization_id, moderator_id)
  WHERE deleted_at IS NULL AND moderator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sales_org_tele_salesman_idx
  ON public.sales (organization_id, tele_salesman_id)
  WHERE deleted_at IS NULL AND tele_salesman_id IS NOT NULL;
