import type { ERPDatabase } from './schema'
import { getDatabase, withTransaction } from './local-database'

export class TransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransactionError'
  }
}

const locks = new Set<string>()

export function runAtomic<T>(
  lockKey: string,
  work: (draft: ERPDatabase) => T,
): T {
  if (locks.has(lockKey)) {
    throw new TransactionError('This action is already in progress. Please wait.')
  }
  locks.add(lockKey)
  try {
    return withTransaction(work)
  } finally {
    locks.delete(lockKey)
  }
}

export function withIdempotency<T>(
  key: string,
  findExisting: (db: ERPDatabase) => T | null,
  create: (db: ERPDatabase) => T,
): T {
  return runAtomic(`idempotency:${key}`, (draft) => {
    const existing = findExisting(draft)
    if (existing) return existing
    return create(draft)
  })
}

export function peekDatabase(): ERPDatabase {
  return getDatabase()
}
