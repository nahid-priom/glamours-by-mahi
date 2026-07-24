import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const pos041 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260315000041_pos_sale_wac_inventory_engine.sql'),
  'utf8',
)
const biz008 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260315000008_business_rpcs.sql'),
  'utf8',
)
const mig033 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260315000033_purchase_return_and_collection_allocation.sql'),
  'utf8',
)
const mig026 = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260315000026_sales_history_lifecycle.sql'),
  'utf8',
)
const helpers = fs.readFileSync(path.join(root, 'scripts/_helpers_party_ledger.sql'), 'utf8')

function extractFn(source, name, args) {
  const sig = `CREATE OR REPLACE FUNCTION public.${name}(${args})`
  const start = source.indexOf(sig)
  if (start < 0) throw new Error(`Function ${name} not found`)
  const end = source.indexOf(`REVOKE ALL ON FUNCTION public.${name}`, start)
  if (end < 0) throw new Error(`End of ${name} not found`)
  return source.slice(start, end)
}

// --- purchase core ---
let purchaseCore = extractFn(biz008, 'complete_purchase', 'payload jsonb').replace(
  'public.complete_purchase',
  'public._complete_purchase_core',
)
purchaseCore = purchaseCore.replace(
  /  IF v_due_total > 0 THEN[\s\S]*?  END IF;\r?\n\r?\n  v_inv_coa := public\._coa_by_role/,
  `  PERFORM public._apply_supplier_purchase_canonical_ledger(v_purchase_id, v_profile_id);

  v_inv_coa := public._coa_by_role`,
)

// --- pos core ---
let posCore = pos041
posCore = posCore.replace(
  /    v_cost_price := COALESCE\(NULLIF\(v_balance\.average_unit_cost, 0\), v_variant\.purchase_price, 0\);\r?\n    v_subtotal := v_subtotal \+ round\(v_qty \* v_unit_price, 2\);\r?\n    v_cogs_total := v_cogs_total \+ round\(v_qty \* v_cost_price, 2\);\r?\n\r?\n    SELECT \* INTO v_balance/,
  `    SELECT * INTO v_balance`,
)
posCore = posCore.replace(
  /    IF v_balance\.quantity < v_qty THEN[\s\S]*?    END IF;\r?\n  END LOOP;\r?\n\r?\n  -- Header discount permission/,
  `    IF v_balance.quantity < v_qty THEN
      RAISE EXCEPTION 'Insufficient stock for variant % (have %, need %)',
        v_variant.id, v_balance.quantity, v_qty;
    END IF;

    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);
    v_cogs_total := v_cogs_total + round(v_qty * v_cost_price, 2);
  END LOOP;

  -- Header discount permission`,
)
posCore = posCore.replace(
  /  -- Customer ledger if due[\s\S]*?  END IF;\r?\n\r?\n  -- Stub balanced journal/,
  `  IF v_customer_id IS NOT NULL THEN
    PERFORM public._apply_customer_sale_canonical_ledger(v_sale_id, v_profile_id);
  END IF;

  -- Stub balanced journal`,
)

// --- collect_customer_due ---
let collectFn = extractFn(mig033, 'collect_customer_due', 'payload jsonb')
collectFn = collectFn.replace(
  /  IF v_amount > v_customer\.current_due AND NOT coalesce\(v_allow_advance, false\) THEN\r?\n    RAISE EXCEPTION 'Collection amount % exceeds customer due %', v_amount, v_customer\.current_due;\r?\n  END IF;\r?\n\r?\n  -- Non-negative due constraint: never go below zero unless advance supported\r?\n  IF NOT coalesce\(v_allow_advance, false\) THEN\r?\n    NULL;\r?\n  ELSIF v_amount > v_customer\.current_due THEN\r?\n    RAISE EXCEPTION 'Customer advances are configured but current_due cannot go negative; split advance into a separate credit workflow';\r?\n  END IF;/,
  `  IF v_amount > v_customer.current_due THEN
    IF NOT coalesce(v_allow_advance, false) THEN
      RAISE EXCEPTION 'Collection amount % exceeds customer due %', v_amount, v_customer.current_due;
    END IF;
  END IF;`,
)
collectFn = collectFn.replace(
  /  UPDATE public\.customers\r?\n  SET current_due = current_due - v_amount,\r?\n      total_paid = total_paid \+ v_amount,\r?\n      updated_by = v_profile_id\r?\n  WHERE id = v_customer_id\r?\n  RETURNING \* INTO v_customer;\r?\n\r?\n  INSERT INTO public\.customer_ledger \([\s\S]*?  \);/,
  `  PERFORM public._post_customer_ledger_entry(
    v_org_id, v_branch_id, v_customer_id,
    'collection', 0, v_amount,
    'collection', v_collection_id,
    coalesce(v_note, 'Due collection ' || v_client_txn_key),
    v_profile_id,
    v_amount, 0
  );

  SELECT * INTO v_customer FROM public.customers WHERE id = v_customer_id;`,
)

// --- pay_supplier ---
let payFn = extractFn(mig033, 'pay_supplier', 'payload jsonb')
payFn = payFn.replace(
  /  UPDATE public\.suppliers\r?\n  SET current_due = current_due - v_amount,\r?\n      updated_by = v_profile_id\r?\n  WHERE id = v_supplier_id\r?\n  RETURNING \* INTO v_supplier;\r?\n\r?\n  INSERT INTO public\.supplier_ledger \([\s\S]*?  \);/,
  `  PERFORM public._post_supplier_ledger_entry(
    v_org_id, v_branch_id, v_supplier_id,
    'supplier_payment', 0, v_amount,
    'supplier_payment', v_payment_id,
    coalesce(v_note, 'Supplier payment ' || v_client_txn_key),
    v_profile_id
  );

  SELECT * INTO v_supplier FROM public.suppliers WHERE id = v_supplier_id;`,
)

// --- void_sale ---
let voidFn = extractFn(mig026, 'void_sale', 'sale_id uuid, reason text')
voidFn = voidFn.replace(
  /  IF v_sale\.customer_id IS NOT NULL THEN[\s\S]*?  END IF;\r?\n\r?\n  v_rev_journal := public\._reverse_journal_for_source/,
  `  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, btrim(reason));
  END IF;

  v_rev_journal := public._reverse_journal_for_source`,
)

// --- edit_sale reverse leg ---
let editFn = extractFn(mig026, 'edit_sale', 'payload jsonb')
editFn = editFn.replace(
  /  IF v_sale\.customer_id IS NOT NULL THEN[\s\S]*?  END IF;\r?\n\r?\n  v_rev_journal := public\._reverse_journal_for_source\(\r?\n    v_org_id, v_sale\.branch_id, 'sale', v_sale\.id,\r?\n    'Edit reverse '/,
  `  IF v_sale.customer_id IS NOT NULL THEN
    PERFORM public._reverse_customer_sale_canonical_ledger(v_sale.id, v_profile_id, v_reason);
  END IF;

  v_rev_journal := public._reverse_journal_for_source(
    v_org_id, v_sale.branch_id, 'sale', v_sale.id,
    'Edit reverse '`,
)

const tail = `
--------------------------------------------------------------------------------
-- Historical backfill: rebuild canonical customer/supplier ledgers for all parties
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sync_customer_ledger_totals(p_customer_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.customers c
  SET current_due = greatest(0, coalesce((
        SELECT sum(cl.debit - cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
      ), 0)),
      total_spent = coalesce((
        SELECT sum(s.grand_total)
        FROM public.sales s
        WHERE s.customer_id = c.id
          AND s.deleted_at IS NULL
          AND s.status = 'completed'
      ), 0),
      total_paid = coalesce((
        SELECT sum(cl.credit)
        FROM public.customer_ledger cl
        WHERE cl.customer_id = c.id
          AND cl.deleted_at IS NULL
          AND cl.entry_type IN ('sale_payment', 'collection')
      ), 0)
  WHERE c.deleted_at IS NULL
    AND (p_customer_id IS NULL OR c.id = p_customer_id);
END;
$$;

CREATE OR REPLACE FUNCTION public._sync_supplier_ledger_totals(p_supplier_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.suppliers s
  SET current_due = greatest(0, coalesce((
        SELECT sum(sl.debit - sl.credit)
        FROM public.supplier_ledger sl
        WHERE sl.supplier_id = s.id
          AND sl.deleted_at IS NULL
      ), 0))
  WHERE s.deleted_at IS NULL
    AND (p_supplier_id IS NULL OR s.id = p_supplier_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_customer_sale_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  UPDATE public.customer_ledger cl
  SET deleted_at = timezone('utc', now()),
      notes = coalesce(cl.notes, '') || ' [superseded by canonical backfill]'
  FROM public.sales s
  WHERE cl.reference_type = 'sale'
    AND cl.reference_id = s.id
    AND cl.entry_type = 'sale_due'
    AND cl.deleted_at IS NULL
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND s.customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.customer_ledger inv
      WHERE inv.customer_id = s.customer_id
        AND inv.reference_type = 'sale'
        AND inv.reference_id = s.id
        AND inv.entry_type = 'sale_invoice'
        AND inv.deleted_at IS NULL
    );

  FOR r IN
    SELECT s.id AS sale_id, s.created_by
    FROM public.sales s
    WHERE s.deleted_at IS NULL
      AND s.status = 'completed'
      AND s.customer_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_ledger cl
        WHERE cl.customer_id = s.customer_id
          AND cl.reference_type = 'sale'
          AND cl.reference_id = s.id
          AND cl.entry_type = 'sale_invoice'
          AND cl.deleted_at IS NULL
      )
    ORDER BY s.created_at, s.id
  LOOP
    PERFORM public._apply_customer_sale_canonical_ledger(
      r.sale_id,
      coalesce(r.created_by, public.current_profile_id()),
      true
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public._sync_customer_ledger_totals();

  RETURN jsonb_build_object('sales_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_customer_collection_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      ft.organization_id,
      ft.branch_id,
      ft.source_id AS collection_id,
      (al.after_data->>'customer_id')::uuid AS customer_id,
      sum(ft.amount) AS amount,
      max(coalesce(ft.note, al.reason, 'Due collection backfill')) AS notes,
      (array_agg(coalesce(ft.created_by, al.actor_id) ORDER BY ft.transaction_date))[1] AS actor
    FROM public.financial_transactions ft
    JOIN public.audit_logs al
      ON al.entity_type = 'collection'
     AND al.entity_id = ft.source_id
     AND al.action = 'collection.create'
    WHERE ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'customer_collection'
      AND ft.source_type = 'collection'
      AND ft.source_id IS NOT NULL
      AND (al.after_data->>'customer_id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.customer_ledger cl
        WHERE cl.reference_type = 'collection'
          AND cl.reference_id = ft.source_id
          AND cl.entry_type = 'collection'
          AND cl.deleted_at IS NULL
      )
    GROUP BY ft.organization_id, ft.branch_id, ft.source_id, (al.after_data->>'customer_id')::uuid
    ORDER BY min(ft.transaction_date), ft.source_id
  LOOP
    PERFORM public._post_customer_ledger_entry(
      r.organization_id, r.branch_id, r.customer_id,
      'collection', 0, r.amount,
      'collection', r.collection_id,
      r.notes,
      r.actor,
      0, 0,
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('collections_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_supplier_purchase_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  UPDATE public.supplier_ledger sl
  SET deleted_at = timezone('utc', now()),
      notes = coalesce(sl.notes, '') || ' [superseded by canonical backfill]'
  FROM public.purchases p
  WHERE sl.reference_type = 'purchase'
    AND sl.reference_id = p.id
    AND sl.entry_type = 'purchase_due'
    AND sl.deleted_at IS NULL
    AND p.deleted_at IS NULL
    AND p.status = 'completed'
    AND NOT EXISTS (
      SELECT 1
      FROM public.supplier_ledger inv
      WHERE inv.supplier_id = p.supplier_id
        AND inv.reference_type = 'purchase'
        AND inv.reference_id = p.id
        AND inv.entry_type = 'purchase_invoice'
        AND inv.deleted_at IS NULL
    );

  FOR r IN
    SELECT p.id AS purchase_id, p.created_by
    FROM public.purchases p
    WHERE p.deleted_at IS NULL
      AND p.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM public.supplier_ledger sl
        WHERE sl.supplier_id = p.supplier_id
          AND sl.reference_type = 'purchase'
          AND sl.reference_id = p.id
          AND sl.entry_type = 'purchase_invoice'
          AND sl.deleted_at IS NULL
      )
    ORDER BY p.created_at, p.id
  LOOP
    PERFORM public._apply_supplier_purchase_canonical_ledger(
      r.purchase_id,
      coalesce(r.created_by, public.current_profile_id()),
      true
    );
    v_count := v_count + 1;
  END LOOP;

  PERFORM public._sync_supplier_ledger_totals();

  RETURN jsonb_build_object('purchases_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_canonical_supplier_payment_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int := 0;
  r record;
BEGIN
  FOR r IN
    SELECT
      ft.organization_id,
      ft.branch_id,
      ft.source_id AS payment_id,
      (al.after_data->>'supplier_id')::uuid AS supplier_id,
      sum(ft.amount) AS amount,
      max(coalesce(ft.note, al.reason, 'Supplier payment backfill')) AS notes,
      (array_agg(coalesce(ft.created_by, al.actor_id) ORDER BY ft.transaction_date))[1] AS actor
    FROM public.financial_transactions ft
    JOIN public.audit_logs al
      ON al.entity_type = 'supplier_payment'
     AND al.entity_id = ft.source_id
     AND al.action = 'supplier_payment.create'
    WHERE ft.deleted_at IS NULL
      AND ft.status = 'posted'
      AND ft.transaction_type = 'supplier_payment'
      AND ft.source_type = 'supplier_payment'
      AND ft.source_id IS NOT NULL
      AND (al.after_data->>'supplier_id') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.supplier_ledger sl
        WHERE sl.reference_type = 'supplier_payment'
          AND sl.reference_id = ft.source_id
          AND sl.entry_type = 'supplier_payment'
          AND sl.deleted_at IS NULL
      )
    GROUP BY ft.organization_id, ft.branch_id, ft.source_id, (al.after_data->>'supplier_id')::uuid
    ORDER BY min(ft.transaction_date), ft.source_id
  LOOP
    PERFORM public._post_supplier_ledger_entry(
      r.organization_id, r.branch_id, r.supplier_id,
      'supplier_payment', 0, r.amount,
      'supplier_payment', r.payment_id,
      r.notes,
      r.actor,
      true
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('supplier_payments_backfilled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_all_party_ledgers()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_sales jsonb;
  v_collections jsonb;
  v_purchases jsonb;
  v_payments jsonb;
  v_opening jsonb;
BEGIN
  v_sales := public.backfill_canonical_customer_sale_ledgers();
  v_collections := public.backfill_canonical_customer_collection_ledgers();
  v_purchases := public.backfill_canonical_supplier_purchase_ledgers();
  v_payments := public.backfill_canonical_supplier_payment_ledgers();
  v_opening := public.backfill_party_opening_ledgers();

  PERFORM public._sync_customer_ledger_totals();
  PERFORM public._sync_supplier_ledger_totals();

  RETURN jsonb_build_object(
    'sales', v_sales,
    'collections', v_collections,
    'purchases', v_purchases,
    'supplier_payments', v_payments,
    'opening', v_opening
  );
END;
$$;

SELECT public.backfill_all_party_ledgers();

REVOKE ALL ON FUNCTION public._sync_customer_ledger_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._sync_supplier_ledger_totals(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_customer_sale_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_customer_collection_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_supplier_purchase_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_canonical_supplier_payment_ledgers() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.backfill_all_party_ledgers() FROM PUBLIC;

REVOKE ALL ON FUNCTION public._complete_purchase_core(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.collect_customer_due(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_supplier(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.edit_sale(jsonb) TO authenticated;
`

const header = `-- Canonical party ledger accounting repair

ALTER TABLE public.customer_ledger DROP CONSTRAINT IF EXISTS customer_ledger_entry_type_check;
ALTER TABLE public.customer_ledger ADD CONSTRAINT customer_ledger_entry_type_check
  CHECK (entry_type IN (
    'sale_invoice', 'sale_payment', 'sale_due', 'collection', 'return_credit',
    'refund', 'reversal', 'adjustment', 'opening'
  ));

ALTER TABLE public.supplier_ledger DROP CONSTRAINT IF EXISTS supplier_ledger_entry_type_check;
ALTER TABLE public.supplier_ledger ADD CONSTRAINT supplier_ledger_entry_type_check
  CHECK (entry_type IN (
    'purchase_invoice', 'purchase_payment', 'purchase_due', 'payment', 'supplier_payment',
    'return_credit', 'refund', 'reversal', 'adjustment', 'opening'
  ));

CREATE INDEX IF NOT EXISTS customer_ledger_customer_occurred_idx
  ON public.customer_ledger (customer_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS supplier_ledger_supplier_occurred_idx
  ON public.supplier_ledger (supplier_id, occurred_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS sales_customer_due_open_idx
  ON public.sales (customer_id, created_at, id)
  WHERE deleted_at IS NULL AND status = 'completed' AND due_total > 0;
CREATE INDEX IF NOT EXISTS purchases_supplier_due_open_idx
  ON public.purchases (supplier_id, created_at, id)
  WHERE deleted_at IS NULL AND status = 'completed' AND due_total > 0;

`

const out = path.join(root, 'supabase/migrations/20260315000065_canonical_party_ledger_accounting.sql')
fs.writeFileSync(
  out,
  [
    header,
    helpers,
    posCore,
    purchaseCore,
    collectFn,
    payFn,
    voidFn,
    editFn,
    tail,
  ].join('\n\n'),
)
console.log('Wrote', out, fs.statSync(out).size, 'bytes')
