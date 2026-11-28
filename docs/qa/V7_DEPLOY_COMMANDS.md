# V7 Authorized Deploy Commands

Run only against the **authorized** Supabase project (`vahqinuminrcjpussimn` / linked project) after review.

## Prerequisites

```bash
cd /home/priom/Desktop/mahi
npx supabase login   # if needed
npx supabase link --project-ref vahqinuminrcjpussimn
```

Confirm remote migration history ends at `20260315000161` before applying.

## Database migrations (order)

```bash
npx supabase db push
# Or apply individually if required by process:
# 20260315000162_supplier_payment_journal_account.sql
# 20260315000163_employee_access_revocation.sql
# 20260315000164_store_archive_visibility.sql
# 20260315000165_archive_employee_rpc.sql
```

## Edge Function

```bash
npx supabase functions deploy admin-create-user --project-ref vahqinuminrcjpussimn
```

Verify:

```bash
curl -i -X OPTIONS \
  "https://vahqinuminrcjpussimn.supabase.co/functions/v1/admin-create-user" \
  -H "Origin: https://mahi-import.vercel.app" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,content-type,apikey"
# Expect HTTP 204 (or 200) with Access-Control-Allow-* headers — not 404.
```

## Frontend

Deploy the matching git commit to Vercel after DB + Edge are live.
