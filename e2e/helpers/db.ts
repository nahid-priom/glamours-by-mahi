/**
 * Server-side DB assertions for Playwright (Node runtime only).
 * Uses TEST_DATABASE_URL — never expose to the browser bundle.
 */
import pg from 'pg'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvQuiet() {
  for (const name of ['.env.e2e.local', '.env.test', '.env.local', 'test-results/cashier.env']) {
    const path = resolve(process.cwd(), name)
    if (!existsSync(path)) continue
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const eq = t.indexOf('=')
      const key = t.slice(0, eq).trim()
      let val = t.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = val
    }
  }
}

export function dbReady(): boolean {
  loadEnvQuiet()
  const url = process.env.TEST_DATABASE_URL ?? ''
  if (!url) return false
  if (url.includes('vahqinuminrcjpussimn')) return false
  return /^postgres(ql)?:\/\//i.test(url)
}

async function withClient<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  loadEnvQuiet()
  const url = process.env.TEST_DATABASE_URL
  if (!url || url.includes('vahqinuminrcjpussimn')) {
    throw new Error('DB BLOCKED: safe TEST_DATABASE_URL required')
  }
  const client = new pg.Client({
    connectionString: url,
    ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return withClient(async (c) => {
    const r = await c.query(sql, params)
    return r.rows as T[]
  })
}

export async function getVariantOnHand(variantId: string, branchId?: string): Promise<number | null> {
  const rows = await query(
    branchId
      ? `select * from public.inventory_balances where variant_id = $1 and branch_id = $2 limit 5`
      : `select * from public.inventory_balances where variant_id = $1 limit 5`,
    branchId ? [variantId, branchId] : [variantId],
  )
  if (!rows[0]) return null
  let total = 0
  let found = false
  for (const row of rows as Record<string, unknown>[]) {
    const qty = row.qty_on_hand ?? row.quantity_on_hand ?? row.on_hand ?? row.qty
    if (qty != null && Number.isFinite(Number(qty))) {
      total += Number(qty)
      found = true
    }
  }
  return found ? total : null
}

export async function countLedgerForVariant(variantId: string): Promise<number> {
  const rows = await query(
    `select count(*)::int as c from public.stock_ledger where variant_id = $1`,
    [variantId],
  )
  return Number(rows[0]?.c ?? 0)
}
