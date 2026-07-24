import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const src = fs
  .readFileSync(
    path.join(root, 'supabase/migrations/20260315000065_canonical_party_ledger_accounting.sql'),
    'utf8',
  )
  .replace(/\r\n/g, '\n')

const saleOld = `  ELSE
    v_due_total := 0;
    IF v_due_paid > 0 THEN
      RAISE EXCEPTION 'Due payment not allowed when fully paid in cash/bank';
    END IF;
  END IF;`

const saleNew = `  ELSE
    -- Fully covered by declared payments (cash-only, due-only, or split)
    IF v_paid_total >= v_grand_total THEN
      v_due_total := 0;
      IF v_due_paid > 0 THEN
        RAISE EXCEPTION 'Due payment not allowed when fully paid in cash/bank';
      END IF;
    ELSE
      v_due_total := round(v_grand_total - v_paid_total, 2);
      IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
        RAISE EXCEPTION 'Due payment amount must equal remaining balance';
      END IF;
    END IF;
  END IF;`

const purchaseOld = `  ELSE
    v_due_total := 0;
    IF v_due_paid > 0 THEN
      RAISE EXCEPTION 'Due payment not allowed when fully paid';
    END IF;
  END IF;`

const purchaseNew = `  ELSE
    IF v_paid_total >= v_grand_total THEN
      v_due_total := 0;
      IF v_due_paid > 0 THEN
        RAISE EXCEPTION 'Due payment not allowed when fully paid';
      END IF;
    ELSE
      v_due_total := round(v_grand_total - v_paid_total, 2);
      IF v_due_paid > 0 AND abs(v_due_paid - v_due_total) > 0.009 THEN
        RAISE EXCEPTION 'Due payment amount must equal remaining balance';
      END IF;
    END IF;
  END IF;`

function extractFn(source, name) {
  const sig = `CREATE OR REPLACE FUNCTION public.${name}`
  const start = source.indexOf(sig)
  const end = source.indexOf(`REVOKE ALL ON FUNCTION public.${name}`, start)
  if (start < 0 || end < 0) throw new Error(`Missing ${name}`)
  return source.slice(start, end)
}

let saleFn = extractFn(src, '_complete_pos_sale_core')
if (!saleFn.includes(saleOld)) throw new Error('sale block not found')
saleFn = saleFn.replace(saleOld, saleNew)

let purchaseFn = extractFn(src, '_complete_purchase_core')
if (!purchaseFn.includes(purchaseOld)) throw new Error('purchase block not found')
purchaseFn = purchaseFn.replace(purchaseOld, purchaseNew)

const out = `-- Fix due/credit sales when receivable payment fully covers the invoice total
-- Bug: ELSE branch treated due_paid >= grand_total as "fully paid cash" and rejected valid due sales.

${saleFn}
REVOKE ALL ON FUNCTION public._complete_pos_sale_core(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._complete_pos_sale_core(jsonb) TO service_role;

${purchaseFn}
REVOKE ALL ON FUNCTION public._complete_purchase_core(jsonb) FROM PUBLIC, anon, authenticated;
`

const outPath = path.join(
  root,
  'supabase/migrations/20260315000066_fix_pos_due_payment_calculation.sql',
)
fs.writeFileSync(outPath, out)
console.log('Wrote', outPath, out.length, 'bytes')
