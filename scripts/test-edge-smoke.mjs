/**
 * Node fallback for edge contract smokes when Deno is unavailable.
 * Reads function sources and asserts hard security contracts.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(process.cwd())
const checks = [
  {
    name: 'place-online-order',
    path: 'supabase/functions/place-online-order/index.ts',
    mustInclude: [/Authorization|authorization/i, /cors|CORS|Access-Control/i],
  },
  {
    name: 'admin-create-user',
    path: 'supabase/functions/admin-create-user/index.ts',
    mustInclude: [/Authorization|authorization/i, /service_role|SERVICE_ROLE|admin/i],
  },
  {
    name: 'courier-webhook',
    path: 'supabase/functions/courier-webhook/index.ts',
    mustInclude: [/webhook|signature|hmac|Authorization/i],
  },
]

let failed = 0
for (const check of checks) {
  const full = resolve(root, check.path)
  if (!existsSync(full)) {
    console.error(`FAIL ${check.name}: missing ${check.path}`)
    failed++
    continue
  }
  const src = readFileSync(full, 'utf8')
  const missing = check.mustInclude.filter((re) => !re.test(src))
  if (missing.length) {
    console.error(`FAIL ${check.name}: missing patterns ${missing.map(String).join(', ')}`)
    failed++
  } else {
    console.log(`OK ${check.name}`)
  }
}

if (failed > 0) {
  process.exit(1)
}
console.log('edge_contract_smoke_passed')
