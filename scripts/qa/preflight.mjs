#!/usr/bin/env node
/**
 * QA environment preflight — safety gates for mutating E2E + staging DB.
 * Never prints secret values.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  loadEnvFilesQuiet,
  resolveTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  describeDbUrl,
  PRODUCTION_ENV_IDS,
} from './db-url-safety.mjs'

export function loadEnvFiles() {
  loadEnvFilesQuiet()
}

export function resolveOwnerCredentials() {
  const email =
    process.env.OWNER_EMAIL ??
    process.env.E2E_OWNER_EMAIL ??
    process.env.E2E_ADMIN_EMAIL ??
    process.env.E2E_EMAIL ??
    ''
  const password =
    process.env.OWNER_PASSWORD ??
    process.env.E2E_OWNER_PASSWORD ??
    process.env.E2E_ADMIN_PASSWORD ??
    process.env.E2E_PASSWORD ??
    ''
  return { email, password }
}

export function runPreflight() {
  loadEnvFiles()

  const envId = (process.env.TEST_ENVIRONMENT_ID ?? '').trim().toLowerCase()
  const baseURL =
    process.env.E2E_BASE_URL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    'http://localhost:5173'
  const allowMutating =
    String(process.env.ALLOW_MUTATING_E2E ?? '').toLowerCase() === 'true'
  const { email, password } = resolveOwnerCredentials()
  const testDbUrl = resolveTestDatabaseUrl()
  const dbSafety = assertSafeTestDatabaseUrl(testDbUrl, { envId })
  const dbMeta = testDbUrl ? describeDbUrl(testDbUrl) : { configured: false }
  const runId =
    process.env.TEST_RUN_ID ??
    `qa-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`
  process.env.TEST_RUN_ID = runId

  const isDeniedProduction = !envId || PRODUCTION_ENV_IDS.has(envId)
  const looksLocal =
    /localhost|127\.0\.0\.1/.test(baseURL) || envId === 'local' || envId.startsWith('local-')
  const looksStaging =
    envId.startsWith('staging') ||
    envId.startsWith('test') ||
    envId.startsWith('qa') ||
    envId.includes('sandbox')

  const dbReady = Boolean(testDbUrl) && dbSafety.ok
  const mutatingAllowed =
    allowMutating &&
    !isDeniedProduction &&
    (looksLocal || looksStaging) &&
    Boolean(envId) &&
    dbReady

  const result = {
    ok: true,
    run_id: runId,
    base_url: baseURL,
    test_environment_id: envId || null,
    owner_email_configured: Boolean(email),
    owner_password_configured: Boolean(password),
    test_database_url_configured: Boolean(testDbUrl),
    test_database_safe: dbSafety.ok,
    test_database_host: dbMeta.host ?? null,
    test_database_block_reason: dbSafety.ok ? null : dbSafety.reason ?? null,
    allow_mutating_e2e: allowMutating,
    mutating_allowed: mutatingAllowed,
    auth_ready: Boolean(email && password),
    db_ready: dbReady,
    blockers: [],
    warnings: [],
  }

  if (!email || !password) {
    result.warnings.push('OWNER credentials missing — authenticated E2E will be BLOCKED')
  }
  if (!envId) {
    result.warnings.push('TEST_ENVIRONMENT_ID unset — mutating E2E BLOCKED')
  } else if (PRODUCTION_ENV_IDS.has(envId)) {
    result.blockers.push(`TEST_ENVIRONMENT_ID="${envId}" is production-denylisted`)
    result.ok = false
  }
  if (!testDbUrl) {
    result.warnings.push(
      'TEST_DATABASE_URL unset — DB phase BLOCKED (DATABASE_URL is never used as a silent fallback)',
    )
  } else if (!dbSafety.ok) {
    result.blockers.push(dbSafety.reason)
    result.ok = false
  }
  if (allowMutating && !mutatingAllowed) {
    result.warnings.push(
      'ALLOW_MUTATING_E2E=true but staging DB/env gate not satisfied — mutations BLOCKED',
    )
  }

  const outDir = resolve(process.cwd(), 'test-results')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(resolve(outDir, 'preflight.json'), JSON.stringify(result, null, 2))

  return result
}

const invokedDirectly = process.argv[1]?.endsWith('preflight.mjs')
if (invokedDirectly) {
  const strict = process.argv.includes('--strict')
  const result = runPreflight()
  console.log('QA Preflight')
  console.log(`  run_id: ${result.run_id}`)
  console.log(`  base_url: ${result.base_url}`)
  console.log(`  test_environment_id: ${result.test_environment_id ?? '(unset)'}`)
  console.log(`  owner_email_configured: ${result.owner_email_configured}`)
  console.log(`  owner_password_configured: ${result.owner_password_configured}`)
  console.log(`  test_database_url_configured: ${result.test_database_url_configured}`)
  console.log(`  test_database_safe: ${result.test_database_safe}`)
  console.log(`  test_database_host: ${result.test_database_host ?? '(n/a)'}`)
  console.log(`  db_ready: ${result.db_ready}`)
  console.log(`  mutating_allowed: ${result.mutating_allowed}`)
  for (const w of result.warnings) console.log(`  WARN: ${w}`)
  for (const b of result.blockers) console.log(`  BLOCK: ${b}`)
  if (strict && (!result.ok || result.blockers.length)) process.exit(1)
  process.exit(0)
}
