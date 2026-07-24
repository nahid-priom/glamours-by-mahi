#!/usr/bin/env node
/**
 * Legacy multibranch demo seed — interconnected Bangladeshi retail demo data.
 *
 * Namespace: legacy_multibranch_demo_v1
 * All transactional data flows through canonical RPCs (no direct ledger/stock writes).
 *
 * Required env:
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   VITE_SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)
 *   SEED_USER_EMAIL, SEED_USER_PASSWORD
 * Optional:
 *   SUPABASE_SERVICE_ROLE_KEY — back-dating + deep reconciliation
 *   SEED_ORG_SLUG — force organization slug
 *   SEED_MAX_BRANCHES — additional branches to seed (default 4)
 *
 * Usage: npm run seed:legacy-demo
 */
import { NS } from './seed/_lib/constants.mjs'
import { requireEnv, MAX_ADDITIONAL_BRANCHES } from './seed/_lib/env.mjs'
import { signIn, admin } from './seed/_lib/clients.mjs'
import { buildSeedContext, printAuditSummary } from './seed/_lib/resolve.mjs'
import { reconcileDemo, printReconciliation } from './seed/_lib/reconcile.mjs'
import { runReference } from './seed/scenarios/reference.mjs'
import { runPurchases } from './seed/scenarios/purchases.mjs'
import { runTransfers } from './seed/scenarios/transfers.mjs'
import { runSales } from './seed/scenarios/sales.mjs'
import { runCollections } from './seed/scenarios/collections.mjs'
import { runSupplierPayments } from './seed/scenarios/supplier-payments.mjs'
import { runReturns } from './seed/scenarios/returns.mjs'
import { runExpenses } from './seed/scenarios/expenses.mjs'

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

async function main() {
  requireEnv()
  console.log(`\n▶ Legacy multibranch demo seed (${NS})`)
  console.log(admin ? 'Mode: RPC + service-role backdate/reconcile' : 'Mode: RPC only (set SUPABASE_SERVICE_ROLE_KEY for backdates)')

  const user = await signIn()
  console.log(`Signed in: ${user.email}`)

  const ctx = await buildSeedContext(MAX_ADDITIONAL_BRANCHES)
  printAuditSummary(ctx)

  if (ctx.catalog.filter((v) => v.price > 0).length < 5) {
    fail('Need at least 5 priced product variants. Run base catalog seed (migration 009) first.')
  }

  console.log('— Reference data (suppliers, customers, expense categories) —')
  await runReference(ctx)

  console.log('\n— Purchases (complete_purchase) —')
  await runPurchases(ctx)

  console.log('\n— Stock transfers —')
  await runTransfers(ctx)

  // Refresh catalog stock after purchases/transfers
  const { loadCatalogVariants } = await import('./seed/_lib/resolve.mjs')
  const allSaleableIds = [...ctx.branchMap.values()].flatMap((bc) =>
    bc.saleableLocations.map((l) => l.id),
  )
  ctx.catalog = await loadCatalogVariants(ctx.org.id, allSaleableIds)

  console.log('\n— POS sales (complete_pos_sale) —')
  await runSales(ctx)

  console.log('\n— Customer collections —')
  await runCollections(ctx)

  console.log('\n— Supplier payments —')
  await runSupplierPayments(ctx)

  console.log('\n— Returns —')
  await runReturns(ctx)

  console.log('\n— Branch expenses —')
  await runExpenses(ctx)

  const report = await reconcileDemo(ctx)
  printReconciliation(report)

  console.log('— Summary —')
  console.log('Created:', JSON.stringify(ctx.stats.created))
  console.log('Skipped:', JSON.stringify(ctx.stats.skipped))
  if (ctx.stats.errors.length) {
    console.error('Errors:')
    ctx.stats.errors.forEach((e) => console.error(`  ${e}`))
    process.exitCode = 1
  } else if (!report.ok) {
    process.exitCode = 2
  } else {
    console.log('\n✓ Seed completed successfully')
  }
}

main().catch((e) => fail(e?.message || String(e)))
