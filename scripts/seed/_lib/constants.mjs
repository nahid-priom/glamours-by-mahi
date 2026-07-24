/** Stable namespace for all legacy multibranch demo seed records. */
export const NS = 'legacy_multibranch_demo_v1'

/** Prefix for client_txn_key values (org-scoped uniqueness). */
export function txnKey(...parts) {
  return [NS, ...parts].join('::')
}

/** Human-readable business reference (invoice/transfer labels). */
export function demoRef(kind, branchCode, seq, year = new Date().getFullYear()) {
  const code = (branchCode || 'ORG').toUpperCase()
  return `DEMO-${kind}-${year}-${String(seq).padStart(4, '0')}`
}

export const EPS = 0.01

export function approxEqual(a, b) {
  return Math.abs(Number(a) - Number(b)) <= EPS
}

export function money(n) {
  return `৳${Number(n).toFixed(2)}`
}

export function round2(n) {
  return Math.round(Number(n) * 100) / 100
}
