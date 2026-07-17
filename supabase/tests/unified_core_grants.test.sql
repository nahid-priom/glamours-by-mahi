-- pgTAP-style smoke checks for unified core grants (run via psql / supabase test db)
-- Requires pgtap extension when available; otherwise run as plain SQL assertions.

BEGIN;

SELECT plan(6);

-- Internal helpers must not be executable by authenticated
SELECT throws_ok(
  $$ SELECT public._post_financial_txn(
       'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
       'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
       '00000000-0000-0000-0000-000000000001',
       'test', 'in', 1, 'test', NULL, 'r', 'n', NULL, true
     ) $$,
  '42501',
  NULL,
  '_post_financial_txn denied to caller without privilege'
);

SELECT has_function('public', 'place_online_order', ARRAY['jsonb']);
SELECT has_function('public', 'fulfil_online_order', ARRAY['jsonb']);
SELECT has_function('public', 'approve_purchase_return', ARRAY['jsonb']);
SELECT has_function('public', 'get_reconciliation_report', ARRAY['jsonb']);
SELECT has_function('public', 'recon_opening_stock_ledger', ARRAY['jsonb']);

SELECT * FROM finish();
ROLLBACK;
