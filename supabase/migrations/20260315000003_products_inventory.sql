-- Glamourous by Mahi · Retail ERP
-- Migration 003: Products, variants, images, inventory & stock movements

--------------------------------------------------------------------------------
-- categories
--------------------------------------------------------------------------------
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  code text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX categories_org_name_active_uidx
  ON public.categories (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX categories_org_code_active_uidx
  ON public.categories (organization_id, code)
  WHERE deleted_at IS NULL AND code IS NOT NULL;

CREATE INDEX categories_organization_id_idx ON public.categories (organization_id);

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- subcategories
--------------------------------------------------------------------------------
CREATE TABLE public.subcategories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  category_id uuid NOT NULL REFERENCES public.categories (id),
  name text NOT NULL,
  code text,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX subcategories_category_name_active_uidx
  ON public.subcategories (category_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX subcategories_organization_id_idx ON public.subcategories (organization_id);
CREATE INDEX subcategories_category_id_idx ON public.subcategories (category_id);

CREATE TRIGGER subcategories_set_updated_at
  BEFORE UPDATE ON public.subcategories
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- brands
--------------------------------------------------------------------------------
CREATE TABLE public.brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  code text,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX brands_org_name_active_uidx
  ON public.brands (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX brands_organization_id_idx ON public.brands (organization_id);

CREATE TRIGGER brands_set_updated_at
  BEFORE UPDATE ON public.brands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- products
--------------------------------------------------------------------------------
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  category_id uuid REFERENCES public.categories (id),
  subcategory_id uuid REFERENCES public.subcategories (id),
  brand_id uuid REFERENCES public.brands (id),
  name text NOT NULL,
  description text,
  product_type text NOT NULL DEFAULT 'simple'
    CHECK (product_type IN ('simple', 'variable', 'bundle', 'service')),
  unit text NOT NULL DEFAULT 'pcs',
  base_sku text,
  base_barcode text,
  purchase_price numeric(14, 2) NOT NULL DEFAULT 0,
  selling_price numeric(14, 2) NOT NULL DEFAULT 0,
  wholesale_price numeric(14, 2),
  reorder_level numeric(14, 3) NOT NULL DEFAULT 0,
  tax_rate numeric(7, 4) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  track_inventory boolean NOT NULL DEFAULT true,
  has_variants boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT products_prices_non_negative CHECK (
    purchase_price >= 0
    AND selling_price >= 0
    AND (wholesale_price IS NULL OR wholesale_price >= 0)
  ),
  CONSTRAINT products_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100),
  CONSTRAINT products_reorder_non_negative CHECK (reorder_level >= 0)
);

CREATE UNIQUE INDEX products_org_base_sku_active_uidx
  ON public.products (organization_id, base_sku)
  WHERE deleted_at IS NULL AND base_sku IS NOT NULL;

CREATE UNIQUE INDEX products_org_base_barcode_active_uidx
  ON public.products (organization_id, base_barcode)
  WHERE deleted_at IS NULL AND base_barcode IS NOT NULL;

CREATE INDEX products_organization_id_idx ON public.products (organization_id);
CREATE INDEX products_category_id_idx ON public.products (category_id);
CREATE INDEX products_subcategory_id_idx ON public.products (subcategory_id);
CREATE INDEX products_brand_id_idx ON public.products (brand_id);
CREATE INDEX products_org_name_trgm_prep_idx
  ON public.products (organization_id, lower(name))
  WHERE deleted_at IS NULL;
CREATE INDEX products_org_active_idx
  ON public.products (organization_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER products_set_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- product_options / product_option_values
--------------------------------------------------------------------------------
CREATE TABLE public.product_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX product_options_product_name_active_uidx
  ON public.product_options (product_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX product_options_organization_id_idx ON public.product_options (organization_id);
CREATE INDEX product_options_product_id_idx ON public.product_options (product_id);

CREATE TRIGGER product_options_set_updated_at
  BEFORE UPDATE ON public.product_options
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.product_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  option_id uuid NOT NULL REFERENCES public.product_options (id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX product_option_values_option_value_active_uidx
  ON public.product_option_values (option_id, lower(value))
  WHERE deleted_at IS NULL;

CREATE INDEX product_option_values_organization_id_idx ON public.product_option_values (organization_id);
CREATE INDEX product_option_values_option_id_idx ON public.product_option_values (option_id);

CREATE TRIGGER product_option_values_set_updated_at
  BEFORE UPDATE ON public.product_option_values
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- product_variants
--------------------------------------------------------------------------------
CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  sku text NOT NULL,
  barcode text,
  name text,
  purchase_price numeric(14, 2) NOT NULL DEFAULT 0,
  selling_price numeric(14, 2) NOT NULL DEFAULT 0,
  wholesale_price numeric(14, 2),
  image_path text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT product_variants_prices_non_negative CHECK (
    purchase_price >= 0
    AND selling_price >= 0
    AND (wholesale_price IS NULL OR wholesale_price >= 0)
  )
);

CREATE UNIQUE INDEX product_variants_org_sku_active_uidx
  ON public.product_variants (organization_id, sku)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX product_variants_org_barcode_active_uidx
  ON public.product_variants (organization_id, barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

CREATE INDEX product_variants_organization_id_idx ON public.product_variants (organization_id);
CREATE INDEX product_variants_product_id_idx ON public.product_variants (product_id);
CREATE INDEX product_variants_org_active_idx
  ON public.product_variants (organization_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER product_variants_set_updated_at
  BEFORE UPDATE ON public.product_variants
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- variant_option_values
--------------------------------------------------------------------------------
CREATE TABLE public.variant_option_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.product_options (id),
  option_value_id uuid NOT NULL REFERENCES public.product_option_values (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX variant_option_values_variant_option_active_uidx
  ON public.variant_option_values (variant_id, option_id)
  WHERE deleted_at IS NULL;

CREATE INDEX variant_option_values_organization_id_idx ON public.variant_option_values (organization_id);
CREATE INDEX variant_option_values_variant_id_idx ON public.variant_option_values (variant_id);

CREATE TRIGGER variant_option_values_set_updated_at
  BEFORE UPDATE ON public.variant_option_values
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- product_images
--------------------------------------------------------------------------------
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  product_id uuid NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  is_cover boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

-- One cover image per product (active)
CREATE UNIQUE INDEX product_images_product_cover_active_uidx
  ON public.product_images (product_id)
  WHERE deleted_at IS NULL AND is_cover = true AND variant_id IS NULL;

CREATE INDEX product_images_organization_id_idx ON public.product_images (organization_id);
CREATE INDEX product_images_product_id_idx ON public.product_images (product_id);
CREATE INDEX product_images_variant_id_idx ON public.product_images (variant_id);

CREATE TRIGGER product_images_set_updated_at
  BEFORE UPDATE ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- stock_locations
--------------------------------------------------------------------------------
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  name text NOT NULL,
  location_type text NOT NULL
    CHECK (location_type IN ('saleable', 'damaged', 'quarantine')),
  is_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX stock_locations_branch_name_active_uidx
  ON public.stock_locations (branch_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX stock_locations_branch_type_default_active_uidx
  ON public.stock_locations (branch_id, location_type)
  WHERE deleted_at IS NULL AND is_default = true;

CREATE INDEX stock_locations_organization_id_idx ON public.stock_locations (organization_id);
CREATE INDEX stock_locations_branch_id_idx ON public.stock_locations (branch_id);

CREATE TRIGGER stock_locations_set_updated_at
  BEFORE UPDATE ON public.stock_locations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- inventory_balances
--------------------------------------------------------------------------------
CREATE TABLE public.inventory_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  quantity numeric(14, 3) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT inventory_balances_qty_check CHECK (quantity >= 0)
);

CREATE UNIQUE INDEX inventory_balances_variant_location_active_uidx
  ON public.inventory_balances (variant_id, location_id)
  WHERE deleted_at IS NULL;

CREATE INDEX inventory_balances_organization_id_idx ON public.inventory_balances (organization_id);
CREATE INDEX inventory_balances_location_id_idx ON public.inventory_balances (location_id);
CREATE INDEX inventory_balances_variant_id_idx ON public.inventory_balances (variant_id);

CREATE TRIGGER inventory_balances_set_updated_at
  BEFORE UPDATE ON public.inventory_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- stock_ledger (immutable movement history; soft-delete rare / admin only)
--------------------------------------------------------------------------------
CREATE TABLE public.stock_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  quantity_delta numeric(14, 3) NOT NULL,
  quantity_before numeric(14, 3) NOT NULL,
  quantity_after numeric(14, 3) NOT NULL,
  unit_cost numeric(14, 2),
  movement_type text NOT NULL
    CHECK (movement_type IN (
      'opening',
      'purchase',
      'purchase_return',
      'sale',
      'sale_return',
      'adjustment',
      'transfer_out',
      'transfer_in',
      'damage',
      'quarantine',
      'correction'
    )),
  reference_type text,
  reference_id uuid,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT stock_ledger_qty_reconcile CHECK (quantity_before + quantity_delta = quantity_after)
);

CREATE INDEX stock_ledger_organization_id_idx ON public.stock_ledger (organization_id);
CREATE INDEX stock_ledger_branch_id_idx ON public.stock_ledger (branch_id);
CREATE INDEX stock_ledger_variant_id_idx ON public.stock_ledger (variant_id);
CREATE INDEX stock_ledger_location_id_idx ON public.stock_ledger (location_id);
CREATE INDEX stock_ledger_reference_idx ON public.stock_ledger (reference_type, reference_id);
CREATE INDEX stock_ledger_occurred_at_idx ON public.stock_ledger (organization_id, occurred_at DESC);

CREATE TRIGGER stock_ledger_set_updated_at
  BEFORE UPDATE ON public.stock_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- stock_adjustments + items
--------------------------------------------------------------------------------
CREATE TABLE public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  adjustment_no text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'posted', 'cancelled')),
  reason text,
  notes text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX stock_adjustments_org_no_active_uidx
  ON public.stock_adjustments (organization_id, adjustment_no)
  WHERE deleted_at IS NULL;

CREATE INDEX stock_adjustments_organization_id_idx ON public.stock_adjustments (organization_id);
CREATE INDEX stock_adjustments_branch_id_idx ON public.stock_adjustments (branch_id);
CREATE INDEX stock_adjustments_status_idx
  ON public.stock_adjustments (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER stock_adjustments_set_updated_at
  BEFORE UPDATE ON public.stock_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_adjustment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  adjustment_id uuid NOT NULL REFERENCES public.stock_adjustments (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  quantity_before numeric(14, 3) NOT NULL DEFAULT 0,
  quantity_counted numeric(14, 3) NOT NULL,
  quantity_delta numeric(14, 3) NOT NULL,
  unit_cost numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT stock_adjustment_items_delta_check
    CHECK (quantity_counted - quantity_before = quantity_delta)
);

CREATE UNIQUE INDEX stock_adjustment_items_adj_variant_active_uidx
  ON public.stock_adjustment_items (adjustment_id, variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX stock_adjustment_items_organization_id_idx ON public.stock_adjustment_items (organization_id);
CREATE INDEX stock_adjustment_items_adjustment_id_idx ON public.stock_adjustment_items (adjustment_id);

CREATE TRIGGER stock_adjustment_items_set_updated_at
  BEFORE UPDATE ON public.stock_adjustment_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- stock_transfers + items
--------------------------------------------------------------------------------
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  transfer_no text NOT NULL,
  from_branch_id uuid NOT NULL REFERENCES public.branches (id),
  to_branch_id uuid NOT NULL REFERENCES public.branches (id),
  from_location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  to_location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'in_transit', 'received', 'cancelled')),
  notes text,
  shipped_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT stock_transfers_branches_differ CHECK (from_branch_id <> to_branch_id)
);

CREATE UNIQUE INDEX stock_transfers_org_no_active_uidx
  ON public.stock_transfers (organization_id, transfer_no)
  WHERE deleted_at IS NULL;

CREATE INDEX stock_transfers_organization_id_idx ON public.stock_transfers (organization_id);
CREATE INDEX stock_transfers_from_branch_id_idx ON public.stock_transfers (from_branch_id);
CREATE INDEX stock_transfers_to_branch_id_idx ON public.stock_transfers (to_branch_id);
CREATE INDEX stock_transfers_status_idx
  ON public.stock_transfers (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER stock_transfers_set_updated_at
  BEFORE UPDATE ON public.stock_transfers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.stock_transfer_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  transfer_id uuid NOT NULL REFERENCES public.stock_transfers (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  quantity_sent numeric(14, 3) NOT NULL,
  quantity_received numeric(14, 3),
  unit_cost numeric(14, 2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT stock_transfer_items_qty_sent_positive CHECK (quantity_sent > 0),
  CONSTRAINT stock_transfer_items_qty_received_non_negative
    CHECK (quantity_received IS NULL OR quantity_received >= 0)
);

CREATE UNIQUE INDEX stock_transfer_items_transfer_variant_active_uidx
  ON public.stock_transfer_items (transfer_id, variant_id)
  WHERE deleted_at IS NULL;

CREATE INDEX stock_transfer_items_organization_id_idx ON public.stock_transfer_items (organization_id);
CREATE INDEX stock_transfer_items_transfer_id_idx ON public.stock_transfer_items (transfer_id);

CREATE TRIGGER stock_transfer_items_set_updated_at
  BEFORE UPDATE ON public.stock_transfer_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- RLS helpers (local macro via repeated WITH CHECK / USING patterns)
--------------------------------------------------------------------------------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variant_option_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_adjustment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfer_items ENABLE ROW LEVEL SECURITY;

-- categories
CREATE POLICY categories_select ON public.categories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('products.read')
  );

CREATE POLICY categories_insert ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY categories_update ON public.categories
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- subcategories
CREATE POLICY subcategories_select ON public.subcategories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('products.read')
  );

CREATE POLICY subcategories_insert ON public.subcategories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY subcategories_update ON public.subcategories
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- brands
CREATE POLICY brands_select ON public.brands
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('products.read')
  );

CREATE POLICY brands_insert ON public.brands
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY brands_update ON public.brands
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- products
CREATE POLICY products_select ON public.products
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- product_images
CREATE POLICY product_images_select ON public.product_images
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY product_images_insert ON public.product_images
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.create')
      OR public.user_has_permission('products.update')
    )
  );

CREATE POLICY product_images_update ON public.product_images
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- product_options
CREATE POLICY product_options_select ON public.product_options
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY product_options_insert ON public.product_options
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY product_options_update ON public.product_options
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- product_option_values
CREATE POLICY product_option_values_select ON public.product_option_values
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY product_option_values_insert ON public.product_option_values
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY product_option_values_update ON public.product_option_values
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- product_variants
CREATE POLICY product_variants_select ON public.product_variants
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('inventory.read')
    )
  );

CREATE POLICY product_variants_insert ON public.product_variants
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY product_variants_update ON public.product_variants
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- variant_option_values
CREATE POLICY variant_option_values_select ON public.variant_option_values
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('products.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY variant_option_values_insert ON public.variant_option_values
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.create')
  );

CREATE POLICY variant_option_values_update ON public.variant_option_values
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('products.update')
  );

-- stock_locations
CREATE POLICY stock_locations_select ON public.stock_locations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_locations_insert ON public.stock_locations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_locations_update ON public.stock_locations
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- inventory_balances
CREATE POLICY inventory_balances_select ON public.inventory_balances
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.read')
      OR public.user_has_permission('pos.create')
    )
    AND EXISTS (
      SELECT 1
      FROM public.stock_locations sl
      WHERE sl.id = inventory_balances.location_id
        AND sl.deleted_at IS NULL
        AND public.user_has_branch_access(sl.branch_id)
    )
  );

CREATE POLICY inventory_balances_insert ON public.inventory_balances
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('inventory.transfer')
    )
  );

CREATE POLICY inventory_balances_update ON public.inventory_balances
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('inventory.transfer')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('inventory.transfer')
    )
  );

-- stock_ledger (append via RPC preferred; insert allowed for inventory operators)
CREATE POLICY stock_ledger_select ON public.stock_ledger
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_ledger_insert ON public.stock_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('inventory.adjust')
      OR public.user_has_permission('inventory.transfer')
      OR public.user_has_permission('pos.create')
    )
  );

-- No UPDATE/DELETE policies for ledger → immutable for client roles

-- stock_adjustments
CREATE POLICY stock_adjustments_select ON public.stock_adjustments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_adjustments_insert ON public.stock_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_adjustments_update ON public.stock_adjustments
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
    AND public.user_has_branch_access(branch_id)
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
    AND public.user_has_branch_access(branch_id)
  );

CREATE POLICY stock_adjustment_items_select ON public.stock_adjustment_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
  );

CREATE POLICY stock_adjustment_items_insert ON public.stock_adjustment_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
  );

CREATE POLICY stock_adjustment_items_update ON public.stock_adjustment_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.adjust')
  );

-- stock_transfers (access if user has either from or to branch)
CREATE POLICY stock_transfers_select ON public.stock_transfers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
    AND (
      public.user_has_branch_access(from_branch_id)
      OR public.user_has_branch_access(to_branch_id)
    )
  );

CREATE POLICY stock_transfers_insert ON public.stock_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
    AND public.user_has_branch_access(from_branch_id)
  );

CREATE POLICY stock_transfers_update ON public.stock_transfers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
    AND (
      public.user_has_branch_access(from_branch_id)
      OR public.user_has_branch_access(to_branch_id)
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
  );

CREATE POLICY stock_transfer_items_select ON public.stock_transfer_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.read')
  );

CREATE POLICY stock_transfer_items_insert ON public.stock_transfer_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
  );

CREATE POLICY stock_transfer_items_update ON public.stock_transfer_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('inventory.transfer')
  );
