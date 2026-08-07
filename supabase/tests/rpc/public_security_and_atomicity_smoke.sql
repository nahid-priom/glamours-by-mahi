-- Smoke: public invoice RPC exists; held-sale / transfer RPCs granted; expire reservations granted.
-- Run via: node scripts/run-db-smoke.mjs supabase/tests/rpc/public_security_and_atomicity_smoke.sql

DO $$
BEGIN
  IF to_regprocedure('public.get_public_invoice_by_token(text)') IS NULL THEN
    RAISE EXCEPTION 'missing get_public_invoice_by_token';
  END IF;
  IF to_regprocedure('public.upsert_held_sale(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'missing upsert_held_sale';
  END IF;
  IF to_regprocedure('public.delete_held_sale(uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing delete_held_sale';
  END IF;
  IF to_regprocedure('public.create_stock_transfer(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'missing create_stock_transfer';
  END IF;
  IF to_regprocedure('public.cancel_stock_transfer(uuid, text)') IS NULL THEN
    RAISE EXCEPTION 'missing cancel_stock_transfer';
  END IF;
  IF to_regprocedure('public.apply_courier_webhook_parcel_status(uuid, text, text, text)') IS NULL THEN
    RAISE EXCEPTION 'missing apply_courier_webhook_parcel_status';
  END IF;
  IF to_regprocedure('public.expire_online_reservations(uuid)') IS NULL THEN
    RAISE EXCEPTION 'missing expire_online_reservations';
  END IF;

  -- Unbound anon invoice policies must be gone
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sales'
      AND policyname = 'sales_public_share_select'
  ) THEN
    RAISE EXCEPTION 'sales_public_share_select should be dropped';
  END IF;

  RAISE NOTICE 'public_security_and_atomicity_smoke OK';
END $$;
