-- Migration 078: Moderator / Tele Salesman roles and granular permissions

INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('moderator.dashboard.read', 'View moderator dashboard'),
  ('moderator.order.create', 'Create moderator online orders'),
  ('moderator.order.update_own', 'Update own moderator orders'),
  ('moderator.order.read_own', 'Read own moderator orders'),
  ('orders.approve', 'Approve online orders'),
  ('orders.assign', 'Assign online orders to tele-sales'),
  ('exchange.read', 'View product exchanges'),
  ('exchange.create', 'Create product exchanges'),
  ('exchange.cancel', 'Cancel product exchanges'),
  ('exchange.refund', 'Refund exchange difference'),
  ('product_variant.image.manage', 'Manage product variant images')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = x.key AND p.deleted_at IS NULL
);

INSERT INTO public.roles (id, organization_id, name, description, is_system)
VALUES
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc4',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Moderator',
    'Manual online order intake (phone, social, tele)',
    true
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc5',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Tele Salesman',
    'Review and process assigned online orders',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Owner + Super Admin get all new keys
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)
  AND p.key IN (
    'moderator.dashboard.read',
    'moderator.order.create',
    'moderator.order.update_own',
    'moderator.order.read_own',
    'orders.approve',
    'orders.assign',
    'orders.read',
    'orders.fulfil',
    'orders.cancel',
    'exchange.read',
    'exchange.create',
    'exchange.cancel',
    'exchange.refund',
    'product_variant.image.manage'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

-- Moderator curated set
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id = 'cccccccc-cccc-cccc-cccc-ccccccccccc4'
  AND p.key IN (
    'dashboard.read',
    'moderator.dashboard.read',
    'moderator.order.create',
    'moderator.order.update_own',
    'moderator.order.read_own',
    'orders.read',
    'customers.read',
    'customers.manage',
    'products.read',
    'inventory.read'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );

-- Tele Salesman curated set
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id = 'cccccccc-cccc-cccc-cccc-ccccccccccc5'
  AND p.key IN (
    'dashboard.read',
    'orders.read',
    'orders.approve',
    'orders.fulfil',
    'orders.cancel',
    'customers.read',
    'products.read',
    'inventory.read',
    'sales.read'
  )
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );
