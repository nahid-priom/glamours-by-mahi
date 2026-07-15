-- Glamourous by Mahi · Retail ERP
-- Migration 004: Customers, suppliers, sales, purchases
-- Depends on: 001 helpers, 002 org/access, 003 products/inventory
-- Note: sale_payments.financial_account_id / purchase_payments.financial_account_id
--       are UUID columns; FKs added in 005 after financial_accounts exists.

--------------------------------------------------------------------------------
-- customers
--------------------------------------------------------------------------------
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  address text,
  district text,
  barcode text,
  preferred_channel text,
  current_due numeric(14, 2) NOT NULL DEFAULT 0,
  total_spent numeric(14, 2) NOT NULL DEFAULT 0,
  total_paid numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'blocked', 'archived')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT customers_due_non_negative CHECK (current_due >= 0)
);

CREATE UNIQUE INDEX customers_org_phone_active_uidx
  ON public.customers (organization_id, phone)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX customers_org_barcode_active_uidx
  ON public.customers (organization_id, barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

CREATE INDEX customers_organization_id_idx ON public.customers (organization_id);
CREATE INDEX customers_branch_id_idx ON public.customers (branch_id);
CREATE INDEX customers_org_created_at_idx ON public.customers (organization_id, created_at DESC);
CREATE INDEX customers_org_name_idx ON public.customers (organization_id, lower(name));

CREATE TRIGGER customers_set_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- customer_addresses
--------------------------------------------------------------------------------
CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Other'
    CHECK (label IN ('Home', 'Office', 'Other')),
  full_name text NOT NULL,
  phone text NOT NULL,
  district text,
  area text,
  address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX customer_addresses_organization_id_idx ON public.customer_addresses (organization_id);
CREATE INDEX customer_addresses_customer_id_idx ON public.customer_addresses (customer_id);

CREATE UNIQUE INDEX customer_addresses_one_default_uidx
  ON public.customer_addresses (customer_id)
  WHERE deleted_at IS NULL AND is_default = true;

CREATE TRIGGER customer_addresses_set_updated_at
  BEFORE UPDATE ON public.customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- customer_ledger
--------------------------------------------------------------------------------
CREATE TABLE public.customer_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  customer_id uuid NOT NULL REFERENCES public.customers (id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('sale_due', 'collection', 'return_credit', 'adjustment', 'opening')),
  debit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  balance_after numeric(14, 2) NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT customer_ledger_debit_xor_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

CREATE INDEX customer_ledger_organization_id_idx ON public.customer_ledger (organization_id);
CREATE INDEX customer_ledger_customer_id_idx ON public.customer_ledger (customer_id);
CREATE INDEX customer_ledger_branch_id_idx ON public.customer_ledger (branch_id);
CREATE INDEX customer_ledger_occurred_at_idx ON public.customer_ledger (organization_id, occurred_at DESC);
CREATE INDEX customer_ledger_reference_idx ON public.customer_ledger (reference_type, reference_id);

CREATE TRIGGER customer_ledger_set_updated_at
  BEFORE UPDATE ON public.customer_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- suppliers
--------------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  barcode text,
  current_due numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX suppliers_org_name_active_uidx
  ON public.suppliers (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX suppliers_org_barcode_active_uidx
  ON public.suppliers (organization_id, barcode)
  WHERE deleted_at IS NULL AND barcode IS NOT NULL;

CREATE INDEX suppliers_organization_id_idx ON public.suppliers (organization_id);
CREATE INDEX suppliers_branch_id_idx ON public.suppliers (branch_id);
CREATE INDEX suppliers_org_created_at_idx ON public.suppliers (organization_id, created_at DESC);

CREATE TRIGGER suppliers_set_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- supplier_addresses
--------------------------------------------------------------------------------
CREATE TABLE public.supplier_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Other',
  contact_name text,
  phone text,
  district text,
  area text,
  address text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX supplier_addresses_organization_id_idx ON public.supplier_addresses (organization_id);
CREATE INDEX supplier_addresses_supplier_id_idx ON public.supplier_addresses (supplier_id);

CREATE UNIQUE INDEX supplier_addresses_one_default_uidx
  ON public.supplier_addresses (supplier_id)
  WHERE deleted_at IS NULL AND is_default = true;

CREATE TRIGGER supplier_addresses_set_updated_at
  BEFORE UPDATE ON public.supplier_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- supplier_ledger
--------------------------------------------------------------------------------
CREATE TABLE public.supplier_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('purchase_due', 'payment', 'return_credit', 'adjustment', 'opening')),
  debit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  balance_after numeric(14, 2) NOT NULL,
  reference_type text,
  reference_id uuid,
  notes text,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT supplier_ledger_debit_xor_credit CHECK (
    (debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0) OR (debit = 0 AND credit = 0)
  )
);

CREATE INDEX supplier_ledger_organization_id_idx ON public.supplier_ledger (organization_id);
CREATE INDEX supplier_ledger_supplier_id_idx ON public.supplier_ledger (supplier_id);
CREATE INDEX supplier_ledger_branch_id_idx ON public.supplier_ledger (branch_id);
CREATE INDEX supplier_ledger_occurred_at_idx ON public.supplier_ledger (organization_id, occurred_at DESC);
CREATE INDEX supplier_ledger_reference_idx ON public.supplier_ledger (reference_type, reference_id);

CREATE TRIGGER supplier_ledger_set_updated_at
  BEFORE UPDATE ON public.supplier_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sales
--------------------------------------------------------------------------------
CREATE TABLE public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  invoice_no text NOT NULL,
  customer_id uuid REFERENCES public.customers (id),
  salesperson_id uuid REFERENCES public.profiles (id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'voided', 'corrected')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid', 'refunded')),
  channel text,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  shipping numeric(14, 2) NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  grand_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  paid_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  due_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (due_total >= 0),
  change_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  client_txn_key text,
  version int NOT NULL DEFAULT 1 CHECK (version >= 1),
  previous_sale_id uuid REFERENCES public.sales (id),
  corrected_from_id uuid REFERENCES public.sales (id),
  note text,
  completed_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX sales_org_invoice_no_active_uidx
  ON public.sales (organization_id, invoice_no)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX sales_org_client_txn_key_active_uidx
  ON public.sales (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX sales_organization_id_idx ON public.sales (organization_id);
CREATE INDEX sales_branch_id_idx ON public.sales (branch_id);
CREATE INDEX sales_customer_id_idx ON public.sales (customer_id);
CREATE INDEX sales_salesperson_id_idx ON public.sales (salesperson_id);
CREATE INDEX sales_org_created_at_idx ON public.sales (organization_id, created_at DESC);
CREATE INDEX sales_branch_created_at_idx ON public.sales (branch_id, created_at DESC);
CREATE INDEX sales_status_idx ON public.sales (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER sales_set_updated_at
  BEFORE UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_items
--------------------------------------------------------------------------------
CREATE TABLE public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  cost_price numeric(14, 2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX sale_items_organization_id_idx ON public.sale_items (organization_id);
CREATE INDEX sale_items_sale_id_idx ON public.sale_items (sale_id);
CREATE INDEX sale_items_variant_id_idx ON public.sale_items (variant_id);

CREATE TRIGGER sale_items_set_updated_at
  BEFORE UPDATE ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_versions (immutable snapshots)
--------------------------------------------------------------------------------
CREATE TABLE public.sale_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  version int NOT NULL CHECK (version >= 1),
  snapshot jsonb NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX sale_versions_sale_version_uidx
  ON public.sale_versions (sale_id, version)
  WHERE deleted_at IS NULL;

CREATE INDEX sale_versions_organization_id_idx ON public.sale_versions (organization_id);
CREATE INDEX sale_versions_sale_id_idx ON public.sale_versions (sale_id);

CREATE TRIGGER sale_versions_set_updated_at
  BEFORE UPDATE ON public.sale_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_payments (financial_account_id FK deferred to 005)
--------------------------------------------------------------------------------
CREATE TABLE public.sale_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  financial_account_id uuid,
  reference text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX sale_payments_organization_id_idx ON public.sale_payments (organization_id);
CREATE INDEX sale_payments_sale_id_idx ON public.sale_payments (sale_id);
CREATE INDEX sale_payments_financial_account_id_idx ON public.sale_payments (financial_account_id);

CREATE TRIGGER sale_payments_set_updated_at
  BEFORE UPDATE ON public.sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_discounts
--------------------------------------------------------------------------------
CREATE TABLE public.sale_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  discount_type text NOT NULL DEFAULT 'amount'
    CHECK (discount_type IN ('amount', 'percent', 'line')),
  amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  percent numeric(8, 4),
  reason text,
  approved_by uuid REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX sale_discounts_organization_id_idx ON public.sale_discounts (organization_id);
CREATE INDEX sale_discounts_sale_id_idx ON public.sale_discounts (sale_id);

CREATE TRIGGER sale_discounts_set_updated_at
  BEFORE UPDATE ON public.sale_discounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_approvals
--------------------------------------------------------------------------------
CREATE TABLE public.sale_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id) ON DELETE CASCADE,
  approval_type text NOT NULL
    CHECK (approval_type IN ('discount', 'price_override', 'correction', 'void', 'return')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reason text,
  requested_by uuid REFERENCES public.profiles (id),
  decided_by uuid REFERENCES public.profiles (id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX sale_approvals_organization_id_idx ON public.sale_approvals (organization_id);
CREATE INDEX sale_approvals_sale_id_idx ON public.sale_approvals (sale_id);
CREATE INDEX sale_approvals_status_idx ON public.sale_approvals (organization_id, status)
  WHERE deleted_at IS NULL;

CREATE TRIGGER sale_approvals_set_updated_at
  BEFORE UPDATE ON public.sale_approvals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- held_sales (POS park/hold)
--------------------------------------------------------------------------------
CREATE TABLE public.held_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  customer_id uuid REFERENCES public.customers (id),
  salesperson_id uuid REFERENCES public.profiles (id),
  hold_label text,
  note text,
  subtotal numeric(14, 2) NOT NULL DEFAULT 0,
  discount numeric(14, 2) NOT NULL DEFAULT 0,
  tax numeric(14, 2) NOT NULL DEFAULT 0,
  shipping numeric(14, 2) NOT NULL DEFAULT 0,
  grand_total numeric(14, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX held_sales_organization_id_idx ON public.held_sales (organization_id);
CREATE INDEX held_sales_branch_id_idx ON public.held_sales (branch_id);
CREATE INDEX held_sales_created_at_idx ON public.held_sales (branch_id, created_at DESC);

CREATE TRIGGER held_sales_set_updated_at
  BEFORE UPDATE ON public.held_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- held_sale_items (normalized cart lines)
--------------------------------------------------------------------------------
CREATE TABLE public.held_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  held_sale_id uuid NOT NULL REFERENCES public.held_sales (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX held_sale_items_organization_id_idx ON public.held_sale_items (organization_id);
CREATE INDEX held_sale_items_held_sale_id_idx ON public.held_sale_items (held_sale_id);
CREATE INDEX held_sale_items_variant_id_idx ON public.held_sale_items (variant_id);

CREATE TRIGGER held_sale_items_set_updated_at
  BEFORE UPDATE ON public.held_sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_returns
--------------------------------------------------------------------------------
CREATE TABLE public.sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  sale_id uuid NOT NULL REFERENCES public.sales (id),
  return_no text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reason text,
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  approved_by uuid REFERENCES public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX sale_returns_org_return_no_active_uidx
  ON public.sale_returns (organization_id, return_no)
  WHERE deleted_at IS NULL;

CREATE INDEX sale_returns_organization_id_idx ON public.sale_returns (organization_id);
CREATE INDEX sale_returns_branch_id_idx ON public.sale_returns (branch_id);
CREATE INDEX sale_returns_sale_id_idx ON public.sale_returns (sale_id);
CREATE INDEX sale_returns_created_at_idx ON public.sale_returns (organization_id, created_at DESC);

CREATE TRIGGER sale_returns_set_updated_at
  BEFORE UPDATE ON public.sale_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- sale_return_items
--------------------------------------------------------------------------------
CREATE TABLE public.sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  sale_return_id uuid NOT NULL REFERENCES public.sale_returns (id) ON DELETE CASCADE,
  sale_item_id uuid REFERENCES public.sale_items (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_price numeric(14, 2) NOT NULL CHECK (unit_price >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  condition text NOT NULL
    CHECK (condition IN ('sellable', 'damaged', 'quarantine', 'missing', 'wrong_item')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX sale_return_items_organization_id_idx ON public.sale_return_items (organization_id);
CREATE INDEX sale_return_items_sale_return_id_idx ON public.sale_return_items (sale_return_id);
CREATE INDEX sale_return_items_variant_id_idx ON public.sale_return_items (variant_id);

CREATE TRIGGER sale_return_items_set_updated_at
  BEFORE UPDATE ON public.sale_return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- purchases
--------------------------------------------------------------------------------
CREATE TABLE public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  invoice_no text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'voided', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'overpaid')),
  subtotal numeric(14, 2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (discount >= 0),
  tax numeric(14, 2) NOT NULL DEFAULT 0 CHECK (tax >= 0),
  shipping numeric(14, 2) NOT NULL DEFAULT 0 CHECK (shipping >= 0),
  grand_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
  paid_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (paid_total >= 0),
  due_total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (due_total >= 0),
  client_txn_key text,
  note text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX purchases_org_invoice_no_active_uidx
  ON public.purchases (organization_id, invoice_no)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX purchases_org_client_txn_key_active_uidx
  ON public.purchases (organization_id, client_txn_key)
  WHERE deleted_at IS NULL AND client_txn_key IS NOT NULL;

CREATE INDEX purchases_organization_id_idx ON public.purchases (organization_id);
CREATE INDEX purchases_branch_id_idx ON public.purchases (branch_id);
CREATE INDEX purchases_supplier_id_idx ON public.purchases (supplier_id);
CREATE INDEX purchases_org_created_at_idx ON public.purchases (organization_id, created_at DESC);
CREATE INDEX purchases_branch_created_at_idx ON public.purchases (branch_id, created_at DESC);

CREATE TRIGGER purchases_set_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- purchase_items
--------------------------------------------------------------------------------
CREATE TABLE public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_cost numeric(14, 2) NOT NULL CHECK (unit_cost >= 0),
  line_discount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (line_discount >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX purchase_items_organization_id_idx ON public.purchase_items (organization_id);
CREATE INDEX purchase_items_purchase_id_idx ON public.purchase_items (purchase_id);
CREATE INDEX purchase_items_variant_id_idx ON public.purchase_items (variant_id);

CREATE TRIGGER purchase_items_set_updated_at
  BEFORE UPDATE ON public.purchase_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- purchase_payments (financial_account_id FK deferred to 005)
--------------------------------------------------------------------------------
CREATE TABLE public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  method text NOT NULL,
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  financial_account_id uuid,
  reference text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX purchase_payments_organization_id_idx ON public.purchase_payments (organization_id);
CREATE INDEX purchase_payments_purchase_id_idx ON public.purchase_payments (purchase_id);
CREATE INDEX purchase_payments_financial_account_id_idx ON public.purchase_payments (financial_account_id);

CREATE TRIGGER purchase_payments_set_updated_at
  BEFORE UPDATE ON public.purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- purchase_returns
--------------------------------------------------------------------------------
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  purchase_id uuid NOT NULL REFERENCES public.purchases (id),
  supplier_id uuid NOT NULL REFERENCES public.suppliers (id),
  return_no text NOT NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'completed', 'cancelled')),
  reason text,
  total numeric(14, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX purchase_returns_org_return_no_active_uidx
  ON public.purchase_returns (organization_id, return_no)
  WHERE deleted_at IS NULL;

CREATE INDEX purchase_returns_organization_id_idx ON public.purchase_returns (organization_id);
CREATE INDEX purchase_returns_branch_id_idx ON public.purchase_returns (branch_id);
CREATE INDEX purchase_returns_purchase_id_idx ON public.purchase_returns (purchase_id);
CREATE INDEX purchase_returns_created_at_idx ON public.purchase_returns (organization_id, created_at DESC);

CREATE TRIGGER purchase_returns_set_updated_at
  BEFORE UPDATE ON public.purchase_returns
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- purchase_return_items
--------------------------------------------------------------------------------
CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  purchase_return_id uuid NOT NULL REFERENCES public.purchase_returns (id) ON DELETE CASCADE,
  purchase_item_id uuid REFERENCES public.purchase_items (id),
  variant_id uuid NOT NULL REFERENCES public.product_variants (id),
  qty numeric(14, 3) NOT NULL CHECK (qty > 0),
  unit_cost numeric(14, 2) NOT NULL CHECK (unit_cost >= 0),
  line_total numeric(14, 2) NOT NULL CHECK (line_total >= 0),
  condition text
    CHECK (condition IS NULL OR condition IN ('sellable', 'damaged', 'quarantine', 'missing', 'wrong_item')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX purchase_return_items_organization_id_idx ON public.purchase_return_items (organization_id);
CREATE INDEX purchase_return_items_return_id_idx ON public.purchase_return_items (purchase_return_id);
CREATE INDEX purchase_return_items_variant_id_idx ON public.purchase_return_items (variant_id);

CREATE TRIGGER purchase_return_items_set_updated_at
  BEFORE UPDATE ON public.purchase_return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.held_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

-- customers
CREATE POLICY customers_select ON public.customers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.read')
      OR public.user_has_permission('customers.manage')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('sales.read')
    )
  );

CREATE POLICY customers_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  );

CREATE POLICY customers_update ON public.customers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  );

-- customer_addresses
CREATE POLICY customer_addresses_select ON public.customer_addresses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.read')
      OR public.user_has_permission('customers.manage')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY customer_addresses_insert ON public.customer_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  );

CREATE POLICY customer_addresses_update ON public.customer_addresses
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('customers.manage')
  );

-- customer_ledger
CREATE POLICY customer_ledger_select ON public.customer_ledger
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('customers.read')
      OR public.user_has_permission('accounts.read')
      OR public.user_has_permission('sales.read')
    )
  );

CREATE POLICY customer_ledger_insert ON public.customer_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('pos.create')
      OR public.user_has_permission('customers.manage')
      OR public.user_has_permission('accounts.post')
    )
  );

-- suppliers
CREATE POLICY suppliers_select ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.read')
      OR public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('purchases.read')
      OR public.user_has_permission('purchases.create')
    )
  );

CREATE POLICY suppliers_insert ON public.suppliers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

CREATE POLICY suppliers_update ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

-- supplier_addresses
CREATE POLICY supplier_addresses_select ON public.supplier_addresses
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.read')
      OR public.user_has_permission('suppliers.manage')
    )
  );

CREATE POLICY supplier_addresses_insert ON public.supplier_addresses
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

CREATE POLICY supplier_addresses_update ON public.supplier_addresses
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('suppliers.manage')
  );

-- supplier_ledger
CREATE POLICY supplier_ledger_select ON public.supplier_ledger
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('suppliers.read')
      OR public.user_has_permission('accounts.read')
      OR public.user_has_permission('purchases.read')
    )
  );

CREATE POLICY supplier_ledger_insert ON public.supplier_ledger
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('purchases.create')
      OR public.user_has_permission('suppliers.manage')
      OR public.user_has_permission('accounts.post')
    )
  );

-- sales
CREATE POLICY sales_select ON public.sales
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY sales_insert ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY sales_update ON public.sales
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('pos.create')
      OR public.user_has_permission('sales.void')
      OR public.user_has_permission('sales.correct')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
  );

-- sale child tables (org scope + parent sale access via permission)
CREATE POLICY sale_items_select ON public.sale_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY sale_items_insert ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY sale_versions_select ON public.sale_versions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('audit.read')
    )
  );

CREATE POLICY sale_versions_insert ON public.sale_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.correct')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY sale_payments_select ON public.sale_payments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('accounts.read')
    )
  );

CREATE POLICY sale_payments_insert ON public.sale_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY sale_discounts_select ON public.sale_discounts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY sale_discounts_insert ON public.sale_discounts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('pos.create')
      OR public.user_has_permission('pos.discount')
    )
  );

CREATE POLICY sale_approvals_select ON public.sale_approvals
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('pos.create')
      OR public.user_has_permission('sales.correct')
      OR public.user_has_permission('sales.void')
    )
  );

CREATE POLICY sale_approvals_insert ON public.sale_approvals
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_organization_id() IS NOT NULL
  );

CREATE POLICY sale_approvals_update ON public.sale_approvals
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.correct')
      OR public.user_has_permission('sales.void')
      OR public.user_has_permission('pos.discount')
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- held sales
CREATE POLICY held_sales_select ON public.held_sales
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY held_sales_insert ON public.held_sales
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY held_sales_update ON public.held_sales
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('pos.create')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY held_sale_items_select ON public.held_sale_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY held_sale_items_insert ON public.held_sale_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  );

CREATE POLICY held_sale_items_update ON public.held_sale_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('pos.create')
  );

-- sale returns
CREATE POLICY sale_returns_select ON public.sale_returns
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY sale_returns_insert ON public.sale_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('sales.return.review')
      OR public.user_has_permission('courier.manage')
    )
  );

CREATE POLICY sale_returns_update ON public.sale_returns
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  );

CREATE POLICY sale_return_items_select ON public.sale_return_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.read')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY sale_return_items_insert ON public.sale_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('sales.return.review')
      OR public.user_has_permission('courier.manage')
    )
  );

CREATE POLICY sale_return_items_update ON public.sale_return_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  );

-- purchases
CREATE POLICY purchases_select ON public.purchases
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND (
      public.user_has_permission('purchases.read')
      OR public.user_has_permission('purchases.create')
    )
  );

CREATE POLICY purchases_insert ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchases_update ON public.purchases
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('purchases.create')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchase_items_select ON public.purchase_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('purchases.read')
      OR public.user_has_permission('purchases.create')
    )
  );

CREATE POLICY purchase_items_insert ON public.purchase_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchase_payments_select ON public.purchase_payments
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('purchases.read')
      OR public.user_has_permission('accounts.read')
    )
  );

CREATE POLICY purchase_payments_insert ON public.purchase_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchase_returns_select ON public.purchase_returns
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('purchases.read')
  );

CREATE POLICY purchase_returns_insert ON public.purchase_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_branch_access(branch_id)
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchase_returns_update ON public.purchase_returns
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.create')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.create')
  );

CREATE POLICY purchase_return_items_select ON public.purchase_return_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.read')
  );

CREATE POLICY purchase_return_items_insert ON public.purchase_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('purchases.create')
  );
