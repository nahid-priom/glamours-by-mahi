export type CourierStatus = 'active' | 'inactive' | 'archived'
export type CourierConnectionStatus = 'connected' | 'disconnected' | 'testing' | 'failed'

export interface Courier {
  id: string
  name: string
  code: string
  logo_url?: string
  contact_phone?: string
  api_base_url?: string
  api_key?: string
  api_secret?: string
  webhook_url?: string
  status: CourierStatus
  connection_status: CourierConnectionStatus
  default_service_type?: string
  success_rate: number
  pending_parcels: number
  delivered_parcels: number
  returned_parcels: number
  collection_amount: number
  last_sync_at?: string | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  created_by?: string | null
  updated_by?: string | null
}

export interface CourierFormInput {
  name: string
  code: string
  contact_phone?: string
  status: CourierStatus
  default_service_type?: string
  logo_url?: string
}

export interface CourierApiConfigInput {
  api_base_url?: string
  api_key?: string
  api_secret?: string
  webhook_url?: string
  default_service_type?: string
}

export interface CourierFilters {
  search?: string
  status?: CourierStatus | 'all'
  connection_status?: CourierConnectionStatus | 'all'
  include_deleted?: boolean
}

export interface CourierStats {
  active: number
  connected: number
  pending_parcels: number
  avg_success_rate: number
}

export interface CourierConnectionTestResult {
  success: boolean
  message: string
  latency_ms: number
  connection_status: CourierConnectionStatus
}

export interface ConsignmentDemoResult {
  success: boolean
  courier: string
  tracking_id: string
  consignment_id: string
  status: string
  message: string
}

export interface TrackingTimelineEvent {
  status: string
  location?: string
  timestamp: string
}

export interface TrackingDemoResult {
  tracking_id: string
  status: 'In Transit' | 'Delivered' | 'Returned' | 'Pending Pickup'
  last_update: string
  timeline: TrackingTimelineEvent[]
}

export interface SyncCourierStatusesResult {
  success: boolean
  synced_count: number
  updated_at: string
  message: string
}
