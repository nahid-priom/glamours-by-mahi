# Supabase deploy checklist

## 1. Environment

`.env.local` (gitignored via `*.local`):

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Never put the service-role key in the Vite app.

## 2. Apply migrations

From the repo root (with [Supabase CLI](https://supabase.com/docs/guides/cli) linked to the project):

```bash
npx supabase link --project-ref vahqinuminrcjpussimn
npx supabase db push
```

Or paste each file in `supabase/migrations/` into the SQL editor in order:

1. `20260315000001_extensions_and_helpers.sql`
2. `20260315000002_organization_access.sql`
3. `20260315000003_products_inventory.sql`
4. `20260315000004_customers_suppliers_sales.sql`
5. `20260315000005_accounting_courier_governance.sql`
6. `20260315000006_complete_pos_sale_rpc.sql`
7. `20260315000007_product_images_storage.sql`
8. `20260315000008_business_rpcs.sql`
9. `20260315000009_rich_seed.sql`
10. `20260315000010_ensure_storage_bucket.sql`
11. `20260315000011_simple_retail_accounting.sql`
12. `20260315000012_simple_accounting_rpc_hardening.sql`
13. `20260315000013_approve_sales_return.sql`

The `product-images` storage bucket is created by migration `010` (private bucket + RLS from `007`).

## 3. Seed + first user

Base org/branches/roles were seeded via `supabase/seed.sql`.

1. In Supabase Dashboard → Authentication → Users → **Add user** (email + password).
2. Copy the user UUID, then run SQL (replace `<auth-user-uuid>`):

```sql
insert into public.profiles (id, organization_id, full_name, email, role_id, default_branch_id, is_active)
values (
  '<auth-user-uuid>',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Mahi Rahman',
  'owner@yourdomain.com',
  'cccccccc-cccc-cccc-cccc-ccccccccccc1', -- Owner
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  true
);

insert into public.user_branch_access (organization_id, user_id, branch_id)
select 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '<auth-user-uuid>', b.id
from public.branches b
where b.organization_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  and b.deleted_at is null;
```

3. Sign in at `/admin/login` with that email/password.
4. Create private Storage bucket `product-images` if not created by migration policies alone.

## 4. Courier webhook

Deploy `supabase/functions/courier-webhook` and set secrets:

- `COURIER_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Function only)

## 5. Verify

```bash
npm run typecheck
npm run test
npm run build
```

Open `/sales/pos` after login; barcode + complete sale call `complete_pos_sale`.
