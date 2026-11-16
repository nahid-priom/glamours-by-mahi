/**
 * Shared safety helpers for staging DB URL targeting.
 * Never logs the full connection string.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const PRODUCTION_PROJECT_REFS = new Set([
  'vahqinuminrcjpussimn', // linked official project — never reset / never default QA target
])

export const PRODUCTION_ENV_IDS = new Set([
  'production',
  'prod',
  'live',
  'main-prod',
  'mahi-production',
])

export function loadEnvFilesQuiet() {
  for (const name of ['.env.e2e.local', '.env.test', '.env.local']) {
    const path = resolve(process.cwd(), name)
    if (!existsSync(path)) continue
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
}

/** Prefer TEST_DATABASE_URL; never silently fall back to production DATABASE_URL. */
export function resolveTestDatabaseUrl() {
  loadEnvFilesQuiet()
  return (process.env.TEST_DATABASE_URL ?? '').trim()
}

export function describeDbUrl(url) {
  if (!url) return { configured: false }
  let host = '(unknown)'
  let ref = null
  try {
    const u = new URL(url.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:'))
    host = u.hostname
    const m = url.match(/postgres\.([a-z0-9]+)\./i)
    if (m) ref = m[1]
  } catch {
    host = '(parse-error)'
  }
  const productionRef =
    (ref && PRODUCTION_PROJECT_REFS.has(ref)) ||
    [...PRODUCTION_PROJECT_REFS].some((r) => url.includes(r))
  return {
    configured: true,
    host,
    project_ref_guess: ref,
    is_production_ref: productionRef,
  }
}

export function assertSafeTestDatabaseUrl(url, { envId = '' } = {}) {
  if (!url) {
    return { ok: false, reason: 'TEST_DATABASE_URL unset' }
  }
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return { ok: false, reason: 'TEST_DATABASE_URL must be a postgresql:// URL' }
  }
  const meta = describeDbUrl(url)
  if (meta.is_production_ref) {
    return {
      ok: false,
      reason:
        'TEST_DATABASE_URL matches production project denylist — refuse. Use an isolated staging DB.',
      meta,
    }
  }
  const id = (envId || process.env.TEST_ENVIRONMENT_ID || '').toLowerCase()
  if (PRODUCTION_ENV_IDS.has(id)) {
    return { ok: false, reason: `TEST_ENVIRONMENT_ID="${id}" is production-denylisted`, meta }
  }
  return { ok: true, meta }
}
