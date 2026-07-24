#!/usr/bin/env node
/**
 * Verify legacy multibranch demo seed + idempotency comparison.
 *
 * Usage:
 *   npm run verify:legacy-demo
 *   npm run verify:legacy-demo -- --compare snapshot.json
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NS } from './seed/_lib/constants.mjs'
import { requireEnv } from './seed/_lib/env.mjs'
import { signIn } from './seed/_lib/clients.mjs'
import { buildSeedContext } from './seed/_lib/resolve.mjs'
import { reconcileDemo, printReconciliation, compareReports } from './seed/_lib/reconcile.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const snapshotPath = resolve(__dirname, '.legacy-demo-snapshot.json')

function fail(msg) {
  console.error(`\n✖ ${msg}\n`)
  process.exit(1)
}

async function main() {
  requireEnv()
  const args = process.argv.slice(2)
  const saveSnapshot = args.includes('--save')
  const compareArg = args.find((a) => a.startsWith('--compare='))
  const compareFile = compareArg ? compareArg.split('=')[1] : args.includes('--compare') ? snapshotPath : null

  console.log(`\n▶ Verify legacy demo (${NS})`)
  await signIn()

  const ctx = await buildSeedContext()
  const report = await reconcileDemo(ctx)
  printReconciliation(report)

  if (saveSnapshot) {
    writeFileSync(snapshotPath, JSON.stringify(report, null, 2))
    console.log(`Snapshot saved: ${snapshotPath}`)
  }

  if (compareFile && existsSync(compareFile)) {
    const before = JSON.parse(readFileSync(compareFile, 'utf8'))
    const diffs = compareReports(before, report)
    if (diffs.length) {
      console.error('Idempotency check FAILED — counts changed on re-run:')
      diffs.forEach((d) => console.error(`  ${d}`))
      process.exitCode = 3
    } else {
      console.log('✓ Idempotency check passed (counts unchanged vs snapshot)')
    }
  }

  if (!report.ok) process.exitCode = 2
}

main().catch((e) => fail(e?.message || String(e)))
