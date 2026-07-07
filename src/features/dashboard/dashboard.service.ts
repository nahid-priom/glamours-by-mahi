import {
  ANALYTICS_CARDS,
  BALANCE_CARDS,
  CASH_FLOW_DATA,
  COURIER_PERFORMANCE,
  DELIVERY_PROGRESS,
  FRAUD_SUMMARY,
  KPI_DATA,
  ORDER_AUTOMATION,
  ORDER_STATUS_DATA,
  PICKUP_QUEUE,
  PROFIT_TREND_DATA,
  SMART_ALERTS,
  TOP_STORES,
} from './dashboard.data'

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms))

export const dashboardService = {
  async getKpis() {
    await delay()
    return KPI_DATA
  },

  async getCashFlow() {
    await delay()
    return CASH_FLOW_DATA
  },

  async getProfitTrend() {
    await delay()
    return PROFIT_TREND_DATA
  },

  async getBalances() {
    await delay()
    return BALANCE_CARDS
  },

  async getOrderStatus() {
    await delay()
    return ORDER_STATUS_DATA
  },

  async getPickupQueue() {
    await delay()
    return PICKUP_QUEUE
  },

  async getDeliveryProgress() {
    await delay()
    return DELIVERY_PROGRESS
  },

  async getTopStores() {
    await delay()
    return TOP_STORES
  },

  async getCourierPerformance() {
    await delay()
    return COURIER_PERFORMANCE
  },

  async getSmartAlerts() {
    await delay()
    return SMART_ALERTS
  },

  async getFraudSummary() {
    await delay()
    return FRAUD_SUMMARY
  },

  async getOrderAutomation() {
    await delay()
    return ORDER_AUTOMATION
  },

  async getAnalyticsCards() {
    await delay()
    return ANALYTICS_CARDS
  },
}
