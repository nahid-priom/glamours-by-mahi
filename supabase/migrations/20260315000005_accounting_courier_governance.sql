-- Glamourous by Mahi · Retail ERP
-- Migration 005: Accounting, courier, governance (approvals/notifications/audit)
-- Depends on: 001–004

--------------------------------------------------------------------------------
-- financial_periods
--------------------------------------------------------------------------------
CREATE TABLE public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed', 'locked')),
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT financial_periods_date_order CHECK (end_date >= start_date)
);

CREATE UNIQUE INDEX financial_periods_org_name_active_uidx
  ON public.financial_periods (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX financial_periods_org_current_active_uidx
  ON public.financial_periods (organization_id)
  WHERE deleted_at IS NULL AND is_current = true;

CREATE INDEX financial_periods_organization_id_idx ON public.financial_periods (organization_id);
CREATE INDEX financial_periods_dates_idx ON public.financial_periods (organization_id, start_date, end_date);

CREATE TRIGGER financial_periods_set_updated_at
  BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- account_groups
--------------------------------------------------------------------------------
CREATE TABLE public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  account_class text NOT NULL
    CHECK (account_class IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX account_groups_org_name_active_uidx
  ON public.account_groups (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX account_groups_organization_id_idx ON public.account_groups (organization_id);

CREATE TRIGGER account_groups_set_updated_at
  BEFORE UPDATE ON public.account_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- chart_of_accounts
--------------------------------------------------------------------------------
CREATE TABLE public.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  group_id uuid REFERENCES public.account_groups (id),
  code text NOT NULL,
  name text NOT NULL,
  account_type text NOT NULL
    CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  system_role text
    CHECK (system_role IS NULL OR system_role IN (
      'cash', 'bank', 'mobile_money', 'receivable', 'payable',
      'inventory_asset', 'cogs', 'sales_revenue', 'sales_return',
      'purchase', 'tax_payable', 'tax_receivable', 'refund_payable'
    )),
  is_postable boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  parent_id uuid REFERENCES public.chart_of_accounts (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX chart_of_accounts_org_code_active_uidx
  ON public.chart_of_accounts (organization_id, code)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX chart_of_accounts_org_system_role_active_uidx
  ON public.chart_of_accounts (organization_id, system_role)
  WHERE deleted_at IS NULL AND system_role IS NOT NULL;

CREATE INDEX chart_of_accounts_organization_id_idx ON public.chart_of_accounts (organization_id);
CREATE INDEX chart_of_accounts_group_id_idx ON public.chart_of_accounts (group_id);

CREATE TRIGGER chart_of_accounts_set_updated_at
  BEFORE UPDATE ON public.chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- financial_accounts (cash / bank / wallet operational accounts)
--------------------------------------------------------------------------------
CREATE TABLE public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  chart_account_id uuid REFERENCES public.chart_of_accounts (id),
  name text NOT NULL,
  account_kind text NOT NULL DEFAULT 'cash'
    CHECK (account_kind IN ('cash', 'bank', 'mobile_money', 'other')),
  currency text NOT NULL DEFAULT 'BDT',
  opening_balance numeric(14, 2) NOT NULL DEFAULT 0,
  current_balance numeric(14, 2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX financial_accounts_org_name_active_uidx
  ON public.financial_accounts (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX financial_accounts_organization_id_idx ON public.financial_accounts (organization_id);
CREATE INDEX financial_accounts_branch_id_idx ON public.financial_accounts (branch_id);

CREATE TRIGGER financial_accounts_set_updated_at
  BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Deferred FKs from sales/purchases payments
ALTER TABLE public.sale_payments
  ADD CONSTRAINT sale_payments_financial_account_id_fkey
  FOREIGN KEY (financial_account_id) REFERENCES public.financial_accounts (id);

ALTER TABLE public.purchase_payments
  ADD CONSTRAINT purchase_payments_financial_account_id_fkey
  FOREIGN KEY (financial_account_id) REFERENCES public.financial_accounts (id);

--------------------------------------------------------------------------------
-- payment_methods
--------------------------------------------------------------------------------
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  code text NOT NULL,
  name text NOT NULL,
  financial_account_id uuid REFERENCES public.financial_accounts (id),
  requires_reference boolean NOT NULL DEFAULT false,
  is_due boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX payment_methods_org_code_active_uidx
  ON public.payment_methods (organization_id, lower(code))
  WHERE deleted_at IS NULL;

CREATE INDEX payment_methods_organization_id_idx ON public.payment_methods (organization_id);

CREATE TRIGGER payment_methods_set_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- journal_entries
--------------------------------------------------------------------------------
CREATE TABLE public.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  period_id uuid REFERENCES public.financial_periods (id),
  entry_no text NOT NULL,
  entry_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted', 'reversed')),
  source_type text,
  source_id uuid,
  memo text,
  posted_at timestamptz,
  reversed_entry_id uuid REFERENCES public.journal_entries (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX journal_entries_org_entry_no_active_uidx
  ON public.journal_entries (organization_id, entry_no)
  WHERE deleted_at IS NULL;

CREATE INDEX journal_entries_organization_id_idx ON public.journal_entries (organization_id);
CREATE INDEX journal_entries_branch_id_idx ON public.journal_entries (branch_id);
CREATE INDEX journal_entries_entry_date_idx ON public.journal_entries (organization_id, entry_date DESC);
CREATE INDEX journal_entries_source_idx ON public.journal_entries (source_type, source_id);

CREATE TRIGGER journal_entries_set_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- journal_lines
--------------------------------------------------------------------------------
CREATE TABLE public.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries (id) ON DELETE CASCADE,
  chart_account_id uuid NOT NULL REFERENCES public.chart_of_accounts (id),
  financial_account_id uuid REFERENCES public.financial_accounts (id),
  description text,
  debit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(14, 2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  line_no int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT journal_lines_not_both_nonzero CHECK (
    NOT (debit > 0 AND credit > 0)
  ),
  CONSTRAINT journal_lines_has_amount CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX journal_lines_organization_id_idx ON public.journal_lines (organization_id);
CREATE INDEX journal_lines_journal_entry_id_idx ON public.journal_lines (journal_entry_id);
CREATE INDEX journal_lines_chart_account_id_idx ON public.journal_lines (chart_account_id);

CREATE TRIGGER journal_lines_set_updated_at
  BEFORE UPDATE ON public.journal_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_companies
--------------------------------------------------------------------------------
CREATE TABLE public.courier_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  code text,
  contact_phone text,
  api_base_url text,
  webhook_secret text,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'archived')),
  connection_status text NOT NULL DEFAULT 'disconnected'
    CHECK (connection_status IN ('connected', 'disconnected', 'testing', 'failed')),
  success_rate numeric(5, 2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX courier_companies_org_name_active_uidx
  ON public.courier_companies (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX courier_companies_organization_id_idx ON public.courier_companies (organization_id);

CREATE TRIGGER courier_companies_set_updated_at
  BEFORE UPDATE ON public.courier_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_parcels
--------------------------------------------------------------------------------
CREATE TABLE public.courier_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  courier_company_id uuid NOT NULL REFERENCES public.courier_companies (id),
  sale_id uuid REFERENCES public.sales (id),
  tracking_no text,
  consignment_id text,
  status text NOT NULL DEFAULT 'booked'
    CHECK (status IN (
      'booked', 'picked_up', 'in_transit', 'delivered',
      'failed', 'returned', 'cancelled'
    )),
  cod_amount numeric(14, 2) NOT NULL DEFAULT 0,
  courier_charge numeric(14, 2) NOT NULL DEFAULT 0,
  customer_name text,
  customer_phone text,
  delivery_address text,
  booked_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX courier_parcels_organization_id_idx ON public.courier_parcels (organization_id);
CREATE INDEX courier_parcels_branch_id_idx ON public.courier_parcels (branch_id);
CREATE INDEX courier_parcels_courier_company_id_idx ON public.courier_parcels (courier_company_id);
CREATE INDEX courier_parcels_sale_id_idx ON public.courier_parcels (sale_id);
CREATE INDEX courier_parcels_tracking_no_idx ON public.courier_parcels (organization_id, tracking_no);
CREATE INDEX courier_parcels_created_at_idx ON public.courier_parcels (organization_id, created_at DESC);

CREATE TRIGGER courier_parcels_set_updated_at
  BEFORE UPDATE ON public.courier_parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_events (idempotent webhook log)
--------------------------------------------------------------------------------
CREATE TABLE public.courier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  courier_company_id uuid REFERENCES public.courier_companies (id),
  parcel_id uuid REFERENCES public.courier_parcels (id),
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX courier_events_external_event_id_uidx
  ON public.courier_events (external_event_id);

CREATE INDEX courier_events_organization_id_idx ON public.courier_events (organization_id);
CREATE INDEX courier_events_parcel_id_idx ON public.courier_events (parcel_id);
CREATE INDEX courier_events_created_at_idx ON public.courier_events (organization_id, created_at DESC);

CREATE TRIGGER courier_events_set_updated_at
  BEFORE UPDATE ON public.courier_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_return_requests
--------------------------------------------------------------------------------
CREATE TABLE public.courier_return_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  courier_company_id uuid REFERENCES public.courier_companies (id),
  parcel_id uuid REFERENCES public.courier_parcels (id),
  sale_id uuid REFERENCES public.sales (id),
  courier_event_id uuid REFERENCES public.courier_events (id),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  courier_reason text,
  rejection_reason text,
  reviewed_by uuid REFERENCES public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX courier_return_requests_organization_id_idx ON public.courier_return_requests (organization_id);
CREATE INDEX courier_return_requests_status_idx
  ON public.courier_return_requests (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX courier_return_requests_parcel_id_idx ON public.courier_return_requests (parcel_id);
CREATE INDEX courier_return_requests_sale_id_idx ON public.courier_return_requests (sale_id);
CREATE INDEX courier_return_requests_created_at_idx
  ON public.courier_return_requests (organization_id, created_at DESC);

CREATE TRIGGER courier_return_requests_set_updated_at
  BEFORE UPDATE ON public.courier_return_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_return_items
--------------------------------------------------------------------------------
CREATE TABLE public.courier_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  request_id uuid NOT NULL REFERENCES public.courier_return_requests (id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants (id),
  sale_item_id uuid REFERENCES public.sale_items (id),
  expected_qty numeric(14, 3) NOT NULL DEFAULT 0 CHECK (expected_qty >= 0),
  received_qty numeric(14, 3),
  condition text
    CHECK (condition IS NULL OR condition IN (
      'sellable', 'damaged', 'quarantine', 'missing', 'wrong_item'
    )),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX courier_return_items_organization_id_idx ON public.courier_return_items (organization_id);
CREATE INDEX courier_return_items_request_id_idx ON public.courier_return_items (request_id);

CREATE TRIGGER courier_return_items_set_updated_at
  BEFORE UPDATE ON public.courier_return_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- courier_settlements
--------------------------------------------------------------------------------
CREATE TABLE public.courier_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  courier_company_id uuid NOT NULL REFERENCES public.courier_companies (id),
  parcel_id uuid REFERENCES public.courier_parcels (id),
  sale_id uuid REFERENCES public.sales (id),
  cod_amount numeric(14, 2) NOT NULL DEFAULT 0,
  courier_charge numeric(14, 2) NOT NULL DEFAULT 0,
  return_charge numeric(14, 2) NOT NULL DEFAULT 0,
  settlement_amount numeric(14, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'settled', 'disputed')),
  settlement_date date,
  financial_account_id uuid REFERENCES public.financial_accounts (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX courier_settlements_organization_id_idx ON public.courier_settlements (organization_id);
CREATE INDEX courier_settlements_courier_company_id_idx ON public.courier_settlements (courier_company_id);
CREATE INDEX courier_settlements_status_idx
  ON public.courier_settlements (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX courier_settlements_settlement_date_idx
  ON public.courier_settlements (organization_id, settlement_date);

CREATE TRIGGER courier_settlements_set_updated_at
  BEFORE UPDATE ON public.courier_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- approval_requests (generic workflow)
--------------------------------------------------------------------------------
CREATE TABLE public.approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  requested_by uuid REFERENCES public.profiles (id),
  decided_by uuid REFERENCES public.profiles (id),
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX approval_requests_organization_id_idx ON public.approval_requests (organization_id);
CREATE INDEX approval_requests_entity_idx ON public.approval_requests (entity_type, entity_id);
CREATE INDEX approval_requests_status_idx
  ON public.approval_requests (organization_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX approval_requests_created_at_idx
  ON public.approval_requests (organization_id, created_at DESC);

CREATE TRIGGER approval_requests_set_updated_at
  BEFORE UPDATE ON public.approval_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- notifications
--------------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  user_id uuid REFERENCES public.profiles (id),
  title text NOT NULL,
  body text,
  category text,
  entity_type text,
  entity_id uuid,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX notifications_organization_id_idx ON public.notifications (organization_id);
CREATE INDEX notifications_user_id_idx ON public.notifications (user_id);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_read = false;
CREATE INDEX notifications_created_at_idx
  ON public.notifications (organization_id, created_at DESC);

CREATE TRIGGER notifications_set_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- activity_logs
--------------------------------------------------------------------------------
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  actor_id uuid REFERENCES public.profiles (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  summary text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE INDEX activity_logs_organization_id_idx ON public.activity_logs (organization_id);
CREATE INDEX activity_logs_entity_idx ON public.activity_logs (entity_type, entity_id);
CREATE INDEX activity_logs_created_at_idx ON public.activity_logs (organization_id, created_at DESC);
CREATE INDEX activity_logs_actor_id_idx ON public.activity_logs (actor_id);

CREATE TRIGGER activity_logs_set_updated_at
  BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- audit_logs (immutable for authenticated; insert via SECURITY DEFINER writer)
--------------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid REFERENCES public.branches (id),
  actor_id uuid REFERENCES public.profiles (id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
  -- intentionally no updated_at / deleted_at / updated_by (immutable)
);

CREATE INDEX audit_logs_organization_id_idx ON public.audit_logs (organization_id);
CREATE INDEX audit_logs_entity_idx ON public.audit_logs (entity_type, entity_id);
CREATE INDEX audit_logs_created_at_idx ON public.audit_logs (organization_id, created_at DESC);
CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs (actor_id);
CREATE INDEX audit_logs_action_idx ON public.audit_logs (organization_id, action);

CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_organization_id uuid,
  p_branch_id uuid,
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_before_data jsonb DEFAULT NULL,
  p_after_data jsonb DEFAULT NULL,
  p_reason text DEFAULT NULL,
  p_request_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    organization_id, branch_id, actor_id, action, entity_type, entity_id,
    before_data, after_data, reason, request_meta
  ) VALUES (
    p_organization_id, p_branch_id, p_actor_id, p_action, p_entity_type, p_entity_id,
    p_before_data, p_after_data, p_reason, coalesce(p_request_meta, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION public.write_audit_log IS
  'SECURITY DEFINER writer for immutable audit_logs. Prefer this over direct INSERT.';

REVOKE ALL ON FUNCTION public.write_audit_log(
  uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, jsonb
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.write_audit_log(
  uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, jsonb
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_log(
  uuid, uuid, uuid, text, text, uuid, jsonb, jsonb, text, jsonb
) TO service_role;

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- financial_periods
CREATE POLICY financial_periods_select ON public.financial_periods
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.read')
  );

CREATE POLICY financial_periods_insert ON public.financial_periods
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY financial_periods_update ON public.financial_periods
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- account_groups
CREATE POLICY account_groups_select ON public.account_groups
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.read')
  );

CREATE POLICY account_groups_insert ON public.account_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY account_groups_update ON public.account_groups
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- chart_of_accounts
CREATE POLICY chart_of_accounts_select ON public.chart_of_accounts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY chart_of_accounts_insert ON public.chart_of_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY chart_of_accounts_update ON public.chart_of_accounts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- financial_accounts
CREATE POLICY financial_accounts_select ON public.financial_accounts
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY financial_accounts_insert ON public.financial_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY financial_accounts_update ON public.financial_accounts
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('settings.manage')
      OR public.user_has_permission('accounts.post')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- payment_methods
CREATE POLICY payment_methods_select ON public.payment_methods
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY payment_methods_insert ON public.payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY payment_methods_update ON public.payment_methods
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- journal_entries
CREATE POLICY journal_entries_select ON public.journal_entries
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.read')
  );

CREATE POLICY journal_entries_insert ON public.journal_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.post')
      OR public.user_has_permission('pos.create')
    )
  );

CREATE POLICY journal_entries_update ON public.journal_entries
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.post')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.post')
  );

-- journal_lines
CREATE POLICY journal_lines_select ON public.journal_lines
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.read')
  );

CREATE POLICY journal_lines_insert ON public.journal_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.post')
      OR public.user_has_permission('pos.create')
    )
  );

-- courier_companies
CREATE POLICY courier_companies_select ON public.courier_companies
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('courier.manage')
    )
  );

CREATE POLICY courier_companies_insert ON public.courier_companies
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

CREATE POLICY courier_companies_update ON public.courier_companies
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

-- courier_parcels
CREATE POLICY courier_parcels_select ON public.courier_parcels
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('courier.manage')
    )
    AND (branch_id IS NULL OR public.user_has_branch_access(branch_id))
  );

CREATE POLICY courier_parcels_insert ON public.courier_parcels
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

CREATE POLICY courier_parcels_update ON public.courier_parcels
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

-- courier_events
CREATE POLICY courier_events_select ON public.courier_events
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('courier.manage')
    )
  );

CREATE POLICY courier_events_insert ON public.courier_events
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

-- courier_return_requests
CREATE POLICY courier_return_requests_select ON public.courier_return_requests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY courier_return_requests_insert ON public.courier_return_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.manage')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY courier_return_requests_update ON public.courier_return_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  );

-- courier_return_items
CREATE POLICY courier_return_items_select ON public.courier_return_items
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY courier_return_items_insert ON public.courier_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.manage')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY courier_return_items_update ON public.courier_return_items
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('sales.return.review')
  );

-- courier_settlements
CREATE POLICY courier_settlements_select ON public.courier_settlements
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('courier.read')
      OR public.user_has_permission('accounts.read')
    )
  );

CREATE POLICY courier_settlements_insert ON public.courier_settlements
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

CREATE POLICY courier_settlements_update ON public.courier_settlements
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('courier.manage')
  );

-- approval_requests
CREATE POLICY approval_requests_select ON public.approval_requests
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      requested_by = public.current_profile_id()
      OR public.user_has_permission('settings.manage')
      OR public.user_has_permission('sales.correct')
      OR public.user_has_permission('sales.void')
      OR public.user_has_permission('sales.return.review')
    )
  );

CREATE POLICY approval_requests_insert ON public.approval_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_profile_id() IS NOT NULL
  );

CREATE POLICY approval_requests_update ON public.approval_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('settings.manage')
      OR public.user_has_permission('sales.correct')
      OR public.user_has_permission('sales.void')
      OR public.user_has_permission('sales.return.review')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- notifications
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND user_id = public.current_profile_id()
  );

CREATE POLICY notifications_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_organization_id() IS NOT NULL
  );

CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND user_id = public.current_profile_id()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND user_id = public.current_profile_id()
  );

-- activity_logs
CREATE POLICY activity_logs_select ON public.activity_logs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('audit.read')
      OR public.user_has_permission('reports.read')
      OR actor_id = public.current_profile_id()
    )
  );

CREATE POLICY activity_logs_insert ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.current_profile_id() IS NOT NULL
  );

-- audit_logs: SELECT if audit.read; INSERT via write_audit_log (SECURITY DEFINER)
-- NO UPDATE / DELETE policies for authenticated
CREATE POLICY audit_logs_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('audit.read')
  );

-- service_role bypasses RLS; write_audit_log inserts as definer
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
