#!/usr/bin/env node
/**
 * Cleanup only TEST_RUN_ID-scoped cashier/role fixtures.
 * Refuses production URLs. Does not delete unrelated business data.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import {
  resolveTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  loadEnvFilesQuiet,
} from './db-url-safety.mjs'

loadEnvFilesQuiet()

const fixturesPath = resolve(process.cwd(), 'test-results/staging-fixtures.json')
if (!existsSync(fixturesPath)) {
  console.error('No test-results/staging-fixtures.json — nothing to clean')
  process.exit(0)
}

const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8'))
const runId = fixtures.run_id || process.env.TEST_RUN_ID
if (!runId || !String(fixtures.tag || '').includes(runId)) {
  console.error('REFUSE cleanup: fixture tag does not match TEST_RUN_ID ownership')
  process.exit(2)
}

const url = resolveTestDatabaseUrl()
const safety = assertSafeTestDatabaseUrl(url)
if (!safety.ok) {
  console.error(`CLEANUP BLOCKED: ${safety.reason}`)
  process.exit(2)
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  const { cashier, tag } = fixtures
  if (cashier?.id) {
    await client.query(`delete from public.profiles where id = $1`, [cashier.id])
    await client.query(`delete from auth.identities where user_id = $1`, [cashier.id])
    await client.query(`delete from auth.users where id = $1`, [cashier.id])
  }
  if (cashier?.role_id) {
    await client.query(`delete from public.role_permissions where role_id = $1`, [cashier.role_id])
    await client.query(`delete from public.roles where id = $1 and name = $2`, [
      cashier.role_id,
      `${tag}:Cashier`,
    ])
  }
  console.log(`CLEANUP OK for run_id=${runId}`)
}

main()
  .catch((e) => {
    console.error(e.message)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await client.end()
    } catch {
      /* ignore */
    }
  })
