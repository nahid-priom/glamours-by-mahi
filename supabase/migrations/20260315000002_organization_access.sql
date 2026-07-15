-- Glamourous by Mahi · Retail ERP
-- Migration 002: Organizations, branches, profiles, roles, permissions, RLS

--------------------------------------------------------------------------------
-- organizations
--------------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  currency text NOT NULL DEFAULT 'BDT',
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT organizations_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT organizations_currency_len CHECK (char_length(currency) BETWEEN 3 AND 3)
);

CREATE UNIQUE INDEX organizations_slug_active_uidx
  ON public.organizations (slug)
  WHERE deleted_at IS NULL;

CREATE INDEX organizations_deleted_at_idx ON public.organizations (deleted_at);

CREATE TRIGGER organizations_set_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- branches
--------------------------------------------------------------------------------
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  code text NOT NULL,
  name text NOT NULL,
  address text,
  phone text,
  is_central boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX branches_org_code_active_uidx
  ON public.branches (organization_id, code)
  WHERE deleted_at IS NULL;

-- At most one central branch per organization (active)
CREATE UNIQUE INDEX branches_org_central_active_uidx
  ON public.branches (organization_id)
  WHERE deleted_at IS NULL AND is_central = true;

CREATE INDEX branches_organization_id_idx ON public.branches (organization_id);
CREATE INDEX branches_org_active_idx
  ON public.branches (organization_id, is_active)
  WHERE deleted_at IS NULL;

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- roles
--------------------------------------------------------------------------------
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX roles_org_name_active_uidx
  ON public.roles (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX roles_organization_id_idx ON public.roles (organization_id);

CREATE TRIGGER roles_set_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- permissions (global catalog)
--------------------------------------------------------------------------------
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid,
  CONSTRAINT permissions_key_format CHECK (key ~ '^[a-z][a-z0-9_.]*$')
);

CREATE UNIQUE INDEX permissions_key_active_uidx
  ON public.permissions (key)
  WHERE deleted_at IS NULL;

CREATE TRIGGER permissions_set_updated_at
  BEFORE UPDATE ON public.permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.permissions (key, description) VALUES
  ('dashboard.read', 'View dashboard KPIs and widgets'),
  ('pos.create', 'Create POS sales'),
  ('pos.discount', 'Apply discounts at POS'),
  ('pos.price_override', 'Override unit prices at POS'),
  ('sales.read', 'View sales history and invoices'),
  ('sales.correct', 'Correct completed sales'),
  ('sales.void', 'Void completed sales'),
  ('sales.return.review', 'Approve or reject sales / courier returns'),
  ('products.read', 'View products, categories, brands, variants'),
  ('products.create', 'Create products and related masters'),
  ('products.update', 'Update products and related masters'),
  ('inventory.read', 'View stock balances and ledger'),
  ('inventory.adjust', 'Create stock adjustments'),
  ('inventory.transfer', 'Create inter-branch stock transfers'),
  ('purchases.read', 'View purchases and purchase returns'),
  ('purchases.create', 'Create purchases and supplier payments'),
  ('customers.read', 'View customers and ledgers'),
  ('customers.manage', 'Create and update customers'),
  ('suppliers.read', 'View suppliers and ledgers'),
  ('suppliers.manage', 'Create and update suppliers'),
  ('courier.read', 'View courier companies and parcels'),
  ('courier.manage', 'Manage courier setup, booking, settlements'),
  ('accounts.read', 'View accounting reports and ledgers'),
  ('accounts.post', 'Post journals and financial transactions'),
  ('reports.read', 'View analytics reports'),
  ('settings.manage', 'Manage organization, branches, roles, users'),
  ('audit.read', 'View audit and activity logs');

--------------------------------------------------------------------------------
-- role_permissions
--------------------------------------------------------------------------------
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX role_permissions_active_uidx
  ON public.role_permissions (role_id, permission_id)
  WHERE deleted_at IS NULL;

CREATE INDEX role_permissions_role_id_idx ON public.role_permissions (role_id);
CREATE INDEX role_permissions_permission_id_idx ON public.role_permissions (permission_id);

CREATE TRIGGER role_permissions_set_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
--------------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  role_id uuid REFERENCES public.roles (id),
  default_branch_id uuid REFERENCES public.branches (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX profiles_org_email_active_uidx
  ON public.profiles (organization_id, lower(email))
  WHERE deleted_at IS NULL;

CREATE INDEX profiles_organization_id_idx ON public.profiles (organization_id);
CREATE INDEX profiles_role_id_idx ON public.profiles (role_id);
CREATE INDEX profiles_default_branch_id_idx ON public.profiles (default_branch_id);

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- user_branch_access
--------------------------------------------------------------------------------
CREATE TABLE public.user_branch_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches (id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  created_by uuid,
  updated_by uuid
);

CREATE UNIQUE INDEX user_branch_access_active_uidx
  ON public.user_branch_access (user_id, branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX user_branch_access_branch_id_idx ON public.user_branch_access (branch_id);
CREATE INDEX user_branch_access_organization_id_idx ON public.user_branch_access (organization_id);

CREATE TRIGGER user_branch_access_set_updated_at
  BEFORE UPDATE ON public.user_branch_access
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

--------------------------------------------------------------------------------
-- Deferred audit FKs (profiles must exist first)
--------------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT organizations_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.branches
  ADD CONSTRAINT branches_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT branches_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.roles
  ADD CONSTRAINT roles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT roles_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.permissions
  ADD CONSTRAINT permissions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT permissions_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.role_permissions
  ADD CONSTRAINT role_permissions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT role_permissions_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT profiles_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

ALTER TABLE public.user_branch_access
  ADD CONSTRAINT user_branch_access_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles (id),
  ADD CONSTRAINT user_branch_access_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES public.profiles (id);

--------------------------------------------------------------------------------
-- RLS
--------------------------------------------------------------------------------
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_branch_access ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY organizations_select ON public.organizations
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND id = public.current_organization_id()
  );

CREATE POLICY organizations_update ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- branches
CREATE POLICY branches_select ON public.branches
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      public.user_has_branch_access(id)
      OR public.user_has_permission('settings.manage')
    )
  );

CREATE POLICY branches_insert ON public.branches
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY branches_update ON public.branches
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- profiles
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      id = public.current_profile_id()
      OR public.user_has_permission('settings.manage')
    )
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      id = public.current_profile_id()
      OR public.user_has_permission('settings.manage')
    )
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      id = public.current_profile_id()
      OR public.user_has_permission('settings.manage')
    )
  );

-- roles
CREATE POLICY roles_select ON public.roles
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY roles_insert ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY roles_update ON public.roles
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

-- permissions (catalog: readable by org members; mutations via service role / seed)
CREATE POLICY permissions_select ON public.permissions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND public.current_organization_id() IS NOT NULL
  );

-- role_permissions
CREATE POLICY role_permissions_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id = public.current_organization_id()
        AND r.deleted_at IS NULL
    )
  );

CREATE POLICY role_permissions_insert ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_has_permission('settings.manage')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_id
        AND r.organization_id = public.current_organization_id()
        AND r.deleted_at IS NULL
    )
  );

CREATE POLICY role_permissions_update ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (
    public.user_has_permission('settings.manage')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_permissions.role_id
        AND r.organization_id = public.current_organization_id()
    )
  )
  WITH CHECK (
    public.user_has_permission('settings.manage')
    AND EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id = role_id
        AND r.organization_id = public.current_organization_id()
    )
  );

-- user_branch_access
CREATE POLICY user_branch_access_select ON public.user_branch_access
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND (
      user_id = public.current_profile_id()
      OR public.user_has_permission('settings.manage')
    )
  );

CREATE POLICY user_branch_access_insert ON public.user_branch_access
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );

CREATE POLICY user_branch_access_update ON public.user_branch_access
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.user_has_permission('settings.manage')
  );
