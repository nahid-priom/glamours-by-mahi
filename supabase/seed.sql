-- Glamourous by Mahi · base seed (org, branches, roles, permissions grants)
-- After this: create an Auth user in Dashboard, then insert profiles + user_branch_access.

insert into public.organizations (id, name, slug, currency, settings)
values (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Glamourous by Mahi',
  'glamourous-by-mahi',
  'BDT',
  '{"fiscal_year_start_month": 7}'::jsonb
)
on conflict (id) do nothing;

insert into public.branches (id, organization_id, code, name, address, phone, is_central, is_active)
values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'HQ', 'Head Office / Central Warehouse', 'Dhaka', '01700000000', true, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'BNG', 'Bashundhara City', 'Dhaka', '01700000001', false, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'JAM', 'Jamuna Future Park', 'Dhaka', '01700000002', false, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'GP', 'Gulshan Pink City', 'Dhaka', '01700000003', false, true),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MTJ', 'Mirpur Taj Tower', 'Dhaka', '01700000004', false, true)
on conflict (id) do nothing;

insert into public.roles (id, organization_id, name, description, is_system)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Owner', 'Full access', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Super Admin', 'Full access', true),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Salesperson', 'POS and customers', true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'cccccccc-cccc-cccc-cccc-ccccccccccc1', p.id
from public.permissions p
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc1'
    and rp.permission_id = p.id
    and rp.deleted_at is null
);

insert into public.role_permissions (role_id, permission_id)
select 'cccccccc-cccc-cccc-cccc-ccccccccccc2', p.id
from public.permissions p
where not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc2'
    and rp.permission_id = p.id
    and rp.deleted_at is null
);

insert into public.role_permissions (role_id, permission_id)
select 'cccccccc-cccc-cccc-cccc-ccccccccccc3', p.id
from public.permissions p
where p.key in (
  'dashboard.read', 'pos.create', 'sales.read', 'customers.read', 'customers.manage',
  'products.read', 'inventory.read'
)
and not exists (
  select 1 from public.role_permissions rp
  where rp.role_id = 'cccccccc-cccc-cccc-cccc-ccccccccccc3'
    and rp.permission_id = p.id
    and rp.deleted_at is null
);

insert into public.account_groups (id, organization_id, name, account_class, sort_order)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Assets', 'asset', 10),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Liabilities', 'liability', 20),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Equity', 'equity', 30),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd4', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Revenue', 'revenue', 40),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd5', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Expenses', 'expense', 50)
on conflict (id) do nothing;

-- After creating auth user in Dashboard, run:
-- insert into public.profiles (id, organization_id, full_name, email, role_id, default_branch_id, is_active)
-- values (
--   '<auth-user-uuid>',
--   'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
--   'Mahi Rahman',
--   'owner@glamourousbymahi.com',
--   'cccccccc-cccc-cccc-cccc-ccccccccccc1',
--   'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
--   true
-- );
--
-- insert into public.user_branch_access (organization_id, user_id, branch_id)
-- select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '<auth-user-uuid>', b.id
-- from public.branches b
-- where b.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
