-- Unified transaction core: additive schema foundations
-- payment allocations, reservations, opening documents, reconciliation, ecommerce fields

--------------------------------------------------------------------------------
-- Inventory: reserved quantity for online checkout
--------------------------------------------------------------------------------
ALTER TABLE public.inventory_balances
  ADD COLUMN IF NOT EXISTS qty_reserved numeric(14, 3) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_balances_qty_reserved_check'
  ) THEN
    ALTER TABLE public.inventory_balances
      ADD CONSTRAINT inventory_balances_qty_reserved_check
      CHECK (qty_reserved >= 0);
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Financial transactions: idempotency key
--------------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
  ADD COLUMN IF NOT EXISTS client_txn_key text,
  ADD COLUMN IF NOT EXISTS reversed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.financial_transactions (id),
  ADD COLUMN IF NOT EXISTS source_number text;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_org_client_txn_key_uidx
  ON public.financial_transactions (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS financial_transactions_org_source_posted_uidx
  ON public.financial_transactions (
    organization_id, source_type, source_id, account_id, direction, amount
  )
  WHERE deleted_at IS NULL
    AND coalesce(status, 'posted') = 'posted'
    AND source_id IS NOT NULL
    AND voided_at IS NULL;

--------------------------------------------------------------------------------
-- Sales: ecommerce / fulfilment metadata
--------------------------------------------------------------------------------
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS fulfilment_status text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_district text,
  ADD COLUMN IF NOT EXISTS delivery_area text,
  ADD COLUMN IF NOT EXISTS reservation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS fulfilled_sale_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS coupon_code text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sales_fulfilment_status_check'
  ) THEN
    ALTER TABLE public.sales
      ADD CONSTRAINT sales_fulfilment_status_check
      CHECK (
        fulfilment_status IS NULL
        OR fulfilment_status IN (
          'new', 'confirmed', 'packed', 'shipped', 'delivered', 'cancelled'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS sales_org_channel_status_idx
  ON public.sales (organization_id, channel, status)
  WHERE deleted_at IS NULL;

--------------------------------------------------------------------------------
-- Sale returns: durable idempotency (replace reason-hack)
--------------------------------------------------------------------------------
ALTER TABLE public.sale_returns
  ADD COLUMN IF NOT EXISTS client_txn_key text;

CREATE UNIQUE INDEX IF NOT EXISTS sale_returns_org_client_txn_key_uidx
  ON public.sale_returns (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

--------------------------------------------------------------------------------
-- Purchase returns: durable idempotency
--------------------------------------------------------------------------------
ALTER TABLE public.purchase_returns
  ADD COLUMN IF NOT EXISTS client_txn_key text;

CREATE UNIQUE INDEX IF NOT EXISTS purchase_returns_org_client_txn_key_uidx
  ON public.purchase_returns (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

--------------------------------------------------------------------------------
-- Payment allocations (invoice-level application of collections/payments)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  party_type text NOT NULL CHECK (party_type IN ('customer', 'supplier')),
  party_id uuid NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  source_type text NOT NULL,
  source_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('sale', 'purchase')),
  document_id uuid NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  client_txn_key text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_allocations_org_client_txn_key_uidx
  ON public.payment_allocations (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_allocations_document_idx
  ON public.payment_allocations (document_type, document_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_allocations_party_idx
  ON public.payment_allocations (organization_id, party_type, party_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS payment_allocations_source_idx
  ON public.payment_allocations (source_type, source_id)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS payment_allocations_set_updated_at ON public.payment_allocations;
CREATE TRIGGER payment_allocations_set_updated_at
  BEFORE UPDATE ON public.payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_allocations_select ON public.payment_allocations;
CREATE POLICY payment_allocations_select ON public.payment_allocations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('sales.read')
      OR public.user_has_permission('purchases.read')
      OR public.user_has_permission('customer_due.collect')
      OR public.user_has_permission('supplier_due.pay')
      OR public.user_has_permission('reconciliation.read')
    )
  );

DROP POLICY IF EXISTS payment_allocations_insert ON public.payment_allocations;
CREATE POLICY payment_allocations_insert ON public.payment_allocations
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.post')
      OR public.user_has_permission('customer_due.collect')
      OR public.user_has_permission('supplier_due.pay')
      OR public.user_has_permission('purchases.pay')
      OR public.user_has_permission('reconciliation.apply')
    )
  );

--------------------------------------------------------------------------------
-- Inventory reservations (online checkout)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id),
  sale_item_id uuid REFERENCES public.sale_items (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  location_id uuid NOT NULL REFERENCES public.stock_locations (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'released', 'consumed', 'expired')),
  expires_at timestamptz,
  client_txn_key text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_reservations_org_client_txn_key_uidx
  ON public.inventory_reservations (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS inventory_reservations_sale_idx
  ON public.inventory_reservations (sale_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS inventory_reservations_active_variant_idx
  ON public.inventory_reservations (organization_id, variant_id, location_id)
  WHERE deleted_at IS NULL AND status = 'active';

DROP TRIGGER IF EXISTS inventory_reservations_set_updated_at ON public.inventory_reservations;
CREATE TRIGGER inventory_reservations_set_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inventory_reservations_select ON public.inventory_reservations;
CREATE POLICY inventory_reservations_select ON public.inventory_reservations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('inventory.read')
      OR public.user_has_permission('orders.read')
      OR public.user_has_permission('sales.read')
      OR public.user_has_permission('reconciliation.read')
    )
  );

--------------------------------------------------------------------------------
-- Opening balance documents (explicit AR/AP openings — no invented invoices)
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.opening_balance_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  document_type text NOT NULL CHECK (
    document_type IN (
      'customer_opening_balance',
      'supplier_opening_balance',
      'stock_opening_reconciliation'
    )
  ),
  party_id uuid,
  variant_id uuid,
  location_id uuid,
  amount numeric(14, 2),
  quantity numeric(14, 3),
  document_no text NOT NULL,
  source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_txn_key text NOT NULL,
  journal_entry_id uuid REFERENCES public.journal_entries (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS opening_balance_documents_org_client_txn_key_uidx
  ON public.opening_balance_documents (organization_id, client_txn_key)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opening_balance_documents_org_no_uidx
  ON public.opening_balance_documents (organization_id, document_no)
  WHERE deleted_at IS NULL;

ALTER TABLE public.opening_balance_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opening_balance_documents_select ON public.opening_balance_documents;
CREATE POLICY opening_balance_documents_select ON public.opening_balance_documents
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('reconciliation.read')
      OR public.user_has_permission('accounts.manage')
    )
  );

--------------------------------------------------------------------------------
-- Reconciliation batches / results
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconciliation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  batch_type text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('dry_run', 'apply')),
  status text NOT NULL DEFAULT 'completed'
    CHECK (status IN ('running', 'completed', 'failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.reconciliation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  batch_id uuid NOT NULL REFERENCES public.reconciliation_batches (id) ON DELETE CASCADE,
  check_key text NOT NULL,
  entity_type text,
  entity_id uuid,
  before_value jsonb,
  after_value jsonb,
  difference jsonb,
  message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS reconciliation_results_batch_idx
  ON public.reconciliation_results (batch_id);

ALTER TABLE public.reconciliation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliation_batches_select ON public.reconciliation_batches;
CREATE POLICY reconciliation_batches_select ON public.reconciliation_batches
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('reconciliation.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('audit.read')
    )
  );

DROP POLICY IF EXISTS reconciliation_results_select ON public.reconciliation_results;
CREATE POLICY reconciliation_results_select ON public.reconciliation_results
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('reconciliation.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('audit.read')
    )
  );

--------------------------------------------------------------------------------
-- Opening Balance Equity CoA role (if missing)
--------------------------------------------------------------------------------
ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_system_role_check;

ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_system_role_check
  CHECK (
    system_role IS NULL
    OR system_role = ANY (ARRAY[
      'cash', 'bank', 'mobile_money', 'receivable', 'payable',
      'inventory_asset', 'cogs', 'sales_revenue', 'sales_return',
      'purchase', 'tax_payable', 'tax_receivable', 'refund_payable',
      'opening_balance_equity'
    ])
  );

INSERT INTO public.chart_of_accounts (
  organization_id, code, name, account_type, system_role, is_postable, is_active
)
SELECT o.id, '3900', 'Opening Balance Equity', 'equity', 'opening_balance_equity', true, true
FROM public.organizations o
WHERE o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts c
    WHERE c.organization_id = o.id
      AND c.system_role = 'opening_balance_equity'
      AND c.deleted_at IS NULL
  );
