-- Product 360 Audit V2.1 — Phase 1 migration / schema / barcode recon
-- Read-only verification (no DML).

\echo '=== Migration versions 00135 / 00136 ==='
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version LIKE '20260315000135%'
   OR version LIKE '20260315000136%'
ORDER BY version;

\echo '=== Objects: product_barcodes + key functions ==='
SELECT
  to_regclass('public.product_barcodes') IS NOT NULL AS has_product_barcodes,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'allocate_internal_barcode'
  ) AS has_allocate_internal_barcode,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pos_lookup_variant_by_barcode'
  ) AS has_pos_lookup,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '_adjust_inventory'
  ) AS has_adjust_inventory,
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_opening_stock'
  ) AS has_create_opening_stock,
  EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'product_barcodes_org_code_norm_uidx'
  ) AS has_barcode_unique_idx,
  EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'product_barcodes'
  ) AND EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'product_barcodes' AND c.relrowsecurity
  ) AS product_barcodes_rls_enabled;

\echo '=== Catalog checksums ==='
SELECT
  (SELECT count(*) FROM public.products WHERE deleted_at IS NULL) AS products,
  (SELECT count(*) FROM public.product_variants WHERE deleted_at IS NULL) AS variants,
  (SELECT count(*) FROM public.product_variants WHERE deleted_at IS NULL AND barcode IS NOT NULL AND btrim(barcode) <> '') AS variants_with_barcode,
  (SELECT count(*) FROM public.product_barcodes WHERE deleted_at IS NULL) AS registry_rows,
  (SELECT count(*) FROM public.product_barcodes WHERE deleted_at IS NULL AND conflict_flag) AS conflict_flagged,
  (SELECT count(*) FROM public.stock_ledger WHERE deleted_at IS NULL AND idempotency_key IS NOT NULL) AS ledger_with_idempotency_key;

\echo '=== Registry coverage vs variant barcodes ==='
SELECT
  count(*) FILTER (
    WHERE pv.barcode IS NOT NULL AND btrim(pv.barcode) <> ''
      AND EXISTS (
        SELECT 1 FROM public.product_barcodes pb
        WHERE pb.organization_id = pv.organization_id
          AND pb.deleted_at IS NULL
          AND pb.code_normalized = public.normalize_barcode(pv.barcode)
      )
  ) AS variant_barcodes_in_registry,
  count(*) FILTER (
    WHERE pv.barcode IS NOT NULL AND btrim(pv.barcode) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.product_barcodes pb
        WHERE pb.organization_id = pv.organization_id
          AND pb.deleted_at IS NULL
          AND pb.code_normalized = public.normalize_barcode(pv.barcode)
      )
  ) AS variant_barcodes_missing_registry
FROM public.product_variants pv
WHERE pv.deleted_at IS NULL;

\echo '=== Ambiguous / conflict barcode groups (top 20) ==='
SELECT organization_id, code_normalized, count(*) AS cnt,
       count(DISTINCT variant_id) AS distinct_variants
FROM public.product_barcodes
WHERE deleted_at IS NULL AND code_normalized IS NOT NULL
GROUP BY organization_id, code_normalized
HAVING count(*) > 1 OR count(DISTINCT variant_id) > 1
ORDER BY cnt DESC
LIMIT 20;

\echo '=== stock_ledger.idempotency_key column ==='
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'stock_ledger'
    AND column_name = 'idempotency_key'
) AS has_idempotency_key_column;
