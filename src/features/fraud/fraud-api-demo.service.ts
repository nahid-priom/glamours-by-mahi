import type { FraudConnectionTestResult, ExternalFraudReport, FraudProvider } from './fraud.types'
import { customersService } from '@/features/customers/customers.service'

const DEMO_DELAY = 800

const delay = (ms = DEMO_DELAY) => new Promise((resolve) => setTimeout(resolve, ms))

// TODO: Replace demo provider with real API call via Supabase Edge Function

function hashPhone(phone: string): number {
  return phone.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

export function combineFraudScores(internal: number, external: number): number {
  return Math.min(100, Math.round(internal * 0.6 + external * 0.4))
}

export const fraudApiDemoService = {
  async testFraudApiConnection(provider: FraudProvider): Promise<FraudConnectionTestResult> {
    await delay()
    return {
      success: true,
      message: `Successfully connected to ${provider} fraud API`,
      latency_ms: DEMO_DELAY,
      status: 'connected',
    }
  },

  async checkPhoneFraudDemo(phone: string): Promise<ExternalFraudReport> {
    return this.getExternalFraudReportDemo(phone)
  },

  async getExternalFraudReportDemo(phone: string): Promise<ExternalFraudReport> {
    await delay()
    const customer = await customersService.getCustomerByPhone(phone)
    const seed = hashPhone(phone)

    const total_orders = customer?.total_orders ?? Math.max(1, (seed % 50) + 1)
    const returned = customer?.returned_orders ?? Math.floor(total_orders * ((seed % 30) / 100))
    const cancelled = customer?.cancelled_orders ?? Math.floor(total_orders * 0.05)
    const delivered = customer?.delivered_orders ?? total_orders - returned - cancelled
    const success_rate = total_orders > 0 ? Math.round((delivered / total_orders) * 1000) / 10 : 100
    const return_rate = total_orders > 0 ? Math.round((returned / total_orders) * 1000) / 10 : 0

    let external_score = Math.min(90, Math.round(return_rate * 1.5 + cancelled * 3))
    if (customer?.is_blacklisted) external_score = 95

    const risk_level =
      external_score >= 70 ? 'high' : external_score >= 40 ? 'medium' : 'safe'

    const reasons: string[] = []
    if (return_rate > 30) reasons.push('Return rate is high')
    else if (return_rate > 15) reasons.push('Return rate is moderate')
    if (cancelled > 2) reasons.push('Customer has previous cancelled orders')
    if (!customer) reasons.push('Limited order history on external database')
    if (reasons.length === 0) reasons.push('No significant fraud signals detected')

    return {
      success: true,
      phone,
      total_orders,
      delivered,
      returned,
      cancelled,
      success_rate,
      return_rate,
      external_score,
      risk_level,
      couriers: [
        { name: 'Steadfast', delivered: Math.floor(delivered * 0.4), returned: Math.floor(returned * 0.3) },
        { name: 'Pathao', delivered: Math.floor(delivered * 0.35), returned: Math.floor(returned * 0.35) },
        { name: 'RedX', delivered: Math.floor(delivered * 0.25), returned: Math.floor(returned * 0.35) },
      ],
      reasons,
    }
  },
}
