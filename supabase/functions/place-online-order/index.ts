/**
 * Edge Function: place-online-order
 * Prefer calling place_online_order RPC directly from the anon client.
 * This proxy is disabled unless PLACE_ONLINE_ORDER_PROXY_SECRET is set and
 * the request includes a matching x-proxy-secret header. Never open as a
 * public service-role gateway.
 *
 * Required secrets: SUPABASE_URL, SUPABASE_ANON_KEY (preferred) or SERVICE_ROLE
 * Optional: PLACE_ONLINE_ORDER_PROXY_SECRET
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-proxy-secret',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const proxySecret = Deno.env.get('PLACE_ONLINE_ORDER_PROXY_SECRET') ?? ''
    if (!proxySecret) {
      return jsonResponse(
        {
          error:
            'place-online-order proxy is disabled. Call place_online_order RPC from the client instead.',
        },
        403,
      )
    }

    const provided = req.headers.get('x-proxy-secret') ?? ''
    if (!timingSafeEqual(provided, proxySecret)) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const payload = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    // Prefer anon so RLS/RPC grants apply; service role only if explicitly configured for trusted proxy.
    const key =
      Deno.env.get('SUPABASE_ANON_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      ''
    if (!supabaseUrl || !key) {
      return jsonResponse({ error: 'Server misconfigured' }, 500)
    }

    const supabase = createClient(supabaseUrl, key)
    const { data, error } = await supabase.rpc('place_online_order', { payload })
    if (error) {
      return jsonResponse({ error: error.message }, 400)
    }

    return jsonResponse(data)
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500)
  }
})
