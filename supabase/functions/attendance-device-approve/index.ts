/**
 * attendance-device-approve — admin approve/reject/revoke mobile devices
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
    if (!payload?.device_id || !payload?.action) {
      return jsonResponse({ error: 'device_id and action required' }, 400, rid)
    }
    const supabase = getUserClient(req)
    const { data, error } = await supabase.rpc('approve_attendance_device', { payload })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500, rid)
  }
})
