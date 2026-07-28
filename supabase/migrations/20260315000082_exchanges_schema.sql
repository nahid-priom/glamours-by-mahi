-- Migration 082: Product exchanges schema (Phase D)

--------------------------------------------------------------------------------
-- exchanges
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchanges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id),
  exchange_no text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'cancelled')),
  difference_amount numeric(14, 2) NOT NULL DEFAULT 0,
  payment_account_id uuid REFERENCES public.financial_accounts (id),
  refund_account_id uuid REFERENCES public.financial_accounts (id),
  client_txn_key text,
  note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS exchanges_org_exchange_no_active_uidx
  ON public.exchanges (organization_id, exchange_no)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS exchanges_org_client_txn_key_active_uidx
  ON public.exchanges (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS exchanges_organization_id_idx
  ON public.exchanges (organization_id);

CREATE INDEX IF NOT EXISTS exchanges_branch_id_idx
  ON public.exchanges (branch_id);

CREATE INDEX IF NOT EXISTS exchanges_sale_id_idx
  ON public.exchanges (sale_id);

CREATE INDEX IF NOT EXISTS exchanges_status_idx
  ON public.exchanges (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS exchanges_created_at_idx
  ON public.exchanges (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS exchanges_set_updated_at ON public.exchanges;
CREATE TRIGGER exchanges_set_updated_at
  BEFORE UPDATE ON public.exchanges
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- exchange_items
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.exchange_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  exchange_id uuid NOT NULL REFERENCES public.exchanges (id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('return', 'replacement')),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  condition text
    CHECK (
      condition IS NULL
      OR condition IN ('sellable', 'damaged', 'defective', 'quarantine')
    ),
  original_sale_item_id uuid REFERENCES public.sale_items (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX IF NOT EXISTS exchange_items_organization_id_idx
  ON public.exchange_items (organization_id);

CREATE INDEX IF NOT EXISTS exchange_items_exchange_id_idx
  ON public.exchange_items (exchange_id);

CREATE INDEX IF NOT EXISTS exchange_items_variant_id_idx
  ON public.exchange_items (variant_id);

CREATE INDEX IF NOT EXISTS exchange_items_sale_item_idx
  ON public.exchange_items (original_sale_item_id)
  WHERE original_sale_item_id IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS exchange_items_direction_idx
  ON public.exchange_items (exchange_id, direction)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS exchange_items_set_updated_at ON public.exchange_items;
CREATE TRIGGER exchange_items_set_updated_at
  BEFORE UPDATE ON public.exchange_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.exchanges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exchanges_select ON public.exchanges;
CREATE POLICY exchanges_select ON public.exchanges
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('exchange.read')
      OR public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  );

DROP POLICY IF EXISTS exchanges_insert ON public.exchanges;
CREATE POLICY exchanges_insert ON public.exchanges
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('exchange.create')
  );

DROP POLICY IF EXISTS exchanges_update ON public.exchanges;
CREATE POLICY exchanges_update ON public.exchanges
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  );

DROP POLICY IF EXISTS exchange_items_select ON public.exchange_items;
CREATE POLICY exchange_items_select ON public.exchange_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('exchange.read')
      OR public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  );

DROP POLICY IF EXISTS exchange_items_insert ON public.exchange_items;
CREATE POLICY exchange_items_insert ON public.exchange_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('exchange.create')
  );

DROP POLICY IF EXISTS exchange_items_update ON public.exchange_items;
CREATE POLICY exchange_items_update ON public.exchange_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('exchange.create')
      OR public.user_has_permission('exchange.cancel')
    )
  );
