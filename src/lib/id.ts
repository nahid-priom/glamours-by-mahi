export function generateId(prefix = 'id'): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 7)}`
}

export function generateOrderId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `REX-${date}-${seq}`
}

export function generateTrackingId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = String(Math.floor(Math.random() * 90000) + 10000)
  return `REX${date}${random}`
}
