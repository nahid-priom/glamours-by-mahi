/**
 * Provider-neutral attendance device integration.
 * Raw device logs → normalized events → daily attendance → payroll (never couple payroll to raw punches).
 */

export type PunchType = 'in' | 'out' | 'break' | 'unknown'

export interface AttendanceDeviceCredentialsRef {
  secretRef: string
  baseUrl?: string
  deviceSerial?: string
}

export interface RawAttendancePunch {
  externalEventId: string
  deviceUserId: string
  punchedAt: string
  punchType: PunchType
  rawPayload: Record<string, unknown>
}

export interface PullLogsRequest {
  from: string
  to: string
}

export interface DeviceHealth {
  online: boolean
  lastSyncAt: string | null
  message: string
}

export interface AttendanceProviderAdapter {
  readonly providerId: string
  readonly displayName: string

  testConnection(creds: AttendanceDeviceCredentialsRef): Promise<DeviceHealth>
  pullLogs(
    creds: AttendanceDeviceCredentialsRef,
    request: PullLogsRequest,
  ): Promise<RawAttendancePunch[]>
  pushEmployee?(
    creds: AttendanceDeviceCredentialsRef,
    employee: { deviceUserId: string; fullName: string },
  ): Promise<void>
  normalizeWebhook?(
    payload: Record<string, unknown>,
  ): Promise<RawAttendancePunch[]>
}

export const manualAttendanceAdapter: AttendanceProviderAdapter = {
  providerId: 'manual',
  displayName: 'Manual Entry',
  async testConnection() {
    return { online: true, lastSyncAt: null, message: 'Manual attendance does not need a device.' }
  },
  async pullLogs() {
    return []
  },
}

export const csvImportAdapter: AttendanceProviderAdapter = {
  providerId: 'csv',
  displayName: 'CSV / Excel Import',
  async testConnection() {
    return { online: true, lastSyncAt: null, message: 'Ready for file import.' }
  },
  async pullLogs() {
    return []
  },
}

function stubDevice(providerId: string, displayName: string): AttendanceProviderAdapter {
  return {
    providerId,
    displayName,
    async testConnection(creds) {
      return {
        online: false,
        lastSyncAt: null,
        message: `${displayName} not configured (secret: ${creds.secretRef}). Add Edge Function secrets to go live.`,
      }
    },
    async pullLogs() {
      throw new Error(`${displayName} device API credentials are required.`)
    },
  }
}

export const zktecoAdapter = stubDevice('zkteco', 'ZKTeco')
export const realtimeApiAdapter = stubDevice('realtime', 'Realtime API')
export const webhookDeviceAdapter: AttendanceProviderAdapter = {
  providerId: 'webhook',
  displayName: 'Webhook Device',
  async testConnection() {
    return {
      online: true,
      lastSyncAt: null,
      message: 'Webhook endpoint ready — configure device to POST to attendance-webhook Edge Function.',
    }
  },
  async pullLogs() {
    return []
  },
  async normalizeWebhook(payload) {
    const deviceUserId = String(payload.user_id ?? payload.device_user_id ?? '')
    const punchedAt = String(payload.timestamp ?? payload.punched_at ?? new Date().toISOString())
    if (!deviceUserId) return []
    return [
      {
        externalEventId: String(payload.id ?? payload.event_id ?? `${deviceUserId}-${punchedAt}`),
        deviceUserId,
        punchedAt,
        punchType: String(payload.type ?? '').toLowerCase().includes('out') ? 'out' : 'in',
        rawPayload: payload,
      },
    ]
  },
}

const REGISTRY: Record<string, AttendanceProviderAdapter> = {
  manual: manualAttendanceAdapter,
  csv: csvImportAdapter,
  zkteco: zktecoAdapter,
  realtime: realtimeApiAdapter,
  webhook: webhookDeviceAdapter,
}

export function getAttendanceAdapter(providerId: string): AttendanceProviderAdapter {
  return REGISTRY[providerId] ?? manualAttendanceAdapter
}

export function listAttendanceAdapters(): AttendanceProviderAdapter[] {
  return Object.values(REGISTRY)
}
