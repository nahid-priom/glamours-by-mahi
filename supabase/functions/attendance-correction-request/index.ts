/**
 * attendance-correction-request
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
    if (!payload?.attendance_record_id && !payload?.work_date) {
      return jsonResponse({ error: 'attendance_record_id or work_date required' }, 400, rid)
    }
    const supabase = getUserClient(req)
    const { data, error } = await supabase.rpc('request_attendance_correction', { payload })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500, rid)
  }
})
