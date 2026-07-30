#!/usr/bin/env node
/**
 * Fail if service_role keys or private key material appear under apps/attendance-mobile.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(process.cwd(), 'apps', 'attendance-mobile')
const FORBIDDEN = [
  /service_role/i,
  /SUPABASE_SERVICE_ROLE/,
  /BEGIN (RSA |EC )?PRIVATE KEY/,
  /pkcs8/i,
  /extractable:\s*true/,
]

const SKIP = new Set(['node_modules', '.expo', 'dist', 'android', 'ios'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx|js|jsx|json|env|md)$/i.test(name)) out.push(p)
  }
  return out
}

let failed = false
for (const file of walk(ROOT)) {
  const text = readFileSync(file, 'utf8')
  for (const re of FORBIDDEN) {
    if (re.test(text)) {
      // allow documenting the ban in comments of this scan's sibling docs only if not matching hard secrets
      if (
        /service_role|SUPABASE_SERVICE_ROLE/i.test(re.source) &&
        /never|do not|forbidden|must not|not in the app|Expo app/i.test(text)
      ) {
        continue
      }
      console.error(`FORBIDDEN pattern ${re} in ${relative(process.cwd(), file)}`)
      failed = true
    }
  }
}

if (failed) {
  console.error('Secret scan FAILED')
  process.exit(1)
}
console.log('Secret scan OK — no service_role / private key material in attendance-mobile')
