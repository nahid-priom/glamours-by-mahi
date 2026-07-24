import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '../../..')

function loadEnvFile(path) {
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile(resolve(root, '.env.local'))
loadEnvFile(resolve(root, '.env'))

const env = process.env

export const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL
export const ANON_KEY =
  env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY
export const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || null
export const SEED_EMAIL = env.SEED_USER_EMAIL
export const SEED_PASSWORD = env.SEED_USER_PASSWORD
export const SEED_ORG_SLUG = env.SEED_ORG_SLUG || null
export const MAX_ADDITIONAL_BRANCHES = Number(env.SEED_MAX_BRANCHES || 4)

export function requireEnv() {
  const missing = []
  if (!SUPABASE_URL) missing.push('SUPABASE_URL / VITE_SUPABASE_URL')
  if (!ANON_KEY) missing.push('SUPABASE_ANON_KEY / VITE_SUPABASE_PUBLISHABLE_KEY')
  if (!SEED_EMAIL) missing.push('SEED_USER_EMAIL')
  if (!SEED_PASSWORD) missing.push('SEED_USER_PASSWORD')
  if (missing.length) {
    throw new Error(`Missing required env: ${missing.join(', ')}`)
  }
}
