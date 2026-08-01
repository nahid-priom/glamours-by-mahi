/**
 * Provider-neutral courier integration contract.
 * UI and business services must depend on this interface, never raw provider SDKs.
 */

export type CourierAuthType = 'api_key' | 'bearer' | 'basic' | 'oauth2' | 'none'

export type NormalizedCourierStatus =
  | 'draft'
  | 'booked'
  | 'pickup_requested'
  | 'picked_up'
  | 'in_transit'
  | 'at_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'delivery_failed'
  | 'partial_delivery'
  | 'return_requested'
  | 'returning'
  | 'returned'
  | 'cancelled'
  | 'courier_settled'
  | 'merchant_settled'
  | 'closed'
  | 'unknown'

export interface CourierCredentialsRef {
  /** Reference to Edge Function secrets — never store raw secrets in client tables. */
  secretRef: string
  environment: 'sandbox' | 'production'
  organizationId?: string
  companyId?: string
}

export interface CreateParcelRequest {
  merchantOrderId: string
  recipientName: string
  recipientPhone: string
  recipientAddress: string
  recipientDistrict?: string
  codAmount: number
  deliveryCharge?: number
  weightKg?: number
  itemSummary?: string
  note?: string
}

export interface CreateParcelResult {
  externalConsignmentId: string
  trackingCode: string
  status: NormalizedCourierStatus
  raw: unknown
}

export interface TrackParcelResult {
  trackingCode: string
  status: NormalizedCourierStatus
  statusLabel: string
  updatedAt: string | null
  raw: unknown
}

export interface DeliveryChargeRequest {
  recipientDistrict: string
  weightKg?: number
  codAmount?: number
}

export interface DeliveryChargeResult {
  amount: number
  currency: string
  raw: unknown
}

export interface WebhookNormalizeResult {
  externalEventId: string
  trackingCode: string | null
  consignmentId: string | null
  status: NormalizedCourierStatus
  occurredAt: string | null
  raw: Record<string, unknown>
}

export interface CourierProviderAdapter {
  readonly providerId: string
  readonly displayName: string

  testConnection(creds: CourierCredentialsRef): Promise<{ ok: boolean; message: string }>
  createParcel(
    creds: CourierCredentialsRef,
    request: CreateParcelRequest,
  ): Promise<CreateParcelResult>
  cancelParcel(creds: CourierCredentialsRef, trackingOrConsignmentId: string): Promise<void>
  trackParcel(creds: CourierCredentialsRef, trackingCode: string): Promise<TrackParcelResult>
  getDeliveryCharge?(
    creds: CourierCredentialsRef,
    request: DeliveryChargeRequest,
  ): Promise<DeliveryChargeResult>
  normalizeWebhook(
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ): Promise<WebhookNormalizeResult>
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string>,
    secret: string,
  ): boolean
}
