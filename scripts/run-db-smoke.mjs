/**
 * Run SQL smoke files against:
 *   1) TEST_DATABASE_URL (isolated staging) — preferred for V5.1 when Docker absent
 *   2) supabase local (--local / default without TEST_DATABASE_URL)
 *   3) supabase linked (--linked) — opt-in only; never used for production reset
 *
 * Never silently uses DATABASE_URL from .env.local (often production).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  resolveTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  loadEnvFilesQuiet,
} from './qa/db-url-safety.mjs'

loadEnvFilesQuiet()

const rawArgs = process.argv.slice(2).filter(Boolean)
const flagLinked = rawArgs.includes('--linked')
const flagLocal = rawArgs.includes('--local')
const files = rawArgs.filter((a) => a !== '--linked' && a !== '--local')
if (files.length === 0) {
  console.error(
    'Usage: node scripts/run-db-smoke.mjs [--local|--linked] <sql-file> [...]\n' +
      'Or set TEST_DATABASE_URL to an isolated staging Postgres URL.',
  )
  process.exit(2)
}

for (const file of files) {
  const full = resolve(process.cwd(), file)
  if (!existsSync(full)) {
    console.error(`Missing SQL file: ${file}`)
    process.exit(1)
  }
}

const testUrl = resolveTestDatabaseUrl()
const preferUrl = Boolean(testUrl) && !flagLocal && !flagLinked
const useLinked = flagLinked || (!preferUrl && (process.env.SUPABASE_DB_TARGET ?? '').toLowerCase() === 'linked')

const outDir = resolve(process.cwd(), 'test-results')
mkdirSync(outDir, { recursive: true })
const logPath = resolve(outDir, 'db-smoke.log')
writeFileSync(logPath, `db_smoke_start ${new Date().toISOString()}\n`)

function log(line) {
  console.log(line)
  appendFileSync(logPath, line + '\n')
}

async function runViaTestUrl(file) {
  const safety = assertSafeTestDatabaseUrl(testUrl)
  if (!safety.ok) {
    log(`REFUSED: ${safety.reason}`)
    return { status: 1 }
  }
  log(
    `> TEST_DATABASE_URL target host=${safety.meta?.host ?? '(unknown)'} ref=${safety.meta?.project_ref_guess ?? 'n/a'} file=${file}`,
  )

  // Prefer psql when available
  const psql = spawnSync(
    'psql',
    [testUrl, '-v', 'ON_ERROR_STOP=1', '-f', resolve(process.cwd(), file)],
    { encoding: 'utf8' },
  )
  if (psql.error?.code !== 'ENOENT') {
    if (psql.stdout) process.stdout.write(psql.stdout)
    if (psql.stderr) process.stderr.write(psql.stderr)
    appendFileSync(logPath, (psql.stdout || '') + (psql.stderr || ''))
    return { status: psql.status ?? 1 }
  }

  // Fallback: node pg (optional dependency)
  try {
    const pg = await import('pg')
    const Client = pg.Client ?? pg.default?.Client
    const { readFileSync } = await import('node:fs')
    const client = new Client({
      connectionString: testUrl,
      ssl: testUrl.includes('localhost') ? undefined : { rejectUnauthorized: false },
    })
    await client.connect()
    try {
      const sql = readFileSync(resolve(process.cwd(), file), 'utf8')
      await client.query(sql)
      log(`ok via pg: ${file}`)
      return { status: 0 }
    } finally {
      await client.end()
    }
  } catch (err) {
    // Last resort: supabase CLI remote URL
    const args = [
      'supabase',
      'db',
      'query',
      `--remote=${testUrl}`,
      '--file',
      resolve(process.cwd(), file),
      '--yes',
    ]
    log(`> npx ${args.join(' ')} (url redacted in practice)`)
    const r = spawnSync('npx', ['supabase', 'db', 'query', `--remote=${testUrl}`, '--file', resolve(process.cwd(), file), '--yes'], {
      encoding: 'utf8',
      shell: false,
    })
    if (r.stdout) process.stdout.write(r.stdout)
    if (r.stderr) process.stderr.write(r.stderr)
    appendFileSync(logPath, (r.stdout || '') + (r.stderr || ''))
    if ((r.status ?? 1) !== 0) {
      log(
        'HINT: install psql or `npm i -D pg`, and ensure TEST_DATABASE_URL is an isolated staging DB (not production).',
      )
      log(String(err?.message ?? err))
    }
    return { status: r.status ?? 1 }
  }
}

function runSupabaseQuery(file) {
  const args = [
    'supabase',
    'db',
    'query',
    useLinked ? '--remote' : '--local',
    '--file',
    resolve(process.cwd(), file),
  ]
  log(`> npx ${args.join(' ')}`)
  return spawnSync('npx', args, { encoding: 'utf8', shell: false })
}

function printHelp() {
  console.error('\n--- DB smoke could not run ---')
  console.error(
    [
      'V5.1 preferred: set TEST_DATABASE_URL to an isolated staging Postgres URL in .env.e2e.local',
      '  (never use the production project ref; DATABASE_URL alone is ignored for safety)',
      '',
      'Or use local Supabase (requires Docker):',
      '  1. Start Docker',
      '  2. npx supabase start',
      '  3. npm run db:test:p0 -- --local',
    ].join('\n'),
  )
}

async function main() {
  if (preferUrl) {
    for (const file of files) {
      const result = await runViaTestUrl(file)
      if ((result.status ?? 1) !== 0) {
        printHelp()
        process.exit(result.status ?? 1)
      }
    }
    log('db_smoke_passed via TEST_DATABASE_URL')
    process.exit(0)
  }

  for (const file of files) {
    const result = runSupabaseQuery(file)
    if (result.stdout) process.stdout.write(result.stdout)
    if (result.stderr) process.stderr.write(result.stderr)
    appendFileSync(logPath, (result.stdout || '') + (result.stderr || ''))
    const failed =
      (result.status ?? 1) !== 0 ||
      /"_tag"\s*:\s*"Error"|ECONNREFUSED|DbConnectError/i.test(
        `${result.stdout || ''}${result.stderr || ''}`,
      )
    if (failed) {
      printHelp()
      process.exit(result.status && result.status !== 0 ? result.status : 1)
    }
  }
  log('db_smoke_passed')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
