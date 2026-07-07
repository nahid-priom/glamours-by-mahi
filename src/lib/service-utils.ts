import { generateId } from '@/lib/id'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export { delay }

export function nowIso(): string {
  return new Date().toISOString()
}

export function auditCreate<T extends Record<string, unknown>>(data: T, prefix: string) {
  const now = nowIso()
  return {
    ...data,
    id: generateId(prefix),
    created_at: now,
    updated_at: now,
    deleted_at: null,
    created_by: 'Admin',
    updated_by: 'Admin',
  }
}

export function auditUpdate<T extends { updated_at: string; updated_by?: string | null }>(
  entity: T,
  patch: Partial<T>,
): T {
  return {
    ...entity,
    ...patch,
    updated_at: nowIso(),
    updated_by: 'Admin',
  }
}

export function maskApiKey(key?: string): string {
  if (!key) return 'Not configured'
  if (key.length <= 8) return '********'
  return `${key.slice(0, 7)}${'*'.repeat(8)}${key.slice(-4)}`
}
