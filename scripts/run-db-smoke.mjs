/**
 * Run SQL smoke files against Supabase local (preferred) or DATABASE_URL.
 * Never targets production. Linked remote is opt-in via SUPABASE_DB_TARGET=linked.
 *
 * Usage:
 *   node scripts/run-db-smoke.mjs supabase/tests/rpc/p0_delivery_smoke.sql [...]
 *   npm run db:test:p0
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const rawArgs = process.argv.slice(2).filter(Boolean)
const flagLinked = rawArgs.includes('--linked')
const files = rawArgs.filter((a) => a !== '--linked' && a !== '--local')
if (files.length === 0) {
  console.error('Usage: node scripts/run-db-smoke.mjs [--local|--linked] <sql-file> [...]')
  process.exit(2)
}

const target = (
  flagLinked ? 'linked' : process.env.SUPABASE_DB_TARGET ?? 'local'
).toLowerCase()
const useLinked = target === 'linked'

for (const file of files) {
  const full = resolve(process.cwd(), file)
  if (!existsSync(full)) {
    console.error(`Missing SQL file: ${file}`)
    process.exit(1)
  }
}

function runSupabaseQuery(file) {
  const args = ['supabase', 'db', 'query', useLinked ? '--linked' : '--local', '--file', file]
  console.log(`> npx ${args.join(' ')}`)
  return spawnSync('npx', args, { stdio: 'inherit', shell: true, encoding: 'utf8' })
}

function printHelp(stderr = '') {
  const linked403 =
    /403|necessary privileges|access-control/i.test(stderr) || useLinked

  console.error('\n--- DB smoke could not run ---')
  if (useLinked || linked403) {
    console.error(
      [
        'Remote --linked query failed (often HTTP 403).',
        'Your Supabase account needs Owner/Admin (or equivalent) on the linked project,',
        'or a personal access token with SQL/query access.',
        '',
        'Preferred (Delivery QA plan): use local Supabase instead:',
        '  1. Install/start Docker Desktop',
        '  2. npx supabase start',
        '  3. npx supabase db reset --yes',
        '  4. npm run db:test:p0          # uses --local by default',
        '',
        'To force linked again (only if you have privileges):',
        '  set SUPABASE_DB_TARGET=linked',
        '  npm run db:test:p0',
      ].join('\n'),
    )
  } else {
    console.error(
      [
        'Local Supabase is not reachable. Docker must be installed and running.',
        '  1. Start Docker Desktop',
        '  2. npx supabase start',
        '  3. npx supabase db reset --yes',
        '  4. npm run db:test:p0',
      ].join('\n'),
    )
  }
}

for (const file of files) {
  const result = runSupabaseQuery(file)
  if (result.status !== 0) {
    const errText = String(result.stderr ?? result.stdout ?? '')
    printHelp(errText)
    process.exit(result.status ?? 1)
  }
}

console.log('db_smoke_passed')
