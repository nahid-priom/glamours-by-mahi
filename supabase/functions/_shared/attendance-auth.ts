/**
 * Shared attendance Edge auth + production integrity guards.
 */
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': Deno.env.get('ATTENDANCE_CORS_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-request-id',
}

export function jsonResponse(body: unknown, status = 200, requestId?: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...(requestId ? { 'x-request-id': requestId } : {}),
    },
  })
}

export function requestId(req: Request): string {
  return req.headers.get('x-request-id') ?? crypto.randomUUID()
}

export function deploymentEnvironment(): string {
  return (
    Deno.env.get('APP_ENV') ||
    Deno.env.get('ENVIRONMENT') ||
    Deno.env.get('DENO_ENV') ||
    'development'
  ).toLowerCase()
}

export function integrityMode(): 'dev_bypass' | 'enforce' {
  const env = deploymentEnvironment()
  const raw = (Deno.env.get('ATTENDANCE_INTEGRITY_MODE') ?? '').toLowerCase()
  if (env === 'production') {
    if (raw === 'dev_bypass') {
      throw new Error('ATTENDANCE_INTEGRITY_MODE=dev_bypass is forbidden in production')
    }
    return 'enforce'
  }
  if (raw === 'enforce') return 'enforce'
  return 'dev_bypass'
}

export function assertProductionIntegrityConfig(): void {
  integrityMode() // throws if production + bypass
}

export function getUserClient(req: Request): SupabaseClient {
  const auth = req.headers.get('Authorization')
  if (!auth) throw new Error('Missing Authorization')
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
  return createClient(url, anon, {
    global: { headers: { Authorization: auth } },
  })
}

export function getServiceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing')
  return createClient(url, key)
}

export async function resolveAuthUserId(req: Request): Promise<string> {
  const supabase = getUserClient(req)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new Error('Invalid session')
  return data.user.id
}

/** Play Integrity / App integrity — fail closed in enforce mode. */
export async function evaluateIntegrity(payload: Record<string, unknown>): Promise<{
  valid: boolean
  verdict: string
}> {
  const mode = integrityMode()
  if (mode === 'dev_bypass') {
    return { valid: true, verdict: 'bypassed_dev' }
  }

  const token = String(payload.app_integrity_token ?? '')
  const nonce = String(payload.integrity_nonce ?? '')
  if (!token || !nonce) return { valid: false, verdict: 'missing_token_or_nonce' }

  const packageName = Deno.env.get('PLAY_INTEGRITY_PACKAGE_NAME') ?? ''
  const cloudProject = Deno.env.get('PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER') ?? ''
  const hasApi = Boolean(Deno.env.get('PLAY_INTEGRITY_API_KEY') || Deno.env.get('GOOGLE_APPLICATION_CREDENTIALS_JSON'))

  if (!hasApi || !packageName) {
    return { valid: false, verdict: 'integrity_not_configured' }
  }

  // Decode token via Google Play Integrity API when credentials present.
  // Without a live Google call in this environment, reject under enforce.
  try {
    const apiKey = Deno.env.get('PLAY_INTEGRITY_API_KEY')
    if (apiKey && cloudProject) {
      const res = await fetch(
        `https://playintegrity.googleapis.com/v1/${packageName}:decodeIntegrityToken?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrityToken: token }),
        },
      )
      if (!res.ok) return { valid: false, verdict: 'integrity_api_error' }
      const decoded = await res.json()
      const reqDetails = decoded?.tokenPayloadExternal?.requestDetails
      const appIntegrity = decoded?.tokenPayloadExternal?.appIntegrity
      if (reqDetails?.nonce && String(reqDetails.nonce) !== nonce) {
        return { valid: false, verdict: 'nonce_mismatch' }
      }
      if (appIntegrity?.appRecognitionVerdict !== 'PLAY_RECOGNIZED') {
        return { valid: false, verdict: 'unrecognized_app' }
      }
      return { valid: true, verdict: 'passed' }
    }
  } catch {
    return { valid: false, verdict: 'integrity_verify_failed' }
  }

  return { valid: false, verdict: 'integrity_not_configured' }
}

export async function verifyDeviceSignature(
  publicKeyB64: string,
  message: string,
  signatureB64: string,
): Promise<boolean> {
  try {
    const sig = Uint8Array.from(atob(signatureB64), (c) => c.charCodeAt(0))
    const keyData = Uint8Array.from(atob(publicKeyB64), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'spki',
      keyData,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      sig,
      new TextEncoder().encode(message),
    )
  } catch {
    return false
  }
}
