-- SMART ORDER MS OMS — Schema Planning Document
-- Supabase-ready tables with RLS audit columns (created_by, updated_by, deleted_at)
-- TODO: Apply via Supabase migration when backend is connected

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('facebook', 'shopify', 'woocommerce', 'instagram', 'manual')),
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  invoice_prefix TEXT NOT NULL,
  default_courier_id UUID,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'pending')),
  api_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (api_status IN ('connected', 'not_connected', 'error')),
  orders_count INT NOT NULL DEFAULT 0,
  collection_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- COURIERS
-- ============================================================
CREATE TABLE couriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT,
  logo_url TEXT,
  contact_phone TEXT,
  api_base_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  connection_status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'testing', 'failed')),
  default_service_type TEXT,
  success_rate NUMERIC(5,2) DEFAULT 0,
  pending_parcels INT NOT NULL DEFAULT 0,
  delivered_parcels INT NOT NULL DEFAULT 0,
  returned_parcels INT NOT NULL DEFAULT 0,
  collection_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE courier_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  api_base_url TEXT,
  api_key_encrypted TEXT,
  api_secret_encrypted TEXT,
  webhook_url TEXT,
  default_service_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  address TEXT,
  district TEXT,
  total_orders INT NOT NULL DEFAULT 0,
  delivered_orders INT NOT NULL DEFAULT 0,
  returned_orders INT NOT NULL DEFAULT 0,
  cancelled_orders INT NOT NULL DEFAULT 0,
  total_spent NUMERIC(14,2) NOT NULL DEFAULT 0,
  return_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  fraud_level TEXT NOT NULL DEFAULT 'SAFE'
    CHECK (fraud_level IN ('SAFE', 'MEDIUM', 'HIGH', 'BLOCKED')),
  is_blacklisted BOOLEAN NOT NULL DEFAULT false,
  blacklist_reason TEXT,
  customer_note TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- FRAUD
-- ============================================================
CREATE TABLE fraud_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  description TEXT,
  points INT NOT NULL DEFAULT 0,
  threshold INT,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'blocked')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE fraud_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  phone TEXT NOT NULL,
  order_id UUID,
  provider TEXT,
  internal_score INT NOT NULL DEFAULT 0,
  external_score INT,
  final_score INT NOT NULL DEFAULT 0,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'medium', 'high', 'blocked')),
  reasons JSONB NOT NULL DEFAULT '[]',
  raw_response JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE fraud_api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  api_base_url TEXT,
  api_key_encrypted TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('connected', 'disconnected', 'failed')),
  monthly_limit INT,
  used_checks INT NOT NULL DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- INVOICES
-- ============================================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE,
  order_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id),
  store_id UUID NOT NULL REFERENCES stores(id),
  invoice_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('draft', 'issued', 'paid', 'void')),
  print_count INT NOT NULL DEFAULT 0,
  last_printed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- SETTINGS & ROLES
-- ============================================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- LOGS
-- ============================================================
CREATE TABLE courier_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  courier_id UUID NOT NULL REFERENCES couriers(id),
  status TEXT NOT NULL,
  tracking_id TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  user_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID
);

-- ============================================================
-- INDEXES (recommended)
-- ============================================================
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_couriers_connection ON couriers(connection_status);
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_fraud ON customers(fraud_level);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_store ON invoices(store_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);
CREATE INDEX idx_fraud_checks_phone ON fraud_checks(phone);
CREATE INDEX idx_courier_status_logs_order ON courier_status_logs(order_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- ============================================================
-- RLS NOTES
-- ============================================================
-- All tables include created_by, updated_by, deleted_at for Row Level Security.
-- Enable RLS per table in production:
--   ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY "tenant_isolation" ON stores USING (deleted_at IS NULL);
