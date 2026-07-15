-- Glamourous by Mahi · Retail ERP
-- Migration 011: Simple retail accounting (income/expense, transfers, daily closing, ledger)
-- Depends on: 001–010

--------------------------------------------------------------------------------
-- Permissions (idempotent)
--------------------------------------------------------------------------------
INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('accounts.manage', 'Full manage access to cash accounts and transfers'),
  ('income.create', 'Create income entries'),
  ('expense.create', 'Create expense entries'),
  ('expense.approve', 'Approve expense entries'),
  ('customer_due.collect', 'Collect customer receivables'),
  ('supplier_due.pay', 'Pay supplier payables'),
  ('transactions.void', 'Void posted financial transactions'),
  ('daily_closing.create', 'Create daily cash closings'),
  ('daily_closing.approve', 'Approve daily cash closings'),
  ('profit_loss.read', 'View profit and loss reports'),
  ('account_settings.manage', 'Manage accounting settings and categories')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = v.key AND p.deleted_at IS NULL
);

-- Grant new accounting perms to Owner + Super Admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)
  AND p.key IN (
    'accounts.manage', 'income.create', 'expense.create', 'expense.approve',
    'customer_due.collect', 'supplier_due.pay', 'transactions.void',
    'daily_closing.create', 'daily_closing.approve', 'profit_loss.read',
    'account_settings.manage'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );

--------------------------------------------------------------------------------
-- income_categories
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS income_categories_org_name_active_uidx
  ON public.income_categories (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS income_categories_organization_id_idx
  ON public.income_categories (organization_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'income_categories_set_updated_at'
  ) THEN
    CREATE TRIGGER income_categories_set_updated_at
      BEFORE UPDATE ON public.income_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- expense_categories
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_categories_org_name_active_uidx
  ON public.expense_categories (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS expense_categories_organization_id_idx
  ON public.expense_categories (organization_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'expense_categories_set_updated_at'
  ) THEN
    CREATE TRIGGER expense_categories_set_updated_at
      BEFORE UPDATE ON public.expense_categories
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- income_entries
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.income_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  category_id uuid NOT NULL REFERENCES public.income_categories (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
  entry_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  reference text,
  note text,
  attachment_path text,
  received_by uuid REFERENCES public.profiles (id),
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted', 'voided')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS income_entries_org_client_txn_uidx
  ON public.income_entries (organization_id, reference)
  WHERE deleted_at IS NULL AND reference LIKE 'CTX:%';

CREATE INDEX IF NOT EXISTS income_entries_organization_id_idx
  ON public.income_entries (organization_id);
CREATE INDEX IF NOT EXISTS income_entries_branch_id_idx
  ON public.income_entries (branch_id);
CREATE INDEX IF NOT EXISTS income_entries_entry_date_idx
  ON public.income_entries (organization_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS income_entries_account_id_idx
  ON public.income_entries (account_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'income_entries_set_updated_at'
  ) THEN
    CREATE TRIGGER income_entries_set_updated_at
      BEFORE UPDATE ON public.income_entries
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- expense_entries
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.expense_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  category_id uuid NOT NULL REFERENCES public.expense_categories (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
  entry_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  payee text,
  reference text,
  note text,
  attachment_path text,
  approved_by uuid REFERENCES public.profiles (id),
  approval_required boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('draft', 'posted', 'voided')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS expense_entries_org_client_txn_uidx
  ON public.expense_entries (organization_id, reference)
  WHERE deleted_at IS NULL AND reference LIKE 'CTX:%';

CREATE INDEX IF NOT EXISTS expense_entries_organization_id_idx
  ON public.expense_entries (organization_id);
CREATE INDEX IF NOT EXISTS expense_entries_branch_id_idx
  ON public.expense_entries (branch_id);
CREATE INDEX IF NOT EXISTS expense_entries_entry_date_idx
  ON public.expense_entries (organization_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS expense_entries_account_id_idx
  ON public.expense_entries (account_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'expense_entries_set_updated_at'
  ) THEN
    CREATE TRIGGER expense_entries_set_updated_at
      BEFORE UPDATE ON public.expense_entries
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- account_transfers
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.account_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  from_account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
  to_account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
  amount numeric(14, 2) NOT NULL CHECK (amount > 0),
  transfer_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  reference text,
  note text,
  status text NOT NULL DEFAULT 'posted'
    CHECK (status IN ('posted', 'voided')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id),
  CONSTRAINT account_transfers_accounts_differ CHECK (from_account_id <> to_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS account_transfers_org_client_txn_uidx
  ON public.account_transfers (organization_id, reference)
  WHERE deleted_at IS NULL AND reference LIKE 'CTX:%';

CREATE INDEX IF NOT EXISTS account_transfers_organization_id_idx
  ON public.account_transfers (organization_id);
CREATE INDEX IF NOT EXISTS account_transfers_branch_id_idx
  ON public.account_transfers (branch_id);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'account_transfers_set_updated_at'
  ) THEN
    CREATE TRIGGER account_transfers_set_updated_at
      BEFORE UPDATE ON public.account_transfers
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- daily_closings
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  closing_date date NOT NULL,
  opening_cash numeric(14, 2) NOT NULL DEFAULT 0,
  cash_sales numeric(14, 2) NOT NULL DEFAULT 0,
  cash_collections numeric(14, 2) NOT NULL DEFAULT 0,
  other_cash_income numeric(14, 2) NOT NULL DEFAULT 0,
  cash_expenses numeric(14, 2) NOT NULL DEFAULT 0,
  supplier_cash_payments numeric(14, 2) NOT NULL DEFAULT 0,
  cash_transfers_net numeric(14, 2) NOT NULL DEFAULT 0,
  expected_closing numeric(14, 2) NOT NULL DEFAULT 0,
  counted_cash numeric(14, 2) NOT NULL DEFAULT 0,
  difference numeric(14, 2) NOT NULL DEFAULT 0,
  note text,
  closed_by uuid REFERENCES public.profiles (id),
  approved_by uuid REFERENCES public.profiles (id),
  status text NOT NULL DEFAULT 'closed'
    CHECK (status IN ('open', 'closed', 'reopened')),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid REFERENCES public.profiles (id),
  updated_by uuid REFERENCES public.profiles (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS daily_closings_branch_date_active_uidx
  ON public.daily_closings (branch_id, closing_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS daily_closings_organization_id_idx
  ON public.daily_closings (organization_id);
CREATE INDEX IF NOT EXISTS daily_closings_closing_date_idx
  ON public.daily_closings (organization_id, closing_date DESC);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'daily_closings_set_updated_at'
  ) THEN
    CREATE TRIGGER daily_closings_set_updated_at
      BEFORE UPDATE ON public.daily_closings
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- financial_transactions (create if missing; else add missing columns)
--------------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'financial_transactions'
  ) THEN
    CREATE TABLE public.financial_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES public.organizations (id),
      branch_id uuid REFERENCES public.branches (id),
      account_id uuid NOT NULL REFERENCES public.financial_accounts (id),
      transaction_type text NOT NULL,
      direction text NOT NULL CHECK (direction IN ('in', 'out')),
      amount numeric(14, 2) NOT NULL CHECK (amount > 0),
      balance_before numeric(14, 2) NOT NULL,
      balance_after numeric(14, 2) NOT NULL,
      source_type text,
      source_id uuid,
      reference text,
      transaction_date timestamptz NOT NULL DEFAULT timezone('utc', now()),
      note text,
      status text NOT NULL DEFAULT 'posted'
        CHECK (status IN ('posted', 'voided')),
      created_by uuid REFERENCES public.profiles (id),
      created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
      updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
      voided_at timestamptz,
      voided_by uuid REFERENCES public.profiles (id),
      void_reason text,
      deleted_at timestamptz
    );
  ELSE
    ALTER TABLE public.financial_transactions
      ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations (id),
      ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches (id),
      ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.financial_accounts (id),
      ADD COLUMN IF NOT EXISTS transaction_type text,
      ADD COLUMN IF NOT EXISTS direction text,
      ADD COLUMN IF NOT EXISTS amount numeric(14, 2),
      ADD COLUMN IF NOT EXISTS balance_before numeric(14, 2),
      ADD COLUMN IF NOT EXISTS balance_after numeric(14, 2),
      ADD COLUMN IF NOT EXISTS source_type text,
      ADD COLUMN IF NOT EXISTS source_id uuid,
      ADD COLUMN IF NOT EXISTS reference text,
      ADD COLUMN IF NOT EXISTS transaction_date timestamptz DEFAULT timezone('utc', now()),
      ADD COLUMN IF NOT EXISTS note text,
      ADD COLUMN IF NOT EXISTS status text DEFAULT 'posted',
      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles (id),
      ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT timezone('utc', now()),
      ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT timezone('utc', now()),
      ADD COLUMN IF NOT EXISTS voided_at timestamptz,
      ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES public.profiles (id),
      ADD COLUMN IF NOT EXISTS void_reason text,
      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS financial_transactions_organization_id_idx
  ON public.financial_transactions (organization_id);
CREATE INDEX IF NOT EXISTS financial_transactions_account_id_idx
  ON public.financial_transactions (account_id);
CREATE INDEX IF NOT EXISTS financial_transactions_branch_date_idx
  ON public.financial_transactions (organization_id, branch_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS financial_transactions_source_idx
  ON public.financial_transactions (source_type, source_id);
CREATE INDEX IF NOT EXISTS financial_transactions_status_idx
  ON public.financial_transactions (organization_id, status)
  WHERE deleted_at IS NULL;

-- Idempotency for CTX: keys lives on income_entries / expense_entries /
-- account_transfers (transfers create two ledger rows with the same source_id).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'financial_transactions_set_updated_at'
  ) THEN
    CREATE TRIGGER financial_transactions_set_updated_at
      BEFORE UPDATE ON public.financial_transactions
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

--------------------------------------------------------------------------------
-- Default category seed (demo org)
--------------------------------------------------------------------------------
INSERT INTO public.income_categories (organization_id, name, is_active, sort_order)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v.name, true, v.sort_order
FROM (VALUES
  ('Sales Income', 10),
  ('Service Income', 20),
  ('Interest Income', 30),
  ('Other Income', 40)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.income_categories c
  WHERE c.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND lower(c.name) = lower(v.name)
    AND c.deleted_at IS NULL
);

INSERT INTO public.expense_categories (organization_id, name, is_active, sort_order)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', v.name, true, v.sort_order
FROM (VALUES
  ('Rent', 10),
  ('Utilities', 20),
  ('Salaries', 30),
  ('Transport', 40),
  ('Marketing', 50),
  ('Supplies', 60),
  ('Other Expense', 70)
) AS v(name, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.expense_categories c
  WHERE c.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
    AND lower(c.name) = lower(v.name)
    AND c.deleted_at IS NULL
);

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

-- income_categories
DROP POLICY IF EXISTS income_categories_select ON public.income_categories;
CREATE POLICY income_categories_select ON public.income_categories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('income.create')
      OR public.user_has_permission('profit_loss.read')
    )
  );

DROP POLICY IF EXISTS income_categories_insert ON public.income_categories;
CREATE POLICY income_categories_insert ON public.income_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  );

DROP POLICY IF EXISTS income_categories_update ON public.income_categories;
CREATE POLICY income_categories_update ON public.income_categories
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  );

-- expense_categories
DROP POLICY IF EXISTS expense_categories_select ON public.expense_categories;
CREATE POLICY expense_categories_select ON public.expense_categories
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('expense.create')
      OR public.user_has_permission('profit_loss.read')
    )
  );

DROP POLICY IF EXISTS expense_categories_insert ON public.expense_categories;
CREATE POLICY expense_categories_insert ON public.expense_categories
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  );

DROP POLICY IF EXISTS expense_categories_update ON public.expense_categories;
CREATE POLICY expense_categories_update ON public.expense_categories
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('account_settings.manage')
    )
  );

-- income_entries
DROP POLICY IF EXISTS income_entries_select ON public.income_entries;
CREATE POLICY income_entries_select ON public.income_entries
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('income.create')
      OR public.user_has_permission('profit_loss.read')
    )
  );

DROP POLICY IF EXISTS income_entries_insert ON public.income_entries;
CREATE POLICY income_entries_insert ON public.income_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('income.create')
      OR public.user_has_permission('accounts.manage')
    )
  );

DROP POLICY IF EXISTS income_entries_update ON public.income_entries;
CREATE POLICY income_entries_update ON public.income_entries
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('transactions.void')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- expense_entries
DROP POLICY IF EXISTS expense_entries_select ON public.expense_entries;
CREATE POLICY expense_entries_select ON public.expense_entries
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('expense.create')
      OR public.user_has_permission('expense.approve')
      OR public.user_has_permission('profit_loss.read')
    )
  );

DROP POLICY IF EXISTS expense_entries_insert ON public.expense_entries;
CREATE POLICY expense_entries_insert ON public.expense_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('expense.create')
      OR public.user_has_permission('accounts.manage')
    )
  );

DROP POLICY IF EXISTS expense_entries_update ON public.expense_entries;
CREATE POLICY expense_entries_update ON public.expense_entries
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('expense.approve')
      OR public.user_has_permission('transactions.void')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- account_transfers
DROP POLICY IF EXISTS account_transfers_select ON public.account_transfers;
CREATE POLICY account_transfers_select ON public.account_transfers
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
    )
  );

DROP POLICY IF EXISTS account_transfers_insert ON public.account_transfers;
CREATE POLICY account_transfers_insert ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('accounts.manage')
  );

DROP POLICY IF EXISTS account_transfers_update ON public.account_transfers;
CREATE POLICY account_transfers_update ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('transactions.void')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- daily_closings
DROP POLICY IF EXISTS daily_closings_select ON public.daily_closings;
CREATE POLICY daily_closings_select ON public.daily_closings
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('daily_closing.create')
      OR public.user_has_permission('daily_closing.approve')
    )
  );

DROP POLICY IF EXISTS daily_closings_insert ON public.daily_closings;
CREATE POLICY daily_closings_insert ON public.daily_closings
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('daily_closing.create')
      OR public.user_has_permission('accounts.manage')
    )
  );

DROP POLICY IF EXISTS daily_closings_update ON public.daily_closings;
CREATE POLICY daily_closings_update ON public.daily_closings
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('daily_closing.approve')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('daily_closing.create')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- financial_transactions
DROP POLICY IF EXISTS financial_transactions_select ON public.financial_transactions;
CREATE POLICY financial_transactions_select ON public.financial_transactions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.read')
      OR public.user_has_permission('accounts.manage')
      OR public.user_has_permission('profit_loss.read')
    )
  );

DROP POLICY IF EXISTS financial_transactions_insert ON public.financial_transactions;
CREATE POLICY financial_transactions_insert ON public.financial_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('accounts.manage')
      OR public.user_has_permission('income.create')
      OR public.user_has_permission('expense.create')
      OR public.user_has_permission('accounts.post')
    )
  );

DROP POLICY IF EXISTS financial_transactions_update ON public.financial_transactions;
CREATE POLICY financial_transactions_update ON public.financial_transactions
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND (
      public.user_has_permission('transactions.void')
      OR public.user_has_permission('accounts.manage')
    )
  )
  WITH CHECK (organization_id = public.current_organization_id());

--------------------------------------------------------------------------------
-- Helper: adjust_financial_account_balance (row lock)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.adjust_financial_account_balance(
  p_account_id uuid,
  p_delta numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before numeric(14, 2);
  v_after numeric(14, 2);
BEGIN
  IF p_account_id IS NULL THEN
    RAISE EXCEPTION 'p_account_id is required';
  END IF;
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'p_delta is required';
  END IF;

  SELECT current_balance INTO v_before
  FROM public.financial_accounts
  WHERE id = p_account_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Financial account % not found', p_account_id;
  END IF;

  v_after := round(v_before + p_delta, 2);

  UPDATE public.financial_accounts
  SET current_balance = v_after,
      updated_at = timezone('utc', now())
  WHERE id = p_account_id;

  RETURN v_after;
END;
$$;

COMMENT ON FUNCTION public.adjust_financial_account_balance(uuid, numeric) IS
  'Locks financial_accounts row FOR UPDATE and applies delta to current_balance. Returns balance after.';

REVOKE ALL ON FUNCTION public.adjust_financial_account_balance(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_financial_account_balance(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_financial_account_balance(uuid, numeric) TO service_role;

--------------------------------------------------------------------------------
-- create_income(payload jsonb)
-- { branch_id, category_id, amount, account_id, entry_date?, reference?, note?,
--   attachment_path?, received_by?, client_txn_key? }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_income(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_category_id uuid;
  v_account_id uuid;
  v_amount numeric(14, 2);
  v_entry_date date;
  v_reference text;
  v_note text;
  v_attachment_path text;
  v_received_by uuid;
  v_client_txn_key text;
  v_existing uuid;
  v_entry_id uuid;
  v_before numeric(14, 2);
  v_after numeric(14, 2);
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('income.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission income.create or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_category_id := NULLIF(payload->>'category_id', '')::uuid;
  v_account_id := NULLIF(payload->>'account_id', '')::uuid;
  v_amount := NULLIF(payload->>'amount', '')::numeric;
  v_entry_date := coalesce(NULLIF(payload->>'entry_date', '')::date, (timezone('utc', now()))::date);
  v_note := NULLIF(payload->>'note', '');
  v_attachment_path := NULLIF(payload->>'attachment_path', '');
  v_received_by := coalesce(NULLIF(payload->>'received_by', '')::uuid, v_profile_id);
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_reference := NULLIF(payload->>'reference', '');

  IF v_client_txn_key IS NOT NULL THEN
    v_reference := 'CTX:' || v_client_txn_key;
  END IF;

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_category_id IS NULL THEN RAISE EXCEPTION 'category_id is required'; END IF;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'account_id is required'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  IF v_reference IS NOT NULL AND v_reference LIKE 'CTX:%' THEN
    SELECT id INTO v_existing
    FROM public.income_entries
    WHERE organization_id = v_org_id
      AND reference = v_reference
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.income_categories c
    WHERE c.id = v_category_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid income category';
  END IF;

  SELECT * INTO v_fa
  FROM public.financial_accounts fa
  WHERE fa.id = v_account_id
    AND fa.organization_id = v_org_id
    AND fa.deleted_at IS NULL
    AND fa.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid financial account';
  END IF;

  v_before := v_fa.current_balance;
  v_after := public.adjust_financial_account_balance(v_account_id, v_amount);

  INSERT INTO public.income_entries (
    organization_id, branch_id, category_id, amount, account_id,
    entry_date, reference, note, attachment_path, received_by, status,
    created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_category_id, v_amount, v_account_id,
    v_entry_date, v_reference, v_note, v_attachment_path, v_received_by, 'posted',
    v_profile_id, v_profile_id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, transaction_date, note, status, created_by
  ) VALUES (
    v_org_id, v_branch_id, v_account_id, 'income', 'in',
    v_amount, v_before, v_after, 'income_entry', v_entry_id,
    v_reference, timezone('utc', now()), v_note, 'posted', v_profile_id
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'income.create', 'income_entry', v_entry_id,
    NULL,
    jsonb_build_object(
      'amount', v_amount,
      'account_id', v_account_id,
      'category_id', v_category_id,
      'balance_after', v_after
    ),
    NULL,
    jsonb_build_object('source', 'create_income')
  );

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_income(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_income(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- create_expense(payload jsonb)
-- { branch_id, category_id, amount, account_id, entry_date?, payee?, reference?,
--   note?, attachment_path?, approval_required?, client_txn_key? }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_expense(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_category_id uuid;
  v_account_id uuid;
  v_amount numeric(14, 2);
  v_entry_date date;
  v_payee text;
  v_reference text;
  v_note text;
  v_attachment_path text;
  v_approval_required boolean;
  v_client_txn_key text;
  v_existing uuid;
  v_entry_id uuid;
  v_before numeric(14, 2);
  v_after numeric(14, 2);
  v_fa public.financial_accounts%ROWTYPE;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('expense.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission expense.create or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_category_id := NULLIF(payload->>'category_id', '')::uuid;
  v_account_id := NULLIF(payload->>'account_id', '')::uuid;
  v_amount := NULLIF(payload->>'amount', '')::numeric;
  v_entry_date := coalesce(NULLIF(payload->>'entry_date', '')::date, (timezone('utc', now()))::date);
  v_payee := NULLIF(payload->>'payee', '');
  v_note := NULLIF(payload->>'note', '');
  v_attachment_path := NULLIF(payload->>'attachment_path', '');
  v_approval_required := coalesce((payload->>'approval_required')::boolean, false);
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_reference := NULLIF(payload->>'reference', '');

  IF v_client_txn_key IS NOT NULL THEN
    v_reference := 'CTX:' || v_client_txn_key;
  END IF;

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_category_id IS NULL THEN RAISE EXCEPTION 'category_id is required'; END IF;
  IF v_account_id IS NULL THEN RAISE EXCEPTION 'account_id is required'; END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  IF v_reference IS NOT NULL AND v_reference LIKE 'CTX:%' THEN
    SELECT id INTO v_existing
    FROM public.expense_entries
    WHERE organization_id = v_org_id
      AND reference = v_reference
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.expense_categories c
    WHERE c.id = v_category_id
      AND c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND c.is_active = true
  ) THEN
    RAISE EXCEPTION 'Invalid expense category';
  END IF;

  SELECT * INTO v_fa
  FROM public.financial_accounts fa
  WHERE fa.id = v_account_id
    AND fa.organization_id = v_org_id
    AND fa.deleted_at IS NULL
    AND fa.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid financial account';
  END IF;

  IF v_fa.current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient account balance (%) for expense amount (%)',
      v_fa.current_balance, v_amount;
  END IF;

  v_before := v_fa.current_balance;
  v_after := public.adjust_financial_account_balance(v_account_id, -v_amount);

  INSERT INTO public.expense_entries (
    organization_id, branch_id, category_id, amount, account_id,
    entry_date, payee, reference, note, attachment_path,
    approval_required, status, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_category_id, v_amount, v_account_id,
    v_entry_date, v_payee, v_reference, v_note, v_attachment_path,
    v_approval_required, 'posted', v_profile_id, v_profile_id
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, transaction_date, note, status, created_by
  ) VALUES (
    v_org_id, v_branch_id, v_account_id, 'expense', 'out',
    v_amount, v_before, v_after, 'expense_entry', v_entry_id,
    v_reference, timezone('utc', now()), v_note, 'posted', v_profile_id
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'expense.create', 'expense_entry', v_entry_id,
    NULL,
    jsonb_build_object(
      'amount', v_amount,
      'account_id', v_account_id,
      'category_id', v_category_id,
      'balance_after', v_after
    ),
    NULL,
    jsonb_build_object('source', 'create_expense')
  );

  RETURN v_entry_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_expense(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_expense(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- transfer_account_balance(payload jsonb)
-- { branch_id, from_account_id, to_account_id, amount, transfer_date?,
--   reference?, note?, client_txn_key? }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_account_balance(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_from_id uuid;
  v_to_id uuid;
  v_amount numeric(14, 2);
  v_transfer_date date;
  v_reference text;
  v_note text;
  v_client_txn_key text;
  v_existing uuid;
  v_transfer_id uuid;
  v_from public.financial_accounts%ROWTYPE;
  v_to public.financial_accounts%ROWTYPE;
  v_from_before numeric(14, 2);
  v_from_after numeric(14, 2);
  v_to_before numeric(14, 2);
  v_to_after numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT public.user_has_permission('accounts.manage') THEN
    RAISE EXCEPTION 'Missing permission accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_from_id := NULLIF(payload->>'from_account_id', '')::uuid;
  v_to_id := NULLIF(payload->>'to_account_id', '')::uuid;
  v_amount := NULLIF(payload->>'amount', '')::numeric;
  v_transfer_date := coalesce(NULLIF(payload->>'transfer_date', '')::date, (timezone('utc', now()))::date);
  v_note := NULLIF(payload->>'note', '');
  v_client_txn_key := NULLIF(btrim(payload->>'client_txn_key'), '');
  v_reference := NULLIF(payload->>'reference', '');

  IF v_client_txn_key IS NOT NULL THEN
    v_reference := 'CTX:' || v_client_txn_key;
  END IF;

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_from_id IS NULL OR v_to_id IS NULL THEN
    RAISE EXCEPTION 'from_account_id and to_account_id are required';
  END IF;
  IF v_from_id = v_to_id THEN
    RAISE EXCEPTION 'from_account_id and to_account_id must differ';
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN RAISE EXCEPTION 'amount must be > 0'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  IF v_reference IS NOT NULL AND v_reference LIKE 'CTX:%' THEN
    SELECT id INTO v_existing
    FROM public.account_transfers
    WHERE organization_id = v_org_id
      AND reference = v_reference
      AND deleted_at IS NULL
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RETURN v_existing;
    END IF;
  END IF;

  -- Lock both accounts in stable id order to avoid deadlocks
  IF v_from_id < v_to_id THEN
    SELECT * INTO v_from FROM public.financial_accounts
    WHERE id = v_from_id AND organization_id = v_org_id AND deleted_at IS NULL AND is_active
    FOR UPDATE;
    SELECT * INTO v_to FROM public.financial_accounts
    WHERE id = v_to_id AND organization_id = v_org_id AND deleted_at IS NULL AND is_active
    FOR UPDATE;
  ELSE
    SELECT * INTO v_to FROM public.financial_accounts
    WHERE id = v_to_id AND organization_id = v_org_id AND deleted_at IS NULL AND is_active
    FOR UPDATE;
    SELECT * INTO v_from FROM public.financial_accounts
    WHERE id = v_from_id AND organization_id = v_org_id AND deleted_at IS NULL AND is_active
    FOR UPDATE;
  END IF;

  IF v_from.id IS NULL THEN RAISE EXCEPTION 'Invalid from_account_id'; END IF;
  IF v_to.id IS NULL THEN RAISE EXCEPTION 'Invalid to_account_id'; END IF;

  IF v_from.current_balance < v_amount THEN
    RAISE EXCEPTION 'Insufficient balance on from account (%) for transfer (%)',
      v_from.current_balance, v_amount;
  END IF;

  v_from_before := v_from.current_balance;
  v_to_before := v_to.current_balance;
  v_from_after := public.adjust_financial_account_balance(v_from_id, -v_amount);
  v_to_after := public.adjust_financial_account_balance(v_to_id, v_amount);

  INSERT INTO public.account_transfers (
    organization_id, branch_id, from_account_id, to_account_id, amount,
    transfer_date, reference, note, status, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_from_id, v_to_id, v_amount,
    v_transfer_date, v_reference, v_note, 'posted', v_profile_id, v_profile_id
  )
  RETURNING id INTO v_transfer_id;

  -- Out leg
  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, transaction_date, note, status, created_by
  ) VALUES (
    v_org_id, v_branch_id, v_from_id, 'transfer', 'out',
    v_amount, v_from_before, v_from_after, 'account_transfer', v_transfer_id,
    v_reference, timezone('utc', now()), v_note, 'posted', v_profile_id
  );

  -- In leg (same source_id)
  INSERT INTO public.financial_transactions (
    organization_id, branch_id, account_id, transaction_type, direction,
    amount, balance_before, balance_after, source_type, source_id,
    reference, transaction_date, note, status, created_by
  ) VALUES (
    v_org_id, v_branch_id, v_to_id, 'transfer', 'in',
    v_amount, v_to_before, v_to_after, 'account_transfer', v_transfer_id,
    v_reference, timezone('utc', now()), v_note, 'posted', v_profile_id
  );

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'transfer.create', 'account_transfer', v_transfer_id,
    NULL,
    jsonb_build_object(
      'amount', v_amount,
      'from_account_id', v_from_id,
      'to_account_id', v_to_id,
      'from_balance_after', v_from_after,
      'to_balance_after', v_to_after
    ),
    NULL,
    jsonb_build_object('source', 'transfer_account_balance')
  );

  RETURN v_transfer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.transfer_account_balance(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.transfer_account_balance(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- close_business_day(payload jsonb)
-- { branch_id, closing_date, counted_cash, opening_cash?, cash_sales?,
--   cash_collections?, other_cash_income?, cash_expenses?,
--   supplier_cash_payments?, cash_transfers_net?, note?, difference_reason? }
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_business_day(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_branch_id uuid;
  v_closing_date date;
  v_opening_cash numeric(14, 2);
  v_cash_sales numeric(14, 2);
  v_cash_collections numeric(14, 2);
  v_other_cash_income numeric(14, 2);
  v_cash_expenses numeric(14, 2);
  v_supplier_cash_payments numeric(14, 2);
  v_cash_transfers_net numeric(14, 2);
  v_counted_cash numeric(14, 2);
  v_expected numeric(14, 2);
  v_difference numeric(14, 2);
  v_note text;
  v_diff_reason text;
  v_existing uuid;
  v_closing_id uuid;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_computed_in numeric(14, 2);
  v_computed_out numeric(14, 2);
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('daily_closing.create')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission daily_closing.create or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_branch_id := NULLIF(payload->>'branch_id', '')::uuid;
  v_closing_date := NULLIF(payload->>'closing_date', '')::date;
  v_counted_cash := coalesce(NULLIF(payload->>'counted_cash', '')::numeric, 0);
  v_note := NULLIF(payload->>'note', '');
  v_diff_reason := NULLIF(payload->>'difference_reason', '');

  IF v_branch_id IS NULL THEN RAISE EXCEPTION 'branch_id is required'; END IF;
  IF v_closing_date IS NULL THEN RAISE EXCEPTION 'closing_date is required'; END IF;

  IF NOT public.user_has_branch_access(v_branch_id) THEN
    RAISE EXCEPTION 'No access to branch %', v_branch_id USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_existing
  FROM public.daily_closings
  WHERE branch_id = v_branch_id
    AND closing_date = v_closing_date
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Daily closing already exists for branch % on %', v_branch_id, v_closing_date;
  END IF;

  v_day_start := (v_closing_date::timestamp AT TIME ZONE 'UTC');
  v_day_end := v_day_start + interval '1 day';

  -- Optional payload fields; otherwise compute from cash-account financial_transactions
  IF payload ? 'opening_cash' AND NULLIF(payload->>'opening_cash', '') IS NOT NULL THEN
    v_opening_cash := (payload->>'opening_cash')::numeric;
  ELSE
    SELECT coalesce(sum(fa.opening_balance), 0) INTO v_opening_cash
    FROM public.financial_accounts fa
    WHERE fa.organization_id = v_org_id
      AND fa.deleted_at IS NULL
      AND fa.account_kind = 'cash'
      AND (fa.branch_id IS NULL OR fa.branch_id = v_branch_id);
  END IF;

  IF payload ? 'cash_sales' AND NULLIF(payload->>'cash_sales', '') IS NOT NULL THEN
    v_cash_sales := (payload->>'cash_sales')::numeric;
  ELSE
    v_cash_sales := 0;
  END IF;

  IF payload ? 'cash_collections' AND NULLIF(payload->>'cash_collections', '') IS NOT NULL THEN
    v_cash_collections := (payload->>'cash_collections')::numeric;
  ELSE
    v_cash_collections := 0;
  END IF;

  IF payload ? 'other_cash_income' AND NULLIF(payload->>'other_cash_income', '') IS NOT NULL THEN
    v_other_cash_income := (payload->>'other_cash_income')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_other_cash_income
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'in'
      AND ft.transaction_type IN ('income', 'other_income')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'cash_expenses' AND NULLIF(payload->>'cash_expenses', '') IS NOT NULL THEN
    v_cash_expenses := (payload->>'cash_expenses')::numeric;
  ELSE
    SELECT coalesce(sum(ft.amount), 0) INTO v_cash_expenses
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.direction = 'out'
      AND ft.transaction_type IN ('expense')
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
  END IF;

  IF payload ? 'supplier_cash_payments' AND NULLIF(payload->>'supplier_cash_payments', '') IS NOT NULL THEN
    v_supplier_cash_payments := (payload->>'supplier_cash_payments')::numeric;
  ELSE
    v_supplier_cash_payments := 0;
  END IF;

  IF payload ? 'cash_transfers_net' AND NULLIF(payload->>'cash_transfers_net', '') IS NOT NULL THEN
    v_cash_transfers_net := (payload->>'cash_transfers_net')::numeric;
  ELSE
    SELECT
      coalesce(sum(CASE WHEN ft.direction = 'in' THEN ft.amount ELSE 0 END), 0),
      coalesce(sum(CASE WHEN ft.direction = 'out' THEN ft.amount ELSE 0 END), 0)
    INTO v_computed_in, v_computed_out
    FROM public.financial_transactions ft
    JOIN public.financial_accounts fa ON fa.id = ft.account_id
    WHERE ft.organization_id = v_org_id
      AND ft.branch_id = v_branch_id
      AND ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'transfer'
      AND fa.account_kind = 'cash'
      AND ft.transaction_date >= v_day_start
      AND ft.transaction_date < v_day_end;
    v_cash_transfers_net := coalesce(v_computed_in, 0) - coalesce(v_computed_out, 0);
  END IF;

  v_expected := round(
    coalesce(v_opening_cash, 0)
    + coalesce(v_cash_sales, 0)
    + coalesce(v_cash_collections, 0)
    + coalesce(v_other_cash_income, 0)
    - coalesce(v_cash_expenses, 0)
    - coalesce(v_supplier_cash_payments, 0)
    + coalesce(v_cash_transfers_net, 0),
    2
  );
  v_difference := round(v_counted_cash - v_expected, 2);

  IF abs(v_difference) > 0.01 AND (v_diff_reason IS NULL OR length(btrim(v_diff_reason)) = 0) THEN
    RAISE EXCEPTION 'difference_reason is required when |difference| > 0.01 (difference=%)',
      v_difference;
  END IF;

  IF v_diff_reason IS NOT NULL THEN
    v_note := coalesce(v_note || E'\n', '') || 'Difference reason: ' || v_diff_reason;
  END IF;

  INSERT INTO public.daily_closings (
    organization_id, branch_id, closing_date,
    opening_cash, cash_sales, cash_collections, other_cash_income,
    cash_expenses, supplier_cash_payments, cash_transfers_net,
    expected_closing, counted_cash, difference, note,
    closed_by, status, closed_at, created_by, updated_by
  ) VALUES (
    v_org_id, v_branch_id, v_closing_date,
    coalesce(v_opening_cash, 0), coalesce(v_cash_sales, 0),
    coalesce(v_cash_collections, 0), coalesce(v_other_cash_income, 0),
    coalesce(v_cash_expenses, 0), coalesce(v_supplier_cash_payments, 0),
    coalesce(v_cash_transfers_net, 0),
    v_expected, v_counted_cash, v_difference, v_note,
    v_profile_id, 'closed', timezone('utc', now()), v_profile_id, v_profile_id
  )
  RETURNING id INTO v_closing_id;

  PERFORM public.write_audit_log(
    v_org_id, v_branch_id, v_profile_id,
    'daily_closing.create', 'daily_closing', v_closing_id,
    NULL,
    jsonb_build_object(
      'closing_date', v_closing_date,
      'expected_closing', v_expected,
      'counted_cash', v_counted_cash,
      'difference', v_difference
    ),
    v_diff_reason,
    jsonb_build_object('source', 'close_business_day')
  );

  RETURN v_closing_id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_business_day(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_business_day(jsonb) TO authenticated;

--------------------------------------------------------------------------------
-- void_financial_transaction(txn_id uuid, reason text)
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.void_financial_transaction(
  txn_id uuid,
  reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_org_id uuid;
  v_txn public.financial_transactions%ROWTYPE;
  v_sibling public.financial_transactions%ROWTYPE;
  v_delta numeric(14, 2);
  v_reason text;
BEGIN
  SELECT * INTO v_profile_id, v_org_id FROM public._auth_ctx();

  IF NOT (
    public.user_has_permission('transactions.void')
    OR public.user_has_permission('accounts.manage')
  ) THEN
    RAISE EXCEPTION 'Missing permission transactions.void or accounts.manage' USING ERRCODE = '42501';
  END IF;

  v_reason := NULLIF(btrim(reason), '');
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'void reason is required';
  END IF;
  IF txn_id IS NULL THEN
    RAISE EXCEPTION 'txn_id is required';
  END IF;

  SELECT * INTO v_txn
  FROM public.financial_transactions
  WHERE id = txn_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF v_txn.status = 'voided' THEN
    RAISE EXCEPTION 'Transaction already voided';
  END IF;

  -- Reverse this leg: in -> subtract, out -> add
  IF v_txn.direction = 'in' THEN
    v_delta := -v_txn.amount;
  ELSE
    v_delta := v_txn.amount;
  END IF;
  PERFORM public.adjust_financial_account_balance(v_txn.account_id, v_delta);

  UPDATE public.financial_transactions
  SET status = 'voided',
      voided_at = timezone('utc', now()),
      voided_by = v_profile_id,
      void_reason = v_reason,
      updated_at = timezone('utc', now())
  WHERE id = v_txn.id;

  -- Transfer pair: void sibling with same source_id (never leave one-sided)
  IF v_txn.source_type = 'account_transfer' AND v_txn.source_id IS NOT NULL THEN
    FOR v_sibling IN
      SELECT * FROM public.financial_transactions
      WHERE source_type = 'account_transfer'
        AND source_id = v_txn.source_id
        AND id <> v_txn.id
        AND organization_id = v_org_id
        AND deleted_at IS NULL
        AND status = 'posted'
      FOR UPDATE
    LOOP
      IF v_sibling.direction = 'in' THEN
        v_delta := -v_sibling.amount;
      ELSE
        v_delta := v_sibling.amount;
      END IF;
      PERFORM public.adjust_financial_account_balance(v_sibling.account_id, v_delta);

      UPDATE public.financial_transactions
      SET status = 'voided',
          voided_at = timezone('utc', now()),
          voided_by = v_profile_id,
          void_reason = v_reason,
          updated_at = timezone('utc', now())
      WHERE id = v_sibling.id;
    END LOOP;

    UPDATE public.account_transfers
    SET status = 'voided',
        updated_by = v_profile_id
    WHERE id = v_txn.source_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL;
  ELSIF v_txn.source_type = 'income_entry' AND v_txn.source_id IS NOT NULL THEN
    UPDATE public.income_entries
    SET status = 'voided',
        updated_by = v_profile_id
    WHERE id = v_txn.source_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL;
  ELSIF v_txn.source_type = 'expense_entry' AND v_txn.source_id IS NOT NULL THEN
    UPDATE public.expense_entries
    SET status = 'voided',
        updated_by = v_profile_id
    WHERE id = v_txn.source_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL;
  END IF;

  PERFORM public.write_audit_log(
    v_org_id, v_txn.branch_id, v_profile_id,
    'transaction.void', 'financial_transaction', v_txn.id,
    jsonb_build_object(
      'amount', v_txn.amount,
      'direction', v_txn.direction,
      'account_id', v_txn.account_id,
      'source_type', v_txn.source_type,
      'source_id', v_txn.source_id
    ),
    jsonb_build_object('status', 'voided'),
    v_reason,
    jsonb_build_object('source', 'void_financial_transaction')
  );

  RETURN v_txn.id;
END;
$$;

REVOKE ALL ON FUNCTION public.void_financial_transaction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_financial_transaction(uuid, text) TO authenticated;
