/**
 * attendance-device-change-request — employee requests device change after admin revoke
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
    const body = await req.json()
    const supabase = getUserClient(req)
    const { data: ctx, error: ctxErr } = await supabase.rpc('get_mobile_attendance_context')
    if (ctxErr) return jsonResponse({ error: ctxErr.message }, 400, rid)

    const device = (ctx as { device?: { id?: string; status?: string } })?.device
    if (device?.status === 'approved' && device.id) {
      return jsonResponse(
        {
          error:
            'ডিভাইস পরিবর্তনের জন্য অ্যাডমিনকে বর্তমান ডিভাইস revoke করতে হবে, তারপর নতুন ডিভাইস রেজিস্টার করুন।',
          device_id: device.id,
          status: 'change_requires_admin_revoke',
        },
        409,
        rid,
      )
    }

    if (!body?.installation_id || !body?.public_key) {
      return jsonResponse({ error: 'installation_id and public_key required' }, 400, rid)
    }

    const { data, error } = await supabase.rpc('register_attendance_device', { payload: body })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500, rid)
  }
})
