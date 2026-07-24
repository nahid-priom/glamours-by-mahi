#!/usr/bin/env node
/**
 * Safe cleanup for legacy_multibranch_demo_v1 seed-owned reference rows only.
 *
 * CANNOT safely reverse posted RPC workflows (sales, purchases, transfers, journals)
 * without canonical void/reversal RPCs for every document type.
 *
 * This script only soft-deletes demo suppliers/customers that have NO linked
 * transactional history. Posted documents remain auditable.
 *
 * Usage: npm run cleanup:legacy-demo
 */
import { NS } from './seed/_lib/constants.mjs'
import { requireEnv } from './seed/_lib/env.mjs'
import { signIn, admin } from './seed/_lib/clients.mjs'
import { buildSeedContext, findByNotesMarker } from './seed/_lib/resolve.mjs'

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

async function canDeleteCustomer(c, orgId) {
  const { count } = await admin
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('customer_id', c.id)
    .is('deleted_at', null)
  return (count ?? 0) === 0
}

async function canDeleteSupplier(s, orgId) {
  const { count } = await admin
    .from('purchases')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('supplier_id', s.id)
    .is('deleted_at', null)
  return (count ?? 0) === 0
}

async function main() {
  requireEnv()
  if (!admin) fail('SUPABASE_SERVICE_ROLE_KEY required for cleanup.')

  console.log(`\n▶ Safe cleanup (${NS}) — reference data only`)
  await signIn()
  const ctx = await buildSeedContext(99)

  const customers = await findByNotesMarker('customers', ctx.org.id)
  const suppliers = await findByNotesMarker('suppliers', ctx.org.id)

  let removedCustomers = 0
  let removedSuppliers = 0
  const blocked = []

  for (const c of customers) {
    if (await canDeleteCustomer(c, ctx.org.id)) {
      await admin.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', c.id)
      removedCustomers += 1
    } else {
      blocked.push(`customer ${c.name} (has sales)`)
    }
  }

  for (const s of suppliers) {
    if (await canDeleteSupplier(s, ctx.org.id)) {
      await admin.from('suppliers').update({ deleted_at: new Date().toISOString() }).eq('id', s.id)
      removedSuppliers += 1
    } else {
      blocked.push(`supplier ${s.name} (has purchases)`)
    }
  }

  console.log(`Removed ${removedCustomers} demo customer(s), ${removedSuppliers} demo supplier(s)`)
  if (blocked.length) {
    console.log('\nCannot remove (linked transactions — use void/reversal workflows):')
    blocked.forEach((b) => console.log(`  · ${b}`))
  }
  console.log(
    '\nPosted demo sales, purchases, transfers, expenses and ledger entries were NOT deleted.',
  )
  console.log('For a full reset, restore from backup or use a fresh Supabase branch.')
}

main().catch((e) => fail(e?.message || String(e)))
