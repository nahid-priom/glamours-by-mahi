/**
 * Edge Function: attendance-webhook
 * Receives biometric/device punches, upserts attendance_raw_logs by external_event_id.
 *
 * Required secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ATTENDANCE_WEBHOOK_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-attendance-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const secret = Deno.env.get('ATTENDANCE_WEBHOOK_SECRET') ?? ''
  const provided =
    req.headers.get('x-attendance-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  if (!secret || provided !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const punches = Array.isArray(body) ? body : [body]
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let inserted = 0
    for (const punch of punches) {
      const organization_id = punch.organization_id as string | undefined
      const device_id = punch.device_id as string | undefined
      const device_user_id = String(punch.user_id ?? punch.device_user_id ?? '')
      const punched_at = String(punch.timestamp ?? punch.punched_at ?? new Date().toISOString())
      const external_event_id = String(
        punch.id ?? punch.event_id ?? `${device_user_id}-${punched_at}`,
      )

      if (!organization_id || !device_user_id) continue

      const { error } = await supabase.from('attendance_raw_logs').upsert(
        {
          organization_id,
          device_id: device_id ?? null,
          device_user_id,
          punched_at,
          punch_type: String(punch.type ?? 'unknown').toLowerCase().includes('out')
            ? 'out'
            : 'in',
          external_event_id,
          raw_payload: punch,
          processing_status: 'pending',
        },
        { onConflict: 'organization_id,device_id,external_event_id', ignoreDuplicates: true },
      )

      if (!error) inserted += 1
    }

    return new Response(JSON.stringify({ ok: true, inserted }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
