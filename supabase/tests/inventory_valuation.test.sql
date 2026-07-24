-- Inventory valuation RPC smoke tests (pgTAP when available)
BEGIN;

SELECT plan(8);

SELECT has_function(
  'public',
  'get_inventory_valuation_summary',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'boolean']
);

SELECT has_function(
  'public',
  'get_inventory_branch_summary',
  ARRAY['boolean']
);

SELECT has_function(
  'public',
  'get_inventory_stock_breakdown',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'integer', 'integer', 'text', 'text', 'boolean']
);

SELECT has_function('public', 'backfill_inventory_average_costs', ARRAY[]::text[]);
SELECT has_function('public', '_user_can_view_inventory_cost', ARRAY[]::text[]);

-- Internal backfill should not be public
SELECT throws_ok(
  $$ SELECT public.backfill_inventory_average_costs() $$,
  '42501',
  NULL,
  'backfill denied without privilege'
);

-- Valuation summary requires auth context
SELECT throws_ok(
  $$ SELECT * FROM public.get_inventory_valuation_summary() $$,
  'P0001',
  NULL,
  'valuation summary requires organization context'
);

SELECT has_column('public', 'inventory_balances', 'average_unit_cost');
SELECT has_column('public', 'inventory_balances', 'cost_is_fallback');

SELECT * FROM finish();
ROLLBACK;
