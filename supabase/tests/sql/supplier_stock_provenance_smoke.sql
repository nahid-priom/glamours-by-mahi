-- Supplier Stock 360 smoke (run after 00140/00141)
SELECT has_function('public', 'backfill_inventory_receipt_sources', ARRAY[]::text[]);
SELECT has_function('public', 'get_supplier_stock_kpis');
SELECT has_function('public', 'get_supplier_stock_summary');
SELECT has_function('public', 'get_supplier_stock_breakdown');
SELECT has_function('public', 'get_supplier_stock_movements');
SELECT has_table('public', 'inventory_receipt_sources');
SELECT has_table('public', 'inventory_source_allocations');
SELECT has_table('public', 'inventory_source_positions');
