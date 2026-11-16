-- Inventory Overview 360 — reporting contract smoke tests
BEGIN;

SELECT plan(12);

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

SELECT has_function(
  'public',
  'get_inventory_variant_breakdown',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'integer', 'integer', 'text', 'text', 'boolean']
);

SELECT has_function(
  'public',
  'get_inventory_low_stock',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'integer', 'integer', 'text', 'text', 'boolean']
);

SELECT has_function(
  'public',
  'export_inventory_stock',
  ARRAY['uuid', 'uuid', 'text', 'uuid', 'uuid', 'text', 'boolean', 'text', 'integer', 'integer']
);

SELECT has_function('public', 'seed_inventory_presence', ARRAY['jsonb']);
SELECT has_function('public', '_inventory_search_matches', ARRAY['uuid', 'text', 'text', 'text', 'text', 'text', 'uuid']);
SELECT has_function('public', '_inventory_in_transit_qty', ARRAY['uuid', 'uuid', 'uuid']);
SELECT has_function('public', '_inventory_stock_status', ARRAY['numeric', 'numeric']);

-- Status helper contract
SELECT is(
  public._inventory_stock_status(-1, 5),
  'negative_stock',
  'negative available → negative_stock'
);

SELECT is(
  public._inventory_stock_status(0, 5),
  'out_of_stock',
  'zero available → out_of_stock'
);

SELECT * FROM finish();
ROLLBACK;
