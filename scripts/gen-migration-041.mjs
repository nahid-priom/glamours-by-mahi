import fs from 'fs'

const src = fs.readFileSync('supabase/migrations/20260315000006_complete_pos_sale_rpc.sql', 'utf8').replace(/\r\n/g, '\n')
const start = src.indexOf('CREATE OR REPLACE FUNCTION public.complete_pos_sale')
const end = src.indexOf('COMMENT ON FUNCTION public.complete_pos_sale')
let fn = src.slice(start, end)
fn = fn.replace(
  'CREATE OR REPLACE FUNCTION public.complete_pos_sale',
  'CREATE OR REPLACE FUNCTION public._complete_pos_sale_core',
)
fn = fn.replace(
  `    v_cost_price := coalesce(v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);`,
  `    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);
    v_subtotal := v_subtotal + round(v_qty * v_unit_price, 2);`,
)

const old = `    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);
    v_cost_price := coalesce(v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price, created_by, updated_by
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      v_line_discount, v_line_total, v_cost_price, v_profile_id, v_profile_id
    );

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    v_qty_before := v_balance.quantity;
    v_qty_after := v_qty_before - v_qty;

    UPDATE public.inventory_balances
    SET quantity = v_qty_after,
        updated_by = v_profile_id
    WHERE id = v_balance.id;

    INSERT INTO public.stock_ledger (
      organization_id, branch_id, variant_id, location_id,
      quantity_delta, quantity_before, quantity_after, unit_cost,
      movement_type, reference_type, reference_id, created_by, updated_by
    ) VALUES (
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      -v_qty, v_qty_before, v_qty_after, v_cost_price,
      'sale', 'sale', v_sale_id, v_profile_id, v_profile_id
    );`

const neu = `    v_line_total := round((v_qty * v_unit_price) - v_line_discount, 2);

    SELECT * INTO v_balance
    FROM public.inventory_balances ib
    WHERE ib.variant_id = v_variant.id
      AND ib.location_id = v_location_id
      AND ib.organization_id = v_org_id
      AND ib.deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory balance for variant %', v_variant.id;
    END IF;

    v_cost_price := COALESCE(NULLIF(v_balance.average_unit_cost, 0), v_variant.purchase_price, 0);

    INSERT INTO public.sale_items (
      organization_id, sale_id, variant_id, qty, unit_price,
      line_discount, line_total, cost_price, created_by, updated_by
    ) VALUES (
      v_org_id, v_sale_id, v_variant.id, v_qty, v_unit_price,
      v_line_discount, v_line_total, v_cost_price, v_profile_id, v_profile_id
    );

    PERFORM public._adjust_inventory(
      v_org_id, v_branch_id, v_variant.id, v_location_id,
      -v_qty, 0, 'sale', 'sale', v_sale_id,
      v_profile_id, 'POS sale ' || v_invoice_no
    );`

if (!fn.includes(old)) {
  console.error('old block not found')
  process.exit(1)
}
fn = fn.replace(old, neu)

const header = `-- Glamourous by Mahi · POS sale core routes stock through WAC engine
-- Replaces direct inventory_balances updates with _adjust_inventory (migration 039).

`
const footer = `
REVOKE ALL ON FUNCTION public._complete_pos_sale_core(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._complete_pos_sale_core(jsonb) TO service_role;

COMMENT ON FUNCTION public._complete_pos_sale_core(jsonb) IS
  'POS sale core: WAC cost snapshot on sale_items, stock via _adjust_inventory.';
`
fs.writeFileSync(
  'supabase/migrations/20260315000041_pos_sale_wac_inventory_engine.sql',
  header + fn + footer,
)
console.log('written')
