import type {
  ConsignmentDemoResult,
  CourierConnectionTestResult,
  SyncCourierStatusesResult,
  TrackingDemoResult,
} from './couriers.types'
import { couriersService } from './couriers.service'

const DEMO_DELAY = 800

const delay = (ms = DEMO_DELAY) => new Promise((resolve) => setTimeout(resolve, ms))

// TODO: Replace demo provider with real API call via Supabase Edge Function

export const courierApiDemoService = {
  async testCourierConnection(courierId: string): Promise<CourierConnectionTestResult> {
    await delay()
    const courier = await couriersService.getCourierById(courierId)
    if (!courier) {
      return {
        success: false,
        message: 'Courier not found',
        latency_ms: DEMO_DELAY,
        connection_status: 'failed',
      }
    }

    if (!courier.api_key) {
      return {
        success: false,
        message: 'API key not configured — courier is disconnected',
        latency_ms: DEMO_DELAY,
        connection_status: 'disconnected',
      }
    }

    return {
      success: true,
      message: `Successfully connected to ${courier.name} API`,
      latency_ms: DEMO_DELAY,
      connection_status: 'connected',
    }
  },

  async createConsignmentDemo(
    _orderId: string,
    courierId: string,
  ): Promise<ConsignmentDemoResult> {
    await delay()
    const courier = await couriersService.getCourierById(courierId)
    if (!courier) {
      return {
        success: false,
        courier: 'Unknown',
        tracking_id: '',
        consignment_id: '',
        status: 'Failed',
        message: 'Courier not found',
      }
    }

    if (!courier.api_key || courier.status !== 'active') {
      return {
        success: false,
        courier: courier.name,
        tracking_id: '',
        consignment_id: '',
        status: 'Failed',
        message: 'Courier API not configured or courier is inactive',
      }
    }

    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const seq = String(Math.floor(Math.random() * 90000) + 10000)

    return {
      success: true,
      courier: courier.name,
      tracking_id: `${courier.code}-${date}-${seq}`,
      consignment_id: `CN-${Math.floor(Math.random() * 900000) + 100000}`,
      status: 'Courier Booked',
      message: 'Consignment created successfully',
    }
  },

  async trackParcelDemo(trackingId: string, courierId: string): Promise<TrackingDemoResult> {
    await delay()
    const courier = await couriersService.getCourierById(courierId)
    const now = new Date().toISOString()

    const statuses: TrackingDemoResult['status'][] = [
      'Pending Pickup',
      'In Transit',
      'Delivered',
      'Returned',
    ]
    const status = statuses[Math.floor(Math.random() * statuses.length)]

    return {
      tracking_id: trackingId,
      status,
      last_update: now,
      timeline: [
        {
          status: 'Order Received',
          location: 'Merchant Hub',
          timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
        },
        {
          status: 'Picked Up',
          location: `${courier?.name ?? 'Courier'} Hub, Dhaka`,
          timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        },
        {
          status,
          location: 'Dhaka Metro',
          timestamp: now,
        },
      ],
    }
  },

  async syncCourierStatusesDemo(): Promise<SyncCourierStatusesResult> {
    await delay()
    const couriers = await couriersService.getCouriers({ status: 'active' })
    const synced = couriers.filter((c) => c.api_key).length
    const now = new Date().toISOString()

    for (const courier of couriers) {
      if (courier.api_key) {
        await couriersService.updateCourier(courier.id, { last_sync_at: now })
      }
    }

    return {
      success: true,
      synced_count: synced,
      updated_at: now,
      message: `Synced status for ${synced} courier(s)`,
    }
  },
}
