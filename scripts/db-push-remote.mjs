#!/usr/bin/env node
/**
 * Push pending supabase/migrations to the remote database.
 *
 * Reads from .env.local (preferred) then .env:
 *   DATABASE_URL or SUPABASE_DB_URL  — Postgres connection string (required)
 *   SUPABASE_ACCESS_TOKEN            — personal access token (optional; used by CLI APIs)
 *
 * Usage:
 *   npm run db:push
 *   npm run db:push -- --dry-run
 *   npm run db:push -- --include-all
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')

function loadEnvFile(name) {
  const path = resolve(ROOT, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')

const dbUrl =
  process.env.DATABASE_URL?.trim() ||
  process.env.SUPABASE_DB_URL?.trim() ||
  process.env.SUPABASE_DB_URL_SESSION?.trim() ||
  ''

const accessToken = process.env.SUPABASE_ACCESS_TOKEN?.trim() || ''

if (!dbUrl) {
  console.error(
    'Missing DATABASE_URL (or SUPABASE_DB_URL) in .env.local.\n' +
      'Example:\n' +
      '  DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres\n' +
      '  SUPABASE_ACCESS_TOKEN=sbp_...',
  )
  process.exit(1)
}

if (!/^postgres(ql)?:\/\//i.test(dbUrl)) {
  console.error('DATABASE_URL must be a postgresql:// connection string.')
  process.exit(1)
}

const extraArgs = process.argv.slice(2)
const dryRun = extraArgs.includes('--dry-run')

function redactUrl(url) {
  try {
    const u = new URL(url)
    if (u.password) u.password = '***'
    return u.toString()
  } catch {
    return '[invalid-url]'
  }
}

console.log(`Target: remote Postgres (${redactUrl(dbUrl)})`)
if (accessToken) {
  console.log('Auth: SUPABASE_ACCESS_TOKEN loaded from env')
} else {
  console.log('Auth: no SUPABASE_ACCESS_TOKEN (ok when using a full DATABASE_URL)')
}
if (dryRun) console.log('Mode: dry-run')

const env = {
  ...process.env,
  ...(accessToken ? { SUPABASE_ACCESS_TOKEN: accessToken } : {}),
  // Non-interactive confirmation for hosted changes
  SUPABASE_YES: '1',
}

const args = ['supabase', 'db', 'push', `--remote=${dbUrl}`, '--yes', ...extraArgs]

const result = spawnSync('npx', args, {
  cwd: ROOT,
  env,
  stdio: 'inherit',
  shell: false,
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
