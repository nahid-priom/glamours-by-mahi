/**
 * attendance-device-register
 * Employee JWT → register_attendance_device RPC
 */
import {
  assertProductionIntegrityConfig,
  corsHeaders,
  getUserClient,
  jsonResponse,
  requestId,
} from '../_shared/attendance-auth.ts'

Deno.serve(async (req) => {
  const rid = requestId(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    assertProductionIntegrityConfig()
    const payload = await req.json()
    if (!payload?.installation_id || !payload?.public_key) {
      return jsonResponse({ error: 'installation_id and public_key required' }, 400, rid)
    }
    const supabase = getUserClient(req)
    const { data, error } = await supabase.rpc('register_attendance_device', { payload })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500, rid)
  }
})
