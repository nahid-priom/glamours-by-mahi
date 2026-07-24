#!/usr/bin/env node
/**
 * Two-session concurrent stock transfer receive probe.
 * Fires two parallel receive RPCs (6 qty each) against a 10-qty transfer.
 * Expects serialization: total received <= 10, at least one success, sum = 10 or one blocked.
 *
 * Required env: VITE_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 * Usage: node scripts/test-concurrent-transfer.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(resolve(root, '.env.local'))
loadEnvFile(resolve(root, '.env'))

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

function fail(msg) {
  console.error(`\n✖ Concurrent transfer probe: ${msg}\n`)
  process.exit(1)
}

if (!url || !serviceKey) {
  fail('Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const { data: setup, error: setupErr } = await admin.rpc('_erp_qa_prepare_concurrent_transfer')
  if (setupErr) fail(`setup failed: ${setupErr.message}`)

  const transferId = setup.transfer_id
  const stiId = setup.transfer_item_id
  const sent = Number(setup.quantity_sent ?? 10)

  const payload = (probeKey, qty) => ({
    transfer_id: transferId,
    transfer_item_id: stiId,
    quantity_received: qty,
    probe_key: probeKey,
  })

  const [r1, r2] = await Promise.all([
    admin.rpc('_erp_qa_receive_transfer_probe', { payload: payload('session-a', 6) }),
    admin.rpc('_erp_qa_receive_transfer_probe', { payload: payload('session-b', 6) }),
  ])

  if (r1.error) fail(`session-a transport error: ${r1.error.message}`)
  if (r2.error) fail(`session-b transport error: ${r2.error.message}`)

  const a = r1.data
  const b = r2.data
  const successes = [a, b].filter((r) => r?.ok)
  const failures = [a, b].filter((r) => r && !r.ok)

  const { data: finalState, error: finErr } = await admin.rpc(
    '_erp_qa_finalize_concurrent_transfer_probe',
    { p_transfer_id: transferId },
  )
  if (finErr) fail(`finalize failed: ${finErr.message}`)

  const received = Number(finalState.quantity_received ?? 0)
  const damaged = Number(finalState.quantity_damaged ?? 0)
  const ledgerIn = Number(finalState.transfer_in_ledger_total ?? 0)

  console.log('Concurrent transfer probe results:')
  console.log('  session-a:', a?.ok ? 'ok' : a?.error)
  console.log('  session-b:', b?.ok ? 'ok' : b?.error)
  console.log('  received:', received, 'damaged:', damaged, 'sent:', sent)
  console.log('  transfer_in ledger total:', ledgerIn)

  if (successes.length < 1) {
    fail('expected at least one concurrent receive to succeed')
  }
  if (received + damaged > sent + 0.001) {
    fail(`over-receive: ${received + damaged} > ${sent}`)
  }
  if (received + damaged < sent - 0.001 && failures.length === 0) {
    fail('both sessions succeeded but transfer is under-received without a blocking error')
  }
  if (Math.abs(ledgerIn - received) > 0.001) {
    fail(`ledger transfer_in ${ledgerIn} does not match received ${received}`)
  }
  if (successes.length === 2 && received !== sent) {
    fail('both sessions reported success but total received does not equal sent')
  }

  console.log('\n✓ Concurrent transfer receive probe PASS\n')
}

main().catch((err) => fail(err?.message ?? String(err)))
