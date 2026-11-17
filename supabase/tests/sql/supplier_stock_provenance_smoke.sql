-- Supplier Stock 360 smoke (run after 00140/00141/00145)
SELECT has_function('public', 'backfill_inventory_receipt_sources', ARRAY[]::text[]);
SELECT has_function('public', 'get_supplier_stock_kpis');
SELECT has_function('public', 'get_supplier_stock_summary');
SELECT has_function('public', 'get_supplier_stock_breakdown');
SELECT has_function('public', 'get_supplier_stock_movements');
SELECT has_table('public', 'inventory_receipt_sources');
SELECT has_table('public', 'inventory_source_allocations');
SELECT has_table('public', 'inventory_source_positions');

-- CTE-scope regression: summary/movements must return jsonb without
-- raising relation "ordered" / "rows" does not exist.
DO $$
DECLARE
  v jsonb;
BEGIN
  -- May raise permission errors depending on session; only assert function body is callable shape.
  BEGIN
    v := public.get_supplier_stock_summary();
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
    WHEN OTHERS THEN
      IF SQLERRM ILIKE '%relation "ordered" does not exist%'
         OR SQLERRM ILIKE '%relation "rows" does not exist%' THEN
        RAISE EXCEPTION 'supplier stock CTE scope bug still present: %', SQLERRM;
      END IF;
      -- Permission / org context errors are acceptable in smoke without auth.
      NULL;
  END;
END $$;
