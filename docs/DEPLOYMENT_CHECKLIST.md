# Production deployment checklist

## Database

1. Apply forward migrations only (`119`–`121` and later) — never edit applied migrations.
2. Confirm `get_public_invoice_by_token` works; unbound `sales_public_share_select` is dropped.
3. Confirm `pg_cron` job `expire_online_reservations_15m` or schedule an external cron invoking `expire_online_reservations(NULL)` every 15 minutes as `service_role`.
4. Regenerate types: `npm run db:types` (or `db:types:linked`).

## Edge functions

1. Deploy `place-online-order` with **no** open proxy (set `PLACE_ONLINE_ORDER_PROXY_SECRET` only for trusted callers; prefer direct RPC).
2. Deploy `courier-steadfast` — requires JWT + `courier.book` / `courier.integration.manage`.
3. Deploy `courier-webhook` with strong `COURIER_WEBHOOK_SECRET`; uses `apply_courier_webhook_parcel_status`.
4. Never expose `SUPABASE_SERVICE_ROLE_KEY` to the Vite client.

## App verify

```bash
npm run typecheck
npm run lint
npm run test
npm run test:routes
npm run build
npm run db:test:p0   # with local/linked DB
```

## Manual QA (critical paths)

- [ ] Walk-in cash POS sale + thermal/A4 print
- [ ] Due sale + later collection (stable `client_txn_key`, no double post)
- [ ] Online COD → approve → fulfill → courier webhook delivered → COD receivable
- [ ] Purchase → supplier payment
- [ ] Exchange with difference + print receipt
- [ ] Branch transfer draft → dispatch → partial receive; cancel draft/in-transit
- [ ] Public invoice link (token only; cannot list other sales as anon)
- [ ] Storefront product payload has no `purchase_price`
- [ ] Attendance → payroll calculate (direct-mode commissions excluded)
- [ ] Commission approve → payroll allocation blocks direct pay
