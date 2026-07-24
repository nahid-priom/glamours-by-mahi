-- ERP acceptance scenario smoke tests (function + schema presence)
BEGIN;

SELECT plan(18);

SELECT has_function('public', '_complete_pos_sale_core', ARRAY['jsonb']::text[]);
SELECT has_function('public', 'receive_stock_transfer', ARRAY['uuid', 'jsonb', 'boolean']::text[]);
SELECT has_function('public', 'record_courier_cod_receivable', ARRAY['uuid']::text[]);
SELECT has_function('public', 'settle_courier_settlement', ARRAY['jsonb']::text[]);
SELECT has_function('public', 'approve_purchase_return', ARRAY['jsonb']::text[]);
SELECT has_function('public', 'approve_sales_return', ARRAY['jsonb']::text[]);
SELECT has_function('public', '_accrue_sale_commission', ARRAY['uuid']::text[]);
SELECT has_function('public', 'approve_sales_commission', ARRAY['uuid']::text[]);
SELECT has_function('public', 'pay_sales_commission', ARRAY['jsonb']::text[]);
SELECT has_function('public', 'get_inventory_valuation_summary', ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'boolean']::text[]);

SELECT has_column('public', 'inventory_balances', 'average_unit_cost');
SELECT has_column('public', 'stock_transfer_items', 'quantity_damaged');
SELECT has_column('public', 'courier_settlements', 'client_txn_key');
SELECT has_table('public', 'salesman_commissions');
SELECT has_table('public', 'salesman_commission_rules');

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'stock_transfers_status_check'
      AND pg_get_constraintdef(oid) LIKE '%partially_received%'
  ),
  'stock_transfers supports partially_received status'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = '_adjust_inventory'
  ),
  '_adjust_inventory engine present'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chart_of_accounts'
      AND column_name = 'system_role'
  ),
  'chart_of_accounts system_role present'
);

SELECT * FROM finish();
ROLLBACK;
