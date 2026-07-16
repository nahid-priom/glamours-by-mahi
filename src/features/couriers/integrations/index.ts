import type {
  CourierCredentialsRef,
  CourierProviderAdapter,
  CreateParcelRequest,
  CreateParcelResult,
  TrackParcelResult,
  WebhookNormalizeResult,
} from './courier-provider.interface'

function mapStatus(raw: string): CreateParcelResult['status'] {
  const s = raw.toLowerCase()
  if (s.includes('deliver') && !s.includes('fail') && !s.includes('out')) return 'delivered'
  if (s.includes('out_for') || s.includes('ofd')) return 'out_for_delivery'
  if (s.includes('transit') || s.includes('hub')) return 'in_transit'
  if (s.includes('pick')) return 'picked_up'
  if (s.includes('return')) return 'returning'
  if (s.includes('cancel')) return 'cancelled'
  if (s.includes('fail')) return 'delivery_failed'
  if (s.includes('book') || s.includes('create')) return 'booked'
  return 'unknown'
}

/** Manual / in-house courier — no external API; booking stays internal. */
export const manualCourierAdapter: CourierProviderAdapter = {
  providerId: 'manual',
  displayName: 'Manual Courier',

  async testConnection() {
    return { ok: true, message: 'Manual courier does not require an API connection.' }
  },

  async createParcel(_creds, request: CreateParcelRequest): Promise<CreateParcelResult> {
    const trackingCode = `MAN-${Date.now().toString(36).toUpperCase()}`
    return {
      externalConsignmentId: trackingCode,
      trackingCode,
      status: 'booked',
      raw: { mode: 'manual', merchantOrderId: request.merchantOrderId },
    }
  },

  async cancelParcel() {
    /* Internal cancel handled by ERP parcel status update */
  },

  async trackParcel(_creds, trackingCode: string): Promise<TrackParcelResult> {
    return {
      trackingCode,
      status: 'unknown',
      statusLabel: 'Track in ERP Delivery Tracking',
      updatedAt: null,
      raw: {},
    }
  },

  async normalizeWebhook(payload): Promise<WebhookNormalizeResult> {
    return {
      externalEventId: String(payload.id ?? payload.event_id ?? crypto.randomUUID()),
      trackingCode: (payload.tracking_no as string) ?? null,
      consignmentId: (payload.consignment_id as string) ?? null,
      status: mapStatus(String(payload.status ?? '')),
      occurredAt: (payload.occurred_at as string) ?? null,
      raw: payload,
    }
  },

  verifyWebhookSignature() {
    return true
  },
}

function stubAdapter(
  providerId: string,
  displayName: string,
): CourierProviderAdapter {
  return {
    providerId,
    displayName,
    async testConnection(creds: CourierCredentialsRef) {
      return {
        ok: false,
        message: `${displayName} credentials (${creds.secretRef}) are not configured in Edge Function secrets yet.`,
      }
    },
    async createParcel() {
      throw new Error(
        `${displayName} API is not connected. Add provider credentials in Settings → Integrations, then deploy Edge Functions.`,
      )
    },
    async cancelParcel() {
      throw new Error(`${displayName} API is not connected.`)
    },
    async trackParcel() {
      throw new Error(`${displayName} API is not connected.`)
    },
    async normalizeWebhook(payload) {
      return manualCourierAdapter.normalizeWebhook(payload, {})
    },
    verifyWebhookSignature(_rawBody: string, headers: Record<string, string>, secret: string) {
      const provided =
        headers['x-webhook-secret'] ??
        headers['x-courier-secret'] ??
        headers['authorization']?.replace(/^Bearer\s+/i, '')
      return Boolean(secret) && provided === secret
    },
  }
}

export const pathaoAdapter = stubAdapter('pathao', 'Pathao')
export const steadfastAdapter = stubAdapter('steadfast', 'Steadfast')
export const redxAdapter = stubAdapter('redx', 'RedX')
export const paperflyAdapter = stubAdapter('paperfly', 'Paperfly')

const REGISTRY: Record<string, CourierProviderAdapter> = {
  manual: manualCourierAdapter,
  pathao: pathaoAdapter,
  steadfast: steadfastAdapter,
  redx: redxAdapter,
  paperfly: paperflyAdapter,
}

export function getCourierAdapter(providerId: string): CourierProviderAdapter {
  return REGISTRY[providerId] ?? manualCourierAdapter
}

export function listCourierAdapters(): CourierProviderAdapter[] {
  return Object.values(REGISTRY)
}
