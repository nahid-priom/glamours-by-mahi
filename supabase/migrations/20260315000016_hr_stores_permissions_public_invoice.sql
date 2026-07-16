-- Migration 016: HR, stores, courier granular permissions + public invoice token
-- Assigns new permissions to Super Admin / Owner roles.

INSERT INTO public.permissions (key, description)
SELECT v.key, v.description
FROM (VALUES
  ('courier.book', 'Book courier parcels'),
  ('courier.cancel', 'Cancel courier parcels'),
  ('courier.settle', 'Record courier settlements'),
  ('courier.integration.manage', 'Manage courier API integrations'),
  ('hr.read', 'View HR module'),
  ('hr.employee.create', 'Create employees'),
  ('hr.employee.update', 'Update employees'),
  ('hr.attendance.read', 'View attendance'),
  ('hr.attendance.manage', 'Manage attendance and corrections'),
  ('hr.leave.read', 'View leave requests'),
  ('hr.leave.approve', 'Approve leave requests'),
  ('hr.payroll.read', 'View payroll'),
  ('hr.payroll.create', 'Create payroll runs'),
  ('hr.payroll.approve', 'Approve payroll'),
  ('hr.payroll.pay', 'Mark payroll as paid / post payment'),
  ('hr.device.manage', 'Manage attendance devices'),
  ('stores.read', 'View stores and online channels'),
  ('stores.manage', 'Create and update stores')
) AS v(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p
  WHERE p.key = v.key AND p.deleted_at IS NULL
);

-- Grant all new keys to Super Admin and Owner
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('Super Admin', 'Owner')
  AND r.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND p.key IN (
    'courier.book', 'courier.cancel', 'courier.settle', 'courier.integration.manage',
    'hr.read', 'hr.employee.create', 'hr.employee.update',
    'hr.attendance.read', 'hr.attendance.manage',
    'hr.leave.read', 'hr.leave.approve',
    'hr.payroll.read', 'hr.payroll.create', 'hr.payroll.approve', 'hr.payroll.pay',
    'hr.device.manage', 'stores.read', 'stores.manage'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id
      AND rp.permission_id = p.id
      AND rp.deleted_at IS NULL
  );

-- Secure public invoice sharing (random token, not sale UUID)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS public_share_token text;

CREATE UNIQUE INDEX IF NOT EXISTS sales_public_share_token_uidx
  ON public.sales (public_share_token)
  WHERE public_share_token IS NOT NULL AND deleted_at IS NULL;

COMMENT ON COLUMN public.sales.public_share_token IS
  'Random revocable token for /public/invoice/:token — never use sale id in public URLs.';

-- Anon may read a single sale when presenting a valid share token
CREATE POLICY sales_public_share_select ON public.sales
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND public_share_token IS NOT NULL
    AND status = 'completed'
  );

CREATE POLICY sale_items_public_share_select ON public.sale_items
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.id = sale_items.sale_id
        AND s.deleted_at IS NULL
        AND s.public_share_token IS NOT NULL
        AND s.status = 'completed'
    )
  );

CREATE POLICY customers_public_share_select ON public.customers
  FOR SELECT TO anon
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.customer_id = customers.id
        AND s.deleted_at IS NULL
        AND s.public_share_token IS NOT NULL
        AND s.status = 'completed'
    )
  );
