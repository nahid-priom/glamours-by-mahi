#!/usr/bin/env node
/**
 * Align frontend RPC call sites with the linked Supabase project.
 *
 * Checks:
 *  1) Every FE rpc('name') / untypedRpc('name') exists in public schema
 *  2) authenticated has EXECUTE (unless allowlisted)
 *  3) Optional: --smoke runs authenticated PostgREST probes for read RPCs
 *
 * Usage:
 *   node scripts/check-rpc-alignment.mjs
 *   node scripts/check-rpc-alignment.mjs --smoke
 *   RPC_SMOKE_EMAIL=... RPC_SMOKE_PASSWORD=... node scripts/check-rpc-alignment.mjs --smoke
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const smoke = process.argv.includes('--smoke')

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name.startsWith('.')) continue
    const p = path.join(dir, ent.name)
    if (ent.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

function extractFeRpcs() {
  const re = /(?:untypedRpc|\.rpc)\(\s*['"]([a-zA-Z0-9_]+)['"]/g
  const staffRe = /rpc(?:<[^>]+>)?\(\s*['"]([a-zA-Z0-9_]+)['"]/g
  const map = new Map()
  for (const file of walk(path.join(root, 'src'))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const reX of [re, staffRe]) {
      reX.lastIndex = 0
      let m
      while ((m = reX.exec(text))) {
        const name = m[1]
        if (!map.has(name)) map.set(name, new Set())
        map.get(name).add(path.relative(root, file))
      }
    }
  }
  return map
}

function loadEnvFile(rel) {
  const p = path.join(root, rel)
  if (!fs.existsSync(p)) return {}
  const out = {}
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    out[t.slice(0, i)] = t.slice(i + 1)
  }
  return out
}

/**
 * Extract balanced JSON values (`{...}` or `[...]`) from mixed CLI stdout/stderr.
 * Supabase `--output-format json` often emits a bare row array; noisy CLI output
 * may wrap rows or interleave log lines.
 */
function extractJsonValuesStacked(text) {
  const values = []
  for (let i = 0; i < text.length; i++) {
    const start = text[i]
    if (start !== '{' && start !== '[') continue
    const stack = [start]
    let inString = false
    let escape = false
    for (let j = i + 1; j < text.length; j++) {
      const ch = text[j]
      if (inString) {
        if (escape) escape = false
        else if (ch === '\\') escape = true
        else if (ch === '"') inString = false
        continue
      }
      if (ch === '"') {
        inString = true
        continue
      }
      if (ch === '{' || ch === '[') {
        stack.push(ch)
        continue
      }
      if (ch === '}' || ch === ']') {
        const top = stack[stack.length - 1]
        if ((ch === '}' && top === '{') || (ch === ']' && top === '[')) {
          stack.pop()
          if (stack.length === 0) {
            const slice = text.slice(i, j + 1)
            try {
              values.push(JSON.parse(slice))
            } catch {
              // ignore
            }
            i = j
            break
          }
        }
      }
    }
  }
  return values
}

function looksLikeRpcCatalogRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const sample = rows.find((r) => r && typeof r === 'object')
  if (!sample) return false
  return 'name' in sample && ('auth_exec' in sample || 'args' in sample)
}

function rowsFromParsed(parsed) {
  if (!parsed || typeof parsed !== 'object') return null
  if (Array.isArray(parsed)) {
    return looksLikeRpcCatalogRows(parsed) || parsed.length === 0 ? parsed : null
  }
  if (Array.isArray(parsed.rows)) return parsed.rows
  if (parsed.data && Array.isArray(parsed.data.rows)) return parsed.data.rows
  if (parsed.result?.data && Array.isArray(parsed.result.data.rows)) return parsed.result.data.rows
  if (parsed.result && Array.isArray(parsed.result.rows)) return parsed.result.rows
  return null
}

function queryRemote(sql) {
  let stdout = ''
  let stderr = ''
  try {
    stdout = execFileSync(
      'npx',
      ['supabase', 'db', 'query', '--remote', '--read-only', '--output-format', 'json', sql],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
  } catch (err) {
    stdout = String(err.stdout ?? '')
    stderr = String(err.stderr ?? '')
    if (!stdout && !stderr) throw err
  }

  // Fast path: CLI prints a bare JSON array/object as stdout
  const trimmed = stdout.trim()
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const rows = rowsFromParsed(JSON.parse(trimmed))
      if (rows) return rows
    } catch {
      // fall through to mixed-output extraction
    }
  }

  const combined = `${stdout}\n${stderr}`
  const values = extractJsonValuesStacked(combined)
  // Prefer largest array that looks like catalog rows (outer [ ... ] over nested objects)
  const arrays = values.filter((v) => Array.isArray(v))
  arrays.sort((a, b) => b.length - a.length)
  for (const parsed of [...arrays, ...values]) {
    const rows = rowsFromParsed(parsed)
    if (rows) return rows
  }

  throw new Error(
    'No rows JSON from supabase db query.\n' +
      `stdout head: ${stdout.slice(0, 240)}\n` +
      `stderr head: ${stderr.slice(0, 240)}`,
  )
}

async function main() {
  const fe = extractFeRpcs()
  const rows = queryRemote(`
    SELECT p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  `)

  const byName = new Map()
  for (const r of rows) {
    if (!byName.has(r.name)) byName.set(r.name, [])
    byName.get(r.name).push(r)
  }

  const missing = []
  const noAuth = []
  for (const [name, files] of [...fe.entries()].sort()) {
    const overs = byName.get(name)
    if (!overs) {
      missing.push({ name, files: [...files] })
      continue
    }
    const ok = overs.some((o) => o.auth_exec === true || o.auth_exec === 't')
    if (!ok) noAuth.push({ name, overs, files: [...files] })
  }

  console.log(`FE RPC call sites: ${fe.size}`)
  console.log(`Remote public functions: ${byName.size}`)
  console.log(`Missing on remote: ${missing.length}`)
  for (const m of missing) console.log(`  MISSING  ${m.name}  (${m.files[0]})`)
  console.log(`No authenticated EXECUTE: ${noAuth.length}`)
  for (const m of noAuth) console.log(`  NO_AUTH  ${m.name}`)

  let smokeFails = 0
  if (smoke) {
    const env = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env.e2e.local') }
    const url = (process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
    const anon = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
    const email = process.env.RPC_SMOKE_EMAIL || env.E2E_ADMIN_EMAIL || env.OWNER_EMAIL
    const password = process.env.RPC_SMOKE_PASSWORD || env.E2E_ADMIN_PASSWORD || env.OWNER_PASSWORD
    if (!url || !anon || !email || !password) {
      console.error('Smoke mode needs VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and E2E/OWNER credentials')
      process.exit(2)
    }
    const tokenRes = await awaitFetchJson(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anon, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const token = tokenRes.access_token
    if (!token) throw new Error('Auth failed for smoke user')

    const probes = [
      ['get_inventory_low_stock', {}],
      ['get_inventory_variant_breakdown', {}],
      ['list_activity_feed', { payload: { limit: 5, offset: 0 } }],
      ['list_products_with_inventory_summary', { payload: { page: 1, page_size: 5 } }],
      ['sales_history_list', { p_filters: {} }],
      ['get_supplier_directory_summary', {}],
      ['get_dashboard_overview', {}],
    ]

    console.log('\nSmoke probes:')
    for (const [name, body] of probes) {
      const { status, json } = await awaitFetchStatus(`${url}/rest/v1/rpc/${name}`, {
        method: 'POST',
        headers: {
          apikey: anon,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      const ok = status === 200
      if (!ok) smokeFails++
      const msg = ok ? 'OK' : `${json?.code || status}: ${json?.message || ''}`.slice(0, 160)
      console.log(`  ${ok ? 'OK' : 'FAIL'}  ${name}  ${msg}`)
    }
  }

  if (missing.length || noAuth.length || smokeFails) {
    process.exit(1)
  }
  console.log('\nRPC alignment OK')
}

async function awaitFetchJson(url, init) {
  const res = await fetch(url, init)
  return res.json()
}

async function awaitFetchStatus(url, init) {
  const res = await fetch(url, init)
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, json }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
