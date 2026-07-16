-- Product lifecycle, cosmetics, batches, branch prices, import jobs, permissions
-- Phase 2–4 schema foundation

--------------------------------------------------------------------------------
-- Permissions
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('products.submit', 'Submit products for approval'),
  ('products.approve', 'Approve products for sale'),
  ('products.reject', 'Reject products with reason'),
  ('products.archive', 'Archive products'),
  ('products.restore', 'Restore archived products'),
  ('products.import', 'Import products from Excel'),
  ('products.manage_prices', 'Manage branch-specific product prices')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = v.key AND p.deleted_at IS NULL
);

-- Grant new perms to Owner + Super Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Owner', 'Super Admin')
  AND r.deleted_at IS NULL
  AND p.key IN (
    'products.submit', 'products.approve', 'products.reject',
    'products.archive', 'products.restore', 'products.import', 'products.manage_prices'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- Product lifecycle + cosmetics fields
--------------------------------------------------------------------------------
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES public.profiles (id),
  ADD COLUMN IF NOT EXISTS batch_tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiry_tracking_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allocation_strategy text NOT NULL DEFAULT 'fefo',
  ADD COLUMN IF NOT EXISTS ingredients text,
  ADD COLUMN IF NOT EXISTS skin_type text,
  ADD COLUMN IF NOT EXISTS gender_target text,
  ADD COLUMN IF NOT EXISTS country_of_origin text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS importer text,
  ADD COLUMN IF NOT EXISTS regulatory_notes text,
  ADD COLUMN IF NOT EXISTS default_expiry_alert_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_status_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_status_check
      CHECK (status IN (
        'draft', 'pending_approval', 'approved', 'active',
        'inactive', 'rejected', 'archived'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_allocation_strategy_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_allocation_strategy_check
      CHECK (allocation_strategy IN ('fefo', 'fifo'));
  END IF;
END $$;

-- Backfill existing active published products
UPDATE public.products
SET status = 'active',
    approved_at = COALESCE(approved_at, created_at),
    published_at = COALESCE(published_at, created_at)
WHERE deleted_at IS NULL
  AND is_active = true
  AND status = 'draft';

UPDATE public.products
SET status = 'inactive'
WHERE deleted_at IS NULL
  AND is_active = false
  AND status = 'draft';

CREATE INDEX IF NOT EXISTS products_org_status_idx
  ON public.products (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_org_published_idx
  ON public.products (organization_id, published_at)
  WHERE deleted_at IS NULL AND published_at IS NOT NULL;

--------------------------------------------------------------------------------
-- Inventory batches (cosmetics / expiry tracking)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  location_id uuid REFERENCES public.stock_locations (id),
  product_id uuid NOT NULL REFERENCES public.products (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  batch_number text NOT NULL,
  manufactured_at date,
  expires_at date,
  received_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  purchase_item_id uuid,
  quantity_received numeric(14, 3) NOT NULL DEFAULT 0,
  quantity_available numeric(14, 3) NOT NULL DEFAULT 0,
  unit_cost numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'healthy',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT inventory_batches_qty_check CHECK (
    quantity_received >= 0 AND quantity_available >= 0
  ),
  CONSTRAINT inventory_batches_status_check CHECK (
    status IN ('healthy', 'expiring_soon', 'expired', 'depleted')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_batches_org_variant_batch_uidx
  ON public.inventory_batches (organization_id, variant_id, lower(batch_number))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_batches_expires_at_idx
  ON public.inventory_batches (organization_id, expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_batches_variant_id_idx
  ON public.inventory_batches (variant_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER inventory_batches_set_updated_at
  BEFORE UPDATE ON public.inventory_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY inventory_batches_select ON public.inventory_batches
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.read')
      OR public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY inventory_batches_insert ON public.inventory_batches
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('products.create')
      OR public.user_has_permission('purchases.create')
    )
  );

CREATE POLICY inventory_batches_update ON public.inventory_batches
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('products.update')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

-- Anon storefront: no batch detail needed for listing; skip anon policy

--------------------------------------------------------------------------------
-- Batch allocations on sale items (optional link)
--------------------------------------------------------------------------------
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS batch_id uuid REFERENCES public.inventory_batches (id);

CREATE TABLE IF NOT EXISTS public.sale_item_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES public.sale_items (id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES public.inventory_batches (id),
  quantity numeric(14, 3) NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS sale_item_batches_sale_id_idx ON public.sale_item_batches (sale_id);

ALTER TABLE public.sale_item_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY sale_item_batches_select ON public.sale_item_batches
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
    )
  );

--------------------------------------------------------------------------------
-- Branch product prices
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_product_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  product_id uuid NOT NULL REFERENCES public.products (id),
  variant_id uuid REFERENCES public.product_variants (id),
  retail_price numeric(14, 2),
  wholesale_price numeric(14, 2),
  discount_price numeric(14, 2),
  effective_from timestamptz NOT NULL DEFAULT timezone('utc', now()),
  effective_to timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT branch_product_prices_non_negative CHECK (
    (retail_price IS NULL OR retail_price >= 0)
    AND (wholesale_price IS NULL OR wholesale_price >= 0)
    AND (discount_price IS NULL OR discount_price >= 0)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS branch_product_prices_active_uidx
  ON public.branch_product_prices (
    branch_id,
    product_id,
    COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  WHERE deleted_at IS NULL AND is_active = true;

CREATE INDEX IF NOT EXISTS branch_product_prices_branch_idx
  ON public.branch_product_prices (branch_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER branch_product_prices_set_updated_at
  BEFORE UPDATE ON public.branch_product_prices
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.branch_product_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY branch_product_prices_select ON public.branch_product_prices
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('products.manage_prices')
    )
  );

CREATE POLICY branch_product_prices_insert ON public.branch_product_prices
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.manage_prices')
  );

CREATE POLICY branch_product_prices_update ON public.branch_product_prices
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.manage_prices')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.manage_prices')
  );

--------------------------------------------------------------------------------
-- Product import jobs
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  status text NOT NULL DEFAULT 'pending',
  mode text NOT NULL DEFAULT 'create_new',
  file_name text,
  total_rows integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  CONSTRAINT product_import_jobs_status_check CHECK (
    status IN ('pending', 'validating', 'importing', 'completed', 'failed', 'cancelled')
  ),
  CONSTRAINT product_import_jobs_mode_check CHECK (
    mode IN ('create_new', 'update_by_sku', 'update_by_barcode', 'create_or_update', 'skip_duplicates')
  )
);

CREATE TABLE IF NOT EXISTS public.product_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  job_id uuid NOT NULL REFERENCES public.product_import_jobs (id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  product_id uuid REFERENCES public.products (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT product_import_rows_status_check CHECK (
    status IN ('pending', 'valid', 'error', 'imported', 'skipped')
  )
);

CREATE INDEX IF NOT EXISTS product_import_rows_job_idx
  ON public.product_import_rows (job_id, status);

ALTER TABLE public.product_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY product_import_jobs_all ON public.product_import_jobs
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.import')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.import')
  );

CREATE POLICY product_import_rows_all ON public.product_import_rows
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.import')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.import')
  );

--------------------------------------------------------------------------------
-- Expiry alert notifications (uses existing notifications if present)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expiry_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  product_id uuid NOT NULL REFERENCES public.products (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  batch_id uuid NOT NULL REFERENCES public.inventory_batches (id),
  severity text NOT NULL DEFAULT 'warning',
  expires_at date NOT NULL,
  quantity_available numeric(14, 3) NOT NULL DEFAULT 0,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT expiry_alerts_severity_check CHECK (severity IN ('info', 'warning', 'critical'))
);

CREATE UNIQUE INDEX IF NOT EXISTS expiry_alerts_batch_day_uidx
  ON public.expiry_alerts (batch_id, expires_at, severity)
  WHERE is_read = false;

ALTER TABLE public.expiry_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY expiry_alerts_select ON public.expiry_alerts
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.read')
      OR public.user_has_permission('products.read')
      OR public.user_has_permission('dashboard.read')
    )
  );

CREATE POLICY expiry_alerts_update ON public.expiry_alerts
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_organization_id())
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- Effective price resolver
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_effective_price(
  p_org_id uuid,
  p_branch_id uuid,
  p_product_id uuid,
  p_variant_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price numeric(14, 2);
BEGIN
  -- 1. Active branch variant price
  SELECT COALESCE(bpp.discount_price, bpp.retail_price)
  INTO v_price
  FROM public.branch_product_prices bpp
  WHERE bpp.organization_id = p_org_id
    AND bpp.branch_id = p_branch_id
    AND bpp.product_id = p_product_id
    AND bpp.variant_id = p_variant_id
    AND bpp.is_active = true
    AND bpp.deleted_at IS NULL
    AND bpp.effective_from <= timezone('utc', now())
    AND (bpp.effective_to IS NULL OR bpp.effective_to > timezone('utc', now()))
  ORDER BY bpp.effective_from DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 2. Active branch product price
  SELECT COALESCE(bpp.discount_price, bpp.retail_price)
  INTO v_price
  FROM public.branch_product_prices bpp
  WHERE bpp.organization_id = p_org_id
    AND bpp.branch_id = p_branch_id
    AND bpp.product_id = p_product_id
    AND bpp.variant_id IS NULL
    AND bpp.is_active = true
    AND bpp.deleted_at IS NULL
    AND bpp.effective_from <= timezone('utc', now())
    AND (bpp.effective_to IS NULL OR bpp.effective_to > timezone('utc', now()))
  ORDER BY bpp.effective_from DESC
  LIMIT 1;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 3. Variant default
  SELECT pv.selling_price INTO v_price
  FROM public.product_variants pv
  WHERE pv.id = p_variant_id AND pv.deleted_at IS NULL;

  IF v_price IS NOT NULL THEN
    RETURN v_price;
  END IF;

  -- 4. Product default
  SELECT p.selling_price INTO v_price
  FROM public.products p
  WHERE p.id = p_product_id AND p.deleted_at IS NULL;

  RETURN COALESCE(v_price, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_effective_price(uuid, uuid, uuid, uuid) TO authenticated;

--------------------------------------------------------------------------------
-- Refresh batch status helper
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_batch_status(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch public.inventory_batches%ROWTYPE;
  v_alert_days integer;
  v_status text;
BEGIN
  SELECT * INTO v_batch FROM public.inventory_batches WHERE id = p_batch_id;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT COALESCE(p.default_expiry_alert_days, 30)
  INTO v_alert_days
  FROM public.products p
  WHERE p.id = v_batch.product_id;

  IF v_batch.quantity_available <= 0 THEN
    v_status := 'depleted';
  ELSIF v_batch.expires_at IS NOT NULL AND v_batch.expires_at < CURRENT_DATE THEN
    v_status := 'expired';
  ELSIF v_batch.expires_at IS NOT NULL
        AND v_batch.expires_at <= (CURRENT_DATE + (v_alert_days || ' days')::interval)::date THEN
    v_status := 'expiring_soon';
  ELSE
    v_status := 'healthy';
  END IF;

  UPDATE public.inventory_batches
  SET status = v_status, updated_at = timezone('utc', now())
  WHERE id = p_batch_id;
END;
$$;

--------------------------------------------------------------------------------
-- Generate expiry alerts (callable by cron / edge)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_expiry_alerts(p_org_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_count integer := 0;
  v_severity text;
  v_msg text;
BEGIN
  FOR r IN
    SELECT
      b.*,
      p.name AS product_name,
      p.default_expiry_alert_days,
      p.organization_id AS org_id
    FROM public.inventory_batches b
    JOIN public.products p ON p.id = b.product_id
    WHERE b.deleted_at IS NULL
      AND b.quantity_available > 0
      AND b.expires_at IS NOT NULL
      AND (p_org_id IS NULL OR b.organization_id = p_org_id)
      AND (
        b.expires_at < CURRENT_DATE
        OR b.expires_at <= (CURRENT_DATE + (COALESCE(p.default_expiry_alert_days, 30) || ' days')::interval)::date
      )
  LOOP
    PERFORM public.refresh_batch_status(r.id);

    IF r.expires_at < CURRENT_DATE THEN
      v_severity := 'critical';
      v_msg := format('%s batch %s expired on %s (%s left)',
        r.product_name, r.batch_number, r.expires_at, r.quantity_available);
    ELSE
      v_severity := 'warning';
      v_msg := format('%s batch %s expires on %s (%s left)',
        r.product_name, r.batch_number, r.expires_at, r.quantity_available);
    END IF;

    INSERT INTO public.expiry_alerts (
      organization_id, branch_id, product_id, variant_id, batch_id,
      severity, expires_at, quantity_available, message
    )
    VALUES (
      r.org_id, r.branch_id, r.product_id, r.variant_id, r.id,
      v_severity, r.expires_at, r.quantity_available, v_msg
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_expiry_alerts(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_expiry_alerts(uuid) TO service_role;

-- Storefront: only active + published products (tighten existing anon policy)
DROP POLICY IF EXISTS storefront_products_select ON public.products;
CREATE POLICY storefront_products_select ON public.products
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND is_active = true
    AND status = 'active'
    AND published_at IS NOT NULL
  );
