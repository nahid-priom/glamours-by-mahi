export function daysAgo(n, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour + (n % 7), 15 + (n % 30), 0, 0)
  return d
}

export function toIso(d) {
  return d.toISOString()
}

export function toDay(d) {
  return d.toISOString().slice(0, 10)
}

export function currentYear() {
  return new Date().getFullYear()
}
