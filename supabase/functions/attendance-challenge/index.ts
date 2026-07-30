/**
 * attendance-challenge — one-time nonce for check-in/out
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
    if (!payload?.device_id || !payload?.event_type) {
      return jsonResponse({ error: 'device_id and event_type required' }, 400, rid)
    }
    const supabase = getUserClient(req)
    const { data, error } = await supabase.rpc('create_attendance_challenge', { payload })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500, rid)
  }
})
