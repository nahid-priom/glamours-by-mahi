/**
 * attendance-submit — verifies hardware signature + integrity, mints attestation, service-role RPC
 */
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'
import {
  assertProductionIntegrityConfig,
  evaluateIntegrity,
  getServiceClient,
  getUserClient,
  jsonResponse,
  requestId,
  resolveAuthUserId,
  verifyDeviceSignature,
  corsHeaders,
} from '../_shared/attendance-auth.ts'

const SubmitBody = z.object({
  event_type: z.enum(['check_in', 'check_out']),
  device_id: z.string().uuid(),
  challenge_id: z.string().uuid(),
  nonce: z.string().min(8),
  signature: z.string().min(16),
  employee_id: z.string().uuid().optional(),
  organization_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  shift_id: z.string().uuid().nullable().optional(),
  attendance_location_id: z.string().uuid().nullable().optional(),
  attendance_date: z.string().optional(),
  idempotency_key: z.string().uuid().optional(),
  integrity_nonce: z.string().min(8),
  app_version: z.string().optional(),
  platform: z.string().optional(),
  latitude: z.number(),
  longitude: z.number(),
  accuracy: z.number(),
  client_captured_at: z.string(),
  is_mocked: z.boolean().optional(),
  is_emulator: z.boolean().optional(),
  app_integrity_token: z.string().optional(),
  qr_token: z.string().nullable().optional(),
  qr_token_hash: z.string().nullable().optional(),
}).passthrough()

function canonicalize(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort()
  const sorted: Record<string, unknown> = {}
  for (const k of keys) sorted[k] = obj[k] === undefined ? null : obj[k]
  return JSON.stringify(sorted)
}

async function sha256Hex(message: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(message))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async (req) => {
  const rid = requestId(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    assertProductionIntegrityConfig()
    const raw = await req.json()
    const parsed = SubmitBody.safeParse(raw)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid submit payload', details: parsed.error.flatten() }, 400, rid)
    }
    const body = parsed.data
    const authUserId = await resolveAuthUserId(req)
    const userClient = getUserClient(req)
    const service = getServiceClient()

    const integrity = await evaluateIntegrity(body as unknown as Record<string, unknown>)
    if (!integrity.valid) {
      return jsonResponse({ error: 'App integrity check failed', verdict: integrity.verdict }, 403, rid)
    }

    const deviceId = body.device_id
    const { data: device, error: deviceErr } = await userClient
      .from('employee_attendance_devices')
      .select('id, public_key, status, is_active, revoked_at, employee_id')
      .eq('id', deviceId)
      .maybeSingle()

    if (deviceErr || !device || device.status !== 'approved' || !device.is_active || device.revoked_at) {
      return jsonResponse({ error: 'এই ডিভাইসটি এখনো অনুমোদিত নয়।' }, 403, rid)
    }

    const platform = String(body.platform ?? 'android')
    const appVersion = String(body.app_version ?? '0.0.0')
    const { data: policies } = await service
      .from('attendance_app_version_policy')
      .select('minimum_version, organization_id')
      .eq('platform', platform)
    if (policies && policies.length > 0) {
      const min =
        policies.find((p) => p.organization_id == null)?.minimum_version ??
        policies[0]?.minimum_version
      if (min && appVersion.localeCompare(min, undefined, { numeric: true }) < 0) {
        return jsonResponse({ error: 'অ্যাপ আপডেট প্রয়োজন।', minimum_version: min }, 426, rid)
      }
    }

    const canonical = {
      version: 1,
      accuracy: Number(body.accuracy),
      app_version: appVersion,
      attendance_date: String(body.attendance_date ?? ''),
      attendance_location_id: body.attendance_location_id ?? null,
      auth_user_id: authUserId,
      branch_id: body.branch_id ?? null,
      challenge_id: String(body.challenge_id ?? ''),
      challenge_nonce: String(body.nonce ?? ''),
      device_id: deviceId,
      employee_id: String(body.employee_id ?? device.employee_id),
      event_type: String(body.event_type ?? ''),
      idempotency_key: String(body.idempotency_key ?? crypto.randomUUID()),
      integrity_nonce: String(body.integrity_nonce ?? ''),
      latitude: Number(body.latitude),
      location_captured_at: String(body.client_captured_at ?? ''),
      longitude: Number(body.longitude),
      organization_id: String(body.organization_id ?? ''),
      platform,
      qr_token_hash: body.qr_token_hash ?? null,
      shift_id: body.shift_id ?? null,
    }

    const canonicalJson = canonicalize(canonical)
    const payloadHash = await sha256Hex(canonicalJson)
    const signatureOk = await verifyDeviceSignature(
      String(device.public_key),
      canonicalJson,
      String(body.signature ?? ''),
    )
    if (!signatureOk) {
      return jsonResponse({ error: 'Device signature invalid' }, 403, rid)
    }

    const { data: attestation, error: attErr } = await service.rpc('mint_attendance_submit_attestation', {
      p_payload_hash: payloadHash,
      p_challenge_id: canonical.challenge_id,
      p_device_id: deviceId,
      p_auth_user_id: authUserId,
    })
    if (attErr) return jsonResponse({ error: attErr.message }, 400, rid)

    const payload = {
      event_type: canonical.event_type,
      device_id: deviceId,
      challenge_id: canonical.challenge_id,
      nonce: canonical.challenge_nonce,
      idempotency_key: canonical.idempotency_key,
      canonical_payload_hash: payloadHash,
      submit_attestation: attestation,
      attestation_valid: true,
      edge_signature_verified: true,
      biometric_gate_used: true,
      integrity_valid: integrity.valid,
      integrity_verdict: integrity.verdict,
      auth_user_id: authUserId,
      latitude: canonical.latitude,
      longitude: canonical.longitude,
      accuracy: canonical.accuracy,
      client_captured_at: canonical.location_captured_at,
      qr_token: body.qr_token ?? null,
      is_mocked: Boolean(body.is_mocked),
      is_emulator: Boolean(body.is_emulator),
      ip_address: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      request_id: rid,
    }

    const { data, error } = await service.rpc('submit_mobile_attendance', { payload })
    if (error) return jsonResponse({ error: error.message }, 400, rid)
    return jsonResponse(data, 200, rid)
  } catch (e) {
    const msg = (e as Error).message
    return jsonResponse({ error: msg }, 500, rid)
  }
})
