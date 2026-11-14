#!/usr/bin/env node
/**
 * Dashboard V3.1 demo seed orchestrator (LOCAL / isolated staging ONLY).
 *
 * Reuses the authoritative POS path via scripts/seed-sales-demo.mjs patterns.
 * NEVER run against the linked production project `vahqinuminrcjpussimn`.
 *
 * Required:
 *   SUPABASE_URL=http://127.0.0.1:54321 (or approved non-prod)
 *   SUPABASE_ANON_KEY=...
 *   SEED_USER_EMAIL / SEED_USER_PASSWORD
 *
 * Usage:
 *   node scripts/demo/seed-glamorous-dashboard.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const PROD_MARKERS = [
  'vahqinuminrcjpussimn',
  'aws-1-ap-south-1.pooler.supabase.com',
]

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

if (!url) fail('SUPABASE_URL is required.')

for (const marker of PROD_MARKERS) {
  if (url.includes(marker)) {
    fail(
      `Refusing to seed production-linked database (${marker}). Use local Supabase or an isolated staging project.`,
    )
  }
}

if (!url.includes('127.0.0.1') && !url.includes('localhost') && process.env.ALLOW_NONLOCAL_DEMO !== '1') {
  fail(
    'URL is not localhost. Set ALLOW_NONLOCAL_DEMO=1 only for an approved isolated staging project.',
  )
}

if (!process.env.SEED_USER_EMAIL || !process.env.SEED_USER_PASSWORD) {
  fail('SEED_USER_EMAIL and SEED_USER_PASSWORD are required.')
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const salesDemo = path.join(root, 'scripts/seed-sales-demo.mjs')

console.log('→ Running guarded sales demo seed (complete_pos_sale only)…')
const result = spawnSync(process.execPath, [salesDemo], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
})

if (result.status !== 0) {
  fail(`seed-sales-demo exited with code ${result.status}`)
}

console.log('\n✓ Demo seed finished. Reconcile Dashboard via get_dashboard_overview.\n')
