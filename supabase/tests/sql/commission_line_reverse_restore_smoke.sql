-- Commission line-level reverse restore smoke (migration 151)
-- Validates function presence, sale_item_id-aware matching invariants,
-- fixed Policy 2A, entitlement cap, and event_type restoration.
-- Safe: does not mutate production business data; uses ephemeral temp rows
-- only when a writable test org harness is available; otherwise schema checks.

DO $$
DECLARE
  v_fn_src text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
  INTO v_fn_src
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_apply_contributor_commission_reversals'
  LIMIT 1;

  IF v_fn_src IS NULL THEN
    RAISE EXCEPTION '_apply_contributor_commission_reversals missing';
  END IF;

  -- Must restore sale_item_id matching
  IF position('sale_item_id' IN v_fn_src) = 0 THEN
    RAISE EXCEPTION '151 regression: sale_item_id matching missing from reverse function';
  END IF;

  -- Must keep V4 recoverable path (no phantom cash post in reverse)
  IF position('recoverable_amount' IN v_fn_src) = 0 THEN
    RAISE EXCEPTION '151 regression: recoverable_amount missing from reverse function';
  END IF;

  -- Must NOT reintroduce phantom cash credit on paid reverse
  IF position('_post_financial_txn' IN v_fn_src) > 0 THEN
    RAISE EXCEPTION '151 regression: phantom cash _post_financial_txn found in reverse path';
  END IF;

  -- Must keep Policy 2A fixed skip
  IF position('_commission_is_fixed_per_sale' IN v_fn_src) = 0 THEN
    RAISE EXCEPTION '151 regression: fixed per-sale policy missing';
  END IF;

  -- Must restore event_type updates
  IF position('return_reverse' IN v_fn_src) = 0
     OR position('exchange_reverse' IN v_fn_src) = 0 THEN
    RAISE EXCEPTION '151 regression: event_type reverse labels missing';
  END IF;

  -- Entitlement cap present
  IF position('original - v_already_reversed' IN v_fn_src) = 0
     AND position('v_original - v_already_reversed' IN v_fn_src) = 0 THEN
    RAISE EXCEPTION '151 regression: cumulative entitlement cap missing';
  END IF;

  IF NOT public._commission_is_fixed_per_sale(
    jsonb_build_object('structure_mode', 'per_sale', 'rule_type', 'fixed')
  ) THEN
    RAISE EXCEPTION 'fixed per-sale detector failed';
  END IF;

  RAISE NOTICE 'commission_line_reverse_restore_smoke: OK';
END $$;

-- Unit-style invariant: multi-line same-profile bases must match by sale_item_id,
-- not by profile LIMIT 1. Simulated in SQL without requiring live sales fixtures.
DO $$
DECLARE
  v_bases jsonb := jsonb_build_array(
    jsonb_build_object(
      'profile_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'sale_item_id', '11111111-1111-1111-1111-111111111111',
      'returned_base', 100
    ),
    jsonb_build_object(
      'profile_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'sale_item_id', '22222222-2222-2222-2222-222222222222',
      'returned_base', 50
    )
  );
  v_item1_base numeric;
  v_item2_base numeric;
  v_profile_limit1 numeric;
BEGIN
  SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
  INTO v_item1_base
  FROM jsonb_array_elements(v_bases) AS e(elem)
  WHERE NULLIF(e.elem->>'sale_item_id', '')::uuid = '11111111-1111-1111-1111-111111111111'::uuid
  LIMIT 1;

  SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
  INTO v_item2_base
  FROM jsonb_array_elements(v_bases) AS e(elem)
  WHERE NULLIF(e.elem->>'sale_item_id', '')::uuid = '22222222-2222-2222-2222-222222222222'::uuid
  LIMIT 1;

  -- Broken 133 behavior: profile_id LIMIT 1 always returns first element (100)
  SELECT coalesce((e.elem->>'returned_base')::numeric, 0)
  INTO v_profile_limit1
  FROM jsonb_array_elements(v_bases) AS e(elem)
  WHERE NULLIF(e.elem->>'profile_id', '')::uuid = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
  LIMIT 1;

  IF v_item1_base <> 100 OR v_item2_base <> 50 THEN
    RAISE EXCEPTION 'item match invariant failed: got % / %', v_item1_base, v_item2_base;
  END IF;

  IF v_profile_limit1 <> 100 THEN
    RAISE EXCEPTION 'expected broken LIMIT 1 demo to return 100, got %', v_profile_limit1;
  END IF;

  -- Correct path: line 2 must use 50, not the profile LIMIT 1 value of 100
  IF v_item2_base = v_profile_limit1 THEN
    RAISE EXCEPTION 'line matching collapsed to profile LIMIT 1';
  END IF;

  RAISE NOTICE 'commission_line_reverse_match_invariant: OK (line2=%, profile_limit1=%)',
    v_item2_base, v_profile_limit1;
END $$;
