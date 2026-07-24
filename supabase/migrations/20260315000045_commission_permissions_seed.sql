-- Ensure commission permissions exist (idempotent follow-up)
INSERT INTO public.permissions (key, description)
SELECT x.key, x.description
FROM (VALUES
  ('sales.commission.read', 'View salesperson commissions'),
  ('sales.commission.approve', 'Approve salesperson commissions'),
  ('sales.commission.pay', 'Pay salesperson commissions')
) AS x(key, description)
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions p WHERE p.key = x.key AND p.deleted_at IS NULL
);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.id IN (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2'
)
  AND p.key IN ('sales.commission.read', 'sales.commission.approve', 'sales.commission.pay')
  AND p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id AND rp.deleted_at IS NULL
  );
