#!/usr/bin/env node
/**
 * Seed TEST_RUN_ID-scoped fixtures on an isolated staging DB (TEST_DATABASE_URL).
 * Creates a disposable cashier persona for RBAC denial tests.
 * Never targets production project refs. Never prints passwords.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import {
  resolveTestDatabaseUrl,
  assertSafeTestDatabaseUrl,
  loadEnvFilesQuiet,
} from './db-url-safety.mjs'

loadEnvFilesQuiet()

const runId =
  process.env.TEST_RUN_ID ??
  `qa-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}`
process.env.TEST_RUN_ID = runId

const url = resolveTestDatabaseUrl()
const safety = assertSafeTestDatabaseUrl(url)
if (!safety.ok) {
  console.error(`SEED BLOCKED: ${safety.reason}`)
  process.exit(2)
}

const tag = `qa:${runId}`
const cashierEmail = `cashier.${runId.replace(/[^a-z0-9]/gi, '').slice(-12)}@qa.internal`
const cashierPassword = `QaCashier!${randomBytes(6).toString('hex')}`
const cashierId = randomUUID()

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
})

async function main() {
  await client.connect()
  console.log(`Seeding fixtures run_id=${runId} host=${safety.meta?.host}`)

  // Discover org + branch
  const org = await client.query(
    `select id from public.organizations where deleted_at is null order by created_at asc nulls last limit 1`,
  )
  if (!org.rows[0]) throw new Error('No organization found on staging DB')
  const orgId = org.rows[0].id

  const branch = await client.query(
    `select id from public.branches where organization_id = $1 and deleted_at is null order by created_at asc nulls last limit 1`,
    [orgId],
  )
  if (!branch.rows[0]) throw new Error('No branch found on staging DB')
  const branchId = branch.rows[0].id

  // Role with POS but without inventory.valuation / settings.manage / administration
  const roleRes = await client.query(
    `insert into public.roles (organization_id, name, description, is_active)
     values ($1, $2, $3, true)
     returning id`,
    [orgId, `${tag}:Cashier`, 'Disposable QA cashier role'],
  )
  const roleId = roleRes.rows[0].id

  await client.query(
    `insert into public.role_permissions (role_id, permission_id)
     select $1, p.id
     from public.permissions p
     where p.deleted_at is null
       and p.key in (
         'pos.create', 'sales.read', 'sales.create',
         'products.read', 'inventory.read', 'orders.read',
         'exchange.read', 'exchange.create'
       )
     on conflict do nothing`,
    [roleId],
  )

  // Auth user + identity + profile
  await client.query(
    `insert into auth.users (
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
       confirmation_token, email_change, email_change_token_new, recovery_token
     ) values (
       $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, extensions.crypt($3, extensions.gen_salt('bf')),
       timezone('utc', now()), '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('full_name', $4),
       timezone('utc', now()), timezone('utc', now()), '', '', '', ''
     )`,
    [cashierId, cashierEmail, cashierPassword, `${tag} Cashier`],
  )

  await client.query(
    `insert into auth.identities (
       id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
     ) values (
       $1, $1,
       jsonb_build_object('sub', $1::text, 'email', $2, 'email_verified', true),
       'email', $1::text,
       timezone('utc', now()), timezone('utc', now()), timezone('utc', now())
     )`,
    [cashierId, cashierEmail],
  )

  await client.query(
    `insert into public.profiles (
       id, organization_id, full_name, email, role_id, default_branch_id, is_active
     ) values ($1, $2, $3, $4, $5, $6, true)`,
    [cashierId, orgId, `${tag} Cashier`, cashierEmail, roleId, branchId],
  )

  // Marker row for cleanup ownership (products name tag if table allows notes — use a qa_runs table if absent, else roles name is enough)
  const outDir = resolve(process.cwd(), 'test-results')
  mkdirSync(outDir, { recursive: true })
  const payload = {
    run_id: runId,
    tag,
    organization_id: orgId,
    branch_id: branchId,
    cashier: {
      id: cashierId,
      email: cashierEmail,
      role_id: roleId,
      // password written only to gitignored test-results
      password: cashierPassword,
    },
    seeded_at: new Date().toISOString(),
  }
  writeFileSync(resolve(outDir, 'staging-fixtures.json'), JSON.stringify(payload, null, 2))
  // Playwright-readable env snippet (gitignored via test-results/)
  writeFileSync(
    resolve(outDir, 'cashier.env'),
    `CASHIER_EMAIL=${cashierEmail}\nCASHIER_PASSWORD=${cashierPassword}\nTEST_RUN_ID=${runId}\n`,
  )

  console.log(`SEED OK: cashier_email=${cashierEmail} (password in test-results/cashier.env)`)
  console.log(`SEED OK: role=${tag}:Cashier branch=${branchId}`)
}

main()
  .catch((err) => {
    console.error('SEED FAILED:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    try {
      await client.end()
    } catch {
      /* ignore */
    }
  })
