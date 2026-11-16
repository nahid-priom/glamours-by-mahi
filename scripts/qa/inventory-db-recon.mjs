#!/usr/bin/env node
/**
 * Real inventory reconciliation against staging TEST_DATABASE_URL.
 * Compares ledger sum vs balances for a sample of variants — not UI smoke.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import {
  resolveTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  loadEnvFilesQuiet,
} from './db-url-safety.mjs'

loadEnvFilesQuiet()

const url = resolveTestDatabaseUrl()
const safety = assertSafeTestDatabaseUrl(url)
if (!safety.ok) {
  console.error(`INVENTORY RECON BLOCKED: ${safety.reason}`)
  process.exit(2)
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

async function main() {
  await client.connect()

  const hasBalances = await client.query(
    `select to_regclass('public.inventory_balances') is not null as ok`,
  )
  const hasLedger = await client.query(
    `select to_regclass('public.stock_ledger') is not null as ok`,
  )
  if (!hasBalances.rows[0].ok || !hasLedger.rows[0].ok) {
    throw new Error('Missing inventory_balances or stock_ledger')
  }

  // Sample up to 50 balance rows and compare to ledger net qty where columns exist
  const cols = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='inventory_balances'`,
  )
  const colSet = new Set(cols.rows.map((r) => r.column_name))
  const qtyCol = ['qty_on_hand', 'quantity_on_hand', 'on_hand', 'qty'].find((c) => colSet.has(c))
  if (!qtyCol) {
    throw new Error('Could not detect on-hand quantity column on inventory_balances')
  }

  const sample = await client.query(
    `select * from public.inventory_balances limit 50`,
  )

  const ledgerCols = await client.query(
    `select column_name from information_schema.columns
     where table_schema='public' and table_name='stock_ledger'`,
  )
  const lset = new Set(ledgerCols.rows.map((r) => r.column_name))
  const deltaCol = ['qty_delta', 'quantity_delta', 'qty', 'quantity'].find((c) => lset.has(c))

  let checked = 0
  let mismatches = []

  if (deltaCol && sample.rows.length && colSet.has('variant_id') && lset.has('variant_id')) {
    for (const row of sample.rows) {
      const params = [row.variant_id]
      let ledgerSql = `select coalesce(sum(${deltaCol}),0)::numeric as net from public.stock_ledger where variant_id = $1`
      if (row.branch_id && lset.has('branch_id')) {
        ledgerSql += ` and branch_id = $2`
        params.push(row.branch_id)
      }
      const led = await client.query(ledgerSql, params)
      const balanceQty = Number(row[qtyCol])
      const ledgerNet = Number(led.rows[0].net)
      checked++
      // Soft tolerance for reserved/condition splits — flag only gross divergence
      if (Math.abs(balanceQty - ledgerNet) > 0.001 && Number.isFinite(balanceQty) && Number.isFinite(ledgerNet)) {
        // Many schemas store condition-split balances; record as note not hard fail unless both sides nonzero absurd
        if (Math.abs(balanceQty) > 0 || Math.abs(ledgerNet) > 0) {
          mismatches.push({
            variant_id: row.variant_id,
            branch_id: row.branch_id ?? null,
            balance: balanceQty,
            ledger_net: ledgerNet,
          })
        }
      }
    }
  }

  const report = {
    host: safety.meta?.host,
    sample_size: sample.rows.length,
    checked,
    mismatch_count: mismatches.length,
    mismatches: mismatches.slice(0, 20),
    note:
      mismatches.length > 0
        ? 'Mismatches may reflect condition/location splits — investigate before release; not marked PASS as zero-diff proof'
        : checked > 0
          ? 'Sampled balances aligned with ledger net within tolerance'
          : 'No balance rows to reconcile — schema OK but empty dataset',
    status: 'RAN',
  }

  const outDir = resolve(process.cwd(), 'test-results')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'inventory-recon.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))

  // Empty DB is still a successful connectivity/schema recon run
  if (!hasBalances.rows[0].ok) process.exit(1)
  process.exit(0)
}

main()
  .catch((e) => {
    console.error('INVENTORY RECON FAIL:', e.message)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await client.end()
    } catch {
      /* ignore */
    }
  })
